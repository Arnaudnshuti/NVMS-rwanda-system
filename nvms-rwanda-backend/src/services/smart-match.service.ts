type SmartMatchProgram = {
  title: string;
  description: string;
  category: string;
  district: string;
  requiredSkills: string[];
  startDate: Date;
  endDate: Date;
  slotsTotal: number;
};

type SmartMatchVolunteer = {
  id: string;
  name: string;
  email: string;
  district: string | null;
  skills: string[];
  volunteerAvailability: string | null;
  hoursContributed: number;
  programsCompleted: number;
  rating: unknown;
};

export type SmartMatchResult = {
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string;
  district: string | null;
  hoursContributed: number;
  rating: number;
  skills: string[];
  score: number;
  reason: string;
  matchSource: "ai" | "rules";
};

type AiRank = {
  volunteerId: string;
  score: number;
  reason: string;
};

function clampScore(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function serializeResult(v: SmartMatchVolunteer, rank: AiRank, matchSource: "ai" | "rules"): SmartMatchResult {
  return {
    volunteerId: v.id,
    volunteerName: v.name,
    volunteerEmail: v.email,
    district: v.district,
    hoursContributed: v.hoursContributed,
    rating: Number(v.rating),
    skills: v.skills,
    score: clampScore(rank.score),
    reason: rank.reason,
    matchSource,
  };
}

function ruleBasedRanks(program: SmartMatchProgram, volunteers: SmartMatchVolunteer[]): SmartMatchResult[] {
  const required = program.requiredSkills.map((s) => s.toLowerCase());
  return volunteers
    .map((v) => {
      const skills = v.skills.map((s) => s.toLowerCase());
      const skillHits = required.filter((s) => skills.includes(s)).length;
      const skillScore = required.length ? (skillHits / required.length) * 55 : 20;
      const districtScore = v.district === program.district ? 25 : 8;
      const availabilityScore = v.volunteerAvailability?.trim() ? 5 : 0;
      const historyScore = Math.min(15, Math.round((v.hoursContributed / 200) * 10 + Number(v.rating)));
      const matchedSkills = program.requiredSkills.filter((s) => skills.includes(s.toLowerCase()));
      const rank = {
        volunteerId: v.id,
        score: skillScore + districtScore + availabilityScore + historyScore,
        reason: [
          matchedSkills.length ? `Matches ${matchedSkills.join(", ")}` : "Limited direct skill overlap",
          v.district === program.district ? `based in ${program.district}` : `registered in ${v.district ?? "another district"}`,
          v.volunteerAvailability?.trim() ? `available: ${v.volunteerAvailability}` : "availability not specified",
          `${v.hoursContributed}h contributed`,
        ].join("; "),
      };
      return serializeResult(v, rank, "rules");
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as unknown;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  throw new Error("AI response did not contain JSON.");
}

function validateAiRanks(value: unknown, volunteers: SmartMatchVolunteer[]): AiRank[] {
  if (!value || typeof value !== "object" || !("matches" in value)) return [];
  const known = new Set(volunteers.map((v) => v.id));
  const rows = (value as { matches: unknown }).matches;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is AiRank => {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return typeof r.volunteerId === "string" && known.has(r.volunteerId) && typeof r.reason === "string";
    })
    .map((row) => ({
      volunteerId: row.volunteerId,
      score: clampScore(row.score),
      reason: row.reason.slice(0, 240),
    }));
}

async function aiRanks(program: SmartMatchProgram, volunteers: SmartMatchVolunteer[]): Promise<AiRank[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const payload = {
      program: {
        title: program.title,
        description: program.description,
        category: program.category,
        district: program.district,
        requiredSkills: program.requiredSkills,
        startDate: program.startDate.toISOString().slice(0, 10),
        endDate: program.endDate.toISOString().slice(0, 10),
        slotsTotal: program.slotsTotal,
      },
      volunteers: volunteers.map((v) => ({
        volunteerId: v.id,
        district: v.district,
        skills: v.skills,
        availability: v.volunteerAvailability,
        hoursContributed: v.hoursContributed,
        programsCompleted: v.programsCompleted,
        rating: Number(v.rating),
      })),
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rank Rwanda national volunteer candidates for a coordinator. Return JSON only: {\"matches\":[{\"volunteerId\":\"...\",\"score\":0-99,\"reason\":\"short human explanation\"}]}. Prefer same district, required skill overlap, availability, verified service history, and balanced opportunity. Never invent volunteer IDs.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];
    return validateAiRanks(extractJsonObject(content), volunteers);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function smartMatchVolunteers(program: SmartMatchProgram, volunteers: SmartMatchVolunteer[]) {
  const fallback = ruleBasedRanks(program, volunteers);
  const ranks = await aiRanks(program, volunteers);
  if (!ranks.length) return fallback;

  const byId = new Map(volunteers.map((v) => [v.id, v]));
  const used = new Set<string>();
  const aiResults = ranks
    .map((rank) => {
      const volunteer = byId.get(rank.volunteerId);
      if (!volunteer) return null;
      used.add(rank.volunteerId);
      return serializeResult(volunteer, rank, "ai");
    })
    .filter((row): row is SmartMatchResult => Boolean(row))
    .sort((a, b) => b.score - a.score);

  const fill = fallback.filter((row) => !used.has(row.volunteerId));
  return [...aiResults, ...fill].slice(0, 10);
}
