import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.service.js";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth.middleware.js";
import { writeAudit } from "../services/audit.service.js";
import { sendTemplatedEmail } from "../services/email/mailer.js";
import { createNotification } from "../services/notification.service.js";
import { publicUploadUrl } from "../services/uploads.service.js";
import { smartMatchVolunteers } from "../services/smart-match.service.js";

export const coordinatorRouter = Router();

coordinatorRouter.use(requireAuth, requireRoles("admin", "coordinator"));

const volunteerSelect = {
  id: true,
  name: true,
  email: true,
  district: true,
  phone: true,
  skills: true,
  volunteerAvailability: true,
  hoursContributed: true,
  programsCompleted: true,
  rating: true,
  verificationStatus: true,
  profileTrustStatus: true,
  nationalId: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  trustSkillsSummary: true,
  profession: true,
  educationLevel: true,
  createdAt: true,
  identityDocuments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      fileName: true,
      storageKey: true,
      contentType: true,
      createdAt: true,
    },
  },
} as const;

function serializeVolunteerRow(u: {
  id: string;
  rating: unknown;
  hoursContributed: number;
  programsCompleted: number;
  identityDocuments: {
    id: string;
    label: string;
    fileName: string;
    storageKey: string | null;
    contentType: string | null;
    createdAt: Date;
  }[];
}) {
  return {
    ...u,
    rating: Number(u.rating),
    identityDocuments: u.identityDocuments.map((d) => ({
      id: d.id,
      label: d.label,
      fileName: d.fileName,
      contentType: d.contentType ?? undefined,
      createdAt: d.createdAt.toISOString(),
      url: d.storageKey ? publicUploadUrl(d.storageKey) : null,
    })),
  };
}

async function loadScopedVolunteer(req: AuthRequest, userId: string) {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return { status: 401 as const, error: "Unauthorized" };
  const volunteer = await prisma.user.findUnique({
    where: { id: userId },
    select: volunteerSelect,
  });
  if (!volunteer) return { status: 404 as const, error: "Volunteer not found" };
  if (me.role === "coordinator" && (!me.district || volunteer.district !== me.district)) {
    return { status: 403 as const, error: "You may only manage volunteers in your district." };
  }
  return { status: 200 as const, me, volunteer };
}

coordinatorRouter.get("/volunteers", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.verificationStatus === "string" ? req.query.verificationStatus : "";
  const trustStatus = typeof req.query.profileTrustStatus === "string" ? req.query.profileTrustStatus : "";

  const districtWhere =
    me.role === "coordinator" && me.district ? { district: me.district } : {};

  const users = await prisma.user.findMany({
    where: {
      role: "volunteer",
      ...districtWhere,
      ...(status ? { verificationStatus: status as "pending" | "verified" | "rejected" } : {}),
      ...(trustStatus ? { profileTrustStatus: trustStatus as "unsubmitted" | "pending_review" | "verified" | "rejected" } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: volunteerSelect,
  });

  const ids = users.map((u) => u.id);
  const [approvedHours, completedAssignments] = await Promise.all([
    ids.length
      ? prisma.activityLog.groupBy({
          by: ["volunteerId"],
          where: { volunteerId: { in: ids }, status: "approved" },
          _sum: { hours: true },
        })
      : [],
    ids.length
      ? prisma.assignment.groupBy({
          by: ["volunteerId"],
          where: { volunteerId: { in: ids }, status: "completed" },
          _count: { _all: true },
        })
      : [],
  ]);
  const hoursByVolunteer = new Map(approvedHours.map((row) => [row.volunteerId, Math.round(Number(row._sum.hours ?? 0))]));
  const completedByVolunteer = new Map(completedAssignments.map((row) => [row.volunteerId, row._count._all]));

  res.json(users.map((u) => ({
    ...serializeVolunteerRow(u),
    hoursContributed: hoursByVolunteer.get(u.id) ?? u.hoursContributed,
    programsCompleted: completedByVolunteer.get(u.id) ?? u.programsCompleted,
  })));
});

coordinatorRouter.get("/volunteers/:userId", async (req: AuthRequest, res) => {
  const scoped = await loadScopedVolunteer(req, req.params.userId);
  if (scoped.status !== 200) return res.status(scoped.status).json({ error: scoped.error });
  res.json(serializeVolunteerRow(scoped.volunteer));
});

const volunteerUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().nullable().optional(),
  volunteerAvailability: z.string().trim().nullable().optional(),
  profession: z.string().trim().nullable().optional(),
  educationLevel: z.string().trim().nullable().optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  verificationStatus: z.enum(["pending", "verified", "rejected"]).optional(),
  profileTrustStatus: z.enum(["unsubmitted", "pending_review", "verified", "rejected"]).optional(),
});

coordinatorRouter.patch("/volunteers/:userId", async (req: AuthRequest, res) => {
  const parsed = volunteerUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const scoped = await loadScopedVolunteer(req, req.params.userId);
  if (scoped.status !== 200) return res.status(scoped.status).json({ error: scoped.error });

  const data = parsed.data;
  const updated = await prisma.user.update({
    where: { id: scoped.volunteer.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.volunteerAvailability !== undefined ? { volunteerAvailability: data.volunteerAvailability || null } : {}),
      ...(data.profession !== undefined ? { profession: data.profession || null } : {}),
      ...(data.educationLevel !== undefined ? { educationLevel: data.educationLevel || null } : {}),
      ...(data.skills !== undefined ? { skills: data.skills } : {}),
      ...(data.verificationStatus !== undefined
        ? { verificationStatus: data.verificationStatus, ...(data.verificationStatus === "verified" ? { isActive: true } : {}) }
        : {}),
      ...(data.profileTrustStatus !== undefined ? { profileTrustStatus: data.profileTrustStatus } : {}),
    },
    select: volunteerSelect,
  });

  await createNotification({
    userId: updated.id,
    type: "INFO",
    title: "Volunteer profile updated",
    message: "Your coordinator updated your volunteer profile record.",
    metadata: { updatedBy: req.userId },
  });

  res.json(serializeVolunteerRow(updated));
});

coordinatorRouter.delete("/volunteers/:userId", async (req: AuthRequest, res) => {
  const scoped = await loadScopedVolunteer(req, req.params.userId);
  if (scoped.status !== 200) return res.status(scoped.status).json({ error: scoped.error });

  await prisma.user.delete({ where: { id: scoped.volunteer.id } });
  res.json({ ok: true });
});

const verifySchema = z.object({
  verificationStatus: z.enum(["verified", "rejected"]),
});

coordinatorRouter.patch("/volunteers/:userId/verification", async (req: AuthRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== "volunteer") {
    return res.status(404).json({ error: "Volunteer not found" });
  }
  if (me.role === "coordinator") {
    if (!me.district || target.district !== me.district) {
      return res.status(403).json({ error: "You may only verify volunteers in your district." });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      verificationStatus: parsed.data.verificationStatus,
      ...(parsed.data.verificationStatus === "verified" ? { isActive: true } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      district: true,
      verificationStatus: true,
      profileTrustStatus: true,
    },
  });

  const link = process.env.SYSTEM_LOGIN_LINK ?? "http://localhost:5173/login";
  if (parsed.data.verificationStatus === "verified") {
    await writeAudit("COORDINATOR_VOLUNTEER_APPROVED", {
      actorUserId: req.userId,
      targetUserId: updated.id,
      req,
      metadata: { email: updated.email, district: updated.district },
    });
    await sendTemplatedEmail({
      templateId: "volunteer_approved",
      to: updated.email,
      actorUserId: req.userId,
      targetUserId: updated.id,
      vars: {
        name: updated.name,
        email: updated.email,
        link,
        role: "volunteer",
      },
    });
    await createNotification({
      userId: updated.id,
      type: "SUCCESS",
      title: "Registration approved",
      message: "Your volunteer registration has been approved. You can now sign in.",
      metadata: { verificationStatus: "verified" },
    });
  } else {
    await writeAudit("COORDINATOR_VOLUNTEER_REJECTED", {
      actorUserId: req.userId,
      targetUserId: updated.id,
      req,
      metadata: { email: updated.email, district: updated.district },
    });
    await createNotification({
      userId: updated.id,
      type: "WARNING",
      title: "Registration not approved",
      message: "Your volunteer registration was not approved. Contact your district coordinator.",
      metadata: { verificationStatus: "rejected" },
    });
  }

  res.json(updated);
});

const trustSchema = z.object({
  profileTrustStatus: z.enum(["verified", "rejected", "unsubmitted"]),
});

coordinatorRouter.patch("/volunteers/:userId/trust", async (req: AuthRequest, res) => {
  const parsed = trustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== "volunteer") {
    return res.status(404).json({ error: "Volunteer not found" });
  }
  if (me.role === "coordinator") {
    if (!me.district || target.district !== me.district) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { profileTrustStatus: parsed.data.profileTrustStatus },
    select: {
      id: true,
      name: true,
      email: true,
      district: true,
      verificationStatus: true,
      profileTrustStatus: true,
    },
  });

  res.json(updated);
});

function categoryResourceKit(category: string, slotsTotal: number, requiredSkills: string[]) {
  const categoryKey = category.toLowerCase();
  const groupCount = Math.max(1, Math.ceil(slotsTotal / 10));
  const base = [
    { item: "Volunteer briefing sheets", quantity: slotsTotal, unit: "copies" },
    { item: "Attendance and field report forms", quantity: Math.max(slotsTotal, groupCount * 5), unit: "copies" },
    { item: "Coordinator contact sheet", quantity: groupCount, unit: "packs" },
  ];
  const categoryItems =
    categoryKey.includes("health")
      ? [
          { item: "First aid kit", quantity: groupCount, unit: "kits" },
          { item: "Protective gloves", quantity: slotsTotal * 2, unit: "pairs" },
        ]
      : categoryKey.includes("education")
        ? [
            { item: "Learning material pack", quantity: groupCount, unit: "packs" },
            { item: "Stationery bundle", quantity: slotsTotal, unit: "sets" },
          ]
        : categoryKey.includes("environment")
          ? [
              { item: "Reusable gloves", quantity: slotsTotal, unit: "pairs" },
              { item: "Collection sacks", quantity: slotsTotal * 2, unit: "bags" },
            ]
          : categoryKey.includes("agriculture")
            ? [
                { item: "Field tool set", quantity: groupCount, unit: "sets" },
                { item: "Demonstration material", quantity: groupCount, unit: "packs" },
              ]
            : categoryKey.includes("emergency")
              ? [
                  { item: "Emergency response checklist", quantity: slotsTotal, unit: "copies" },
                  { item: "Safety vest", quantity: slotsTotal, unit: "units" },
                ]
              : [{ item: "Community outreach material", quantity: groupCount, unit: "packs" }];

  const skillItems = requiredSkills
    .filter((skill) => /first aid|medical|health/i.test(skill))
    .slice(0, 1)
    .map(() => ({ item: "Medical referral cards", quantity: groupCount, unit: "packs" }));

  return [...base, ...categoryItems, ...skillItems];
}

coordinatorRouter.get("/resources", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const programWhere =
    me.role === "coordinator"
      ? { district: me.district ?? "__NO_COORDINATOR_DISTRICT__" }
      : {};

  const programs = await prisma.program.findMany({
    where: {
      ...programWhere,
      status: { in: ["open", "in_progress"] },
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      district: true,
      sector: true,
      status: true,
      startDate: true,
      endDate: true,
      slotsTotal: true,
      slotsFilled: true,
      requiredSkills: true,
    },
  });

  const programIds = programs.map((p) => p.id);
  const [assignments, applications, pendingReports, approvedReports, trustedVolunteers] = await Promise.all([
    programIds.length
      ? prisma.assignment.groupBy({
          by: ["programId"],
          where: { programId: { in: programIds }, status: { in: ["active", "upcoming"] } },
          _count: { _all: true },
        })
      : [],
    programIds.length
      ? prisma.programApplication.groupBy({
          by: ["programId", "status"],
          where: { programId: { in: programIds } },
          _count: { _all: true },
        })
      : [],
    programIds.length
      ? prisma.activityLog.groupBy({
          by: ["programId"],
          where: { programId: { in: programIds }, status: "pending" },
          _count: { _all: true },
        })
      : [],
    programIds.length
      ? prisma.activityLog.groupBy({
          by: ["programId"],
          where: { programId: { in: programIds }, status: "approved" },
          _sum: { hours: true },
        })
      : [],
    prisma.user.count({
      where: {
        role: "volunteer",
        isActive: true,
        verificationStatus: "verified",
        profileTrustStatus: "verified",
        ...(me.role === "coordinator" && me.district ? { district: me.district } : {}),
      },
    }),
  ]);

  const assignedByProgram = new Map(assignments.map((row) => [row.programId, row._count._all]));
  const pendingReportsByProgram = new Map(pendingReports.map((row) => [row.programId, row._count._all]));
  const approvedHoursByProgram = new Map(approvedReports.map((row) => [row.programId, Number(row._sum.hours ?? 0)]));
  const appByProgram = new Map<string, Record<string, number>>();
  for (const row of applications) {
    const current = appByProgram.get(row.programId) ?? {};
    current[row.status] = row._count._all;
    appByProgram.set(row.programId, current);
  }

  const rows = programs.map((p) => {
    const assignedCount = assignedByProgram.get(p.id) ?? 0;
    const apps = appByProgram.get(p.id) ?? {};
    const openSlots = Math.max(0, p.slotsTotal - assignedCount);
    const pendingReportsCount = pendingReportsByProgram.get(p.id) ?? 0;
    const readiness =
      openSlots > 0
        ? "needs_volunteers"
        : pendingReportsCount > 0
          ? "reports_pending"
          : "ready";

    return {
      id: p.id,
      title: p.title,
      category: p.category,
      district: p.district,
      sector: p.sector,
      status: p.status,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      slotsTotal: p.slotsTotal,
      slotsFilled: p.slotsFilled,
      assignedCount,
      openSlots,
      pendingApplications: (apps.submitted ?? 0) + (apps.under_review ?? 0) + (apps.waitlisted ?? 0),
      acceptedApplications: apps.accepted ?? 0,
      pendingReports: pendingReportsCount,
      approvedHours: Math.round(approvedHoursByProgram.get(p.id) ?? 0),
      requiredSkills: p.requiredSkills,
      resourceKit: categoryResourceKit(p.category, p.slotsTotal, p.requiredSkills),
      readiness,
    };
  });

  res.json({
    generatedAt: new Date().toISOString(),
    district: me.role === "coordinator" ? me.district : null,
    totals: {
      activePrograms: rows.length,
      trustedVolunteers,
      assignedVolunteers: rows.reduce((sum, row) => sum + row.assignedCount, 0),
      openSlots: rows.reduce((sum, row) => sum + row.openSlots, 0),
      pendingReports: rows.reduce((sum, row) => sum + row.pendingReports, 0),
      estimatedResourceLines: rows.reduce((sum, row) => sum + row.resourceKit.length, 0),
    },
    programs: rows,
  });
});

coordinatorRouter.get("/smart-match", async (req: AuthRequest, res) => {
  const programId = typeof req.query.programId === "string" ? req.query.programId : "";
  if (!programId) return res.status(400).json({ error: "programId is required" });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return res.status(404).json({ error: "Program not found" });
  if (me.role === "coordinator" && (!me.district || program.district !== me.district)) {
    return res.status(403).json({ error: "You can only match volunteers for programs in your district." });
  }

  const assigned = await prisma.assignment.findMany({
    where: { programId: program.id, status: { in: ["active", "upcoming"] } },
    select: { volunteerId: true },
  });
  const assignedIds = new Set(assigned.map((a) => a.volunteerId));

  const applications = await prisma.programApplication.findMany({
    where: {
      programId: program.id,
      status: { in: ["submitted", "under_review", "waitlisted"] },
      volunteer: {
        isActive: true,
        verificationStatus: "verified",
        profileTrustStatus: "verified",
        ...(me.role === "coordinator" ? { district: program.district } : {}),
      },
    },
    select: {
      id: true,
      status: true,
      volunteer: {
        select: {
          id: true,
          name: true,
          email: true,
          district: true,
          skills: true,
          volunteerAvailability: true,
          hoursContributed: true,
          programsCompleted: true,
          rating: true,
        },
      },
    },
  });

  const applicationByVolunteer = new Map(applications.map((a) => [a.volunteer.id, { id: a.id, status: a.status }]));
  const candidates = applications.map((a) => a.volunteer).filter((v) => !assignedIds.has(v.id));
  const matches = await smartMatchVolunteers(program, candidates);
  res.json(
    matches.map((m) => {
      const app = applicationByVolunteer.get(m.volunteerId);
      return { ...m, applicationId: app?.id, applicationStatus: app?.status };
    }),
  );
});

const messageSchema = z.object({
  audience: z.enum(["all", "verified", "pending"]),
  channel: z.enum(["inapp", "email", "sms", "all"]),
  subject: z.string().min(1),
  message: z.string().min(1),
});

coordinatorRouter.post("/messages", async (req: AuthRequest, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const recipients = await prisma.user.findMany({
    where: {
      role: "volunteer",
      ...(me.role === "coordinator" && me.district ? { district: me.district } : {}),
      ...(parsed.data.audience === "verified"
        ? { verificationStatus: "verified" }
        : parsed.data.audience === "pending"
          ? { verificationStatus: "pending" }
          : {}),
    },
    select: { id: true },
  });

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        userId: r.id,
        type: "INFO",
        title: parsed.data.subject,
        message: parsed.data.message,
        metadata: { channel: parsed.data.channel, sentBy: req.userId },
      }),
    ),
  );

  res.status(201).json({ queued: recipients.length });
});

coordinatorRouter.get("/deployments", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const where =
    me.role === "coordinator"
      ? { program: me.district ? { district: me.district } : { coordinatorUserId: me.id } }
      : undefined;
  const list = await prisma.assignment.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      volunteer: { select: { id: true, name: true, email: true, district: true } },
      program: { select: { id: true, title: true, district: true } },
    },
  });
  res.json(
    list.map((a) => ({
      id: a.id,
      volunteerId: a.volunteerId,
      volunteerName: a.volunteer.name,
      volunteerEmail: a.volunteer.email,
      volunteerDistrict: a.volunteer.district,
      programId: a.programId,
      programTitle: a.programTitle,
      district: a.district,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      status: a.status,
      hoursLogged: a.hoursLogged,
      strikes: a.strikes,
    })),
  );
});

const assignSchema = z.object({
  programId: z.string().min(1),
  volunteerId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function serializeActivityLog(l: {
  id: string;
  volunteerId: string;
  programId: string;
  date: Date;
  hours: unknown;
  description: string;
  status: string;
  volunteer: { name: string; email: string; district: string | null };
  program: { title: string; district: string; coordinatorUserId: string | null };
  attachments: { id: string; fileName: string; storageKey: string; contentType: string | null }[];
}) {
  return {
    id: l.id,
    volunteerId: l.volunteerId,
    volunteerName: l.volunteer.name,
    volunteerEmail: l.volunteer.email,
    volunteerDistrict: l.volunteer.district ?? undefined,
    programId: l.programId,
    programTitle: l.program.title,
    programDistrict: l.program.district,
    date: l.date.toISOString().slice(0, 10),
    hours: Number(l.hours),
    description: l.description,
    status: l.status,
    attachments: l.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType ?? undefined,
      url: publicUploadUrl(a.storageKey),
    })),
  };
}

coordinatorRouter.get("/activity-logs", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const list = await prisma.activityLog.findMany({
    where:
      me.role === "coordinator"
        ? { program: me.district ? { district: me.district } : { coordinatorUserId: me.id } }
        : undefined,
    orderBy: { date: "desc" },
    take: 300,
    include: {
      volunteer: { select: { name: true, email: true, district: true } },
      program: { select: { title: true, district: true, coordinatorUserId: true } },
      attachments: {
        select: { id: true, fileName: true, storageKey: true, contentType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json(list.map(serializeActivityLog));
});

const activityReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  coordinatorNote: z.string().optional(),
});

coordinatorRouter.patch("/activity-logs/:id", async (req: AuthRequest, res) => {
  const parsed = activityReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const existing = await prisma.activityLog.findUnique({
    where: { id: req.params.id },
    include: { program: true, volunteer: { select: { name: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Report not found" });
  if (me.role === "coordinator" && (!me.district || existing.program.district !== me.district)) {
    return res.status(403).json({ error: "You can only review reports for programs in your district." });
  }

  const updated = await prisma.activityLog.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
    include: {
      volunteer: { select: { name: true, email: true, district: true } },
      program: { select: { title: true, district: true, coordinatorUserId: true } },
      attachments: { select: { id: true, fileName: true, storageKey: true, contentType: true } },
    },
  });

  if (parsed.data.status === "approved") {
    await prisma.assignment.updateMany({
      where: { volunteerId: updated.volunteerId, programId: updated.programId },
      data: { hoursLogged: { increment: Math.round(Number(updated.hours)) } },
    });
  }

  await createNotification({
    userId: updated.volunteerId,
    type: parsed.data.status === "approved" ? "SUCCESS" : "WARNING",
    title: parsed.data.status === "approved" ? "Activity report approved" : "Activity report returned",
    message:
      parsed.data.status === "approved"
        ? `Your report for ${updated.program.title} was approved.`
        : parsed.data.coordinatorNote || `Your report for ${updated.program.title} was returned for correction.`,
    metadata: { activityLogId: updated.id, programId: updated.programId, status: parsed.data.status },
  });

  res.json(serializeActivityLog(updated));
});

coordinatorRouter.post("/deployments/assign", async (req: AuthRequest, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const program = await prisma.program.findUnique({ where: { id: parsed.data.programId } });
  if (!program) return res.status(404).json({ error: "Program not found" });
  if (me.role === "coordinator" && (!me.district || program.district !== me.district)) {
    return res.status(403).json({ error: "You can only assign volunteers to programs in your district." });
  }
  const volunteer = await prisma.user.findUnique({ where: { id: parsed.data.volunteerId } });
  if (!volunteer || volunteer.role !== "volunteer") return res.status(404).json({ error: "Volunteer not found" });
  if (volunteer.profileTrustStatus !== "verified" || volunteer.verificationStatus !== "verified") {
    return res.status(400).json({ error: "Volunteer must be verified and trusted before assignment." });
  }
  if (me.role === "coordinator" && volunteer.district !== program.district) {
    return res.status(403).json({ error: "You can only assign volunteers from the program district." });
  }
  const exists = await prisma.assignment.findFirst({
    where: { programId: program.id, volunteerId: volunteer.id, status: { in: ["active", "upcoming"] } },
  });
  if (exists) return res.status(409).json({ error: "Volunteer already assigned to this program." });
  const assignedCount = await prisma.assignment.count({
    where: { programId: program.id, status: { in: ["active", "upcoming"] } },
  });
  if (assignedCount >= program.slotsTotal) {
    return res.status(400).json({ error: "This program has reached deployment capacity." });
  }

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : program.startDate;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : program.endDate;
  const assignment = await prisma.assignment.create({
    data: {
      volunteerId: volunteer.id,
      programId: program.id,
      programTitle: program.title,
      district: program.district,
      startDate,
      endDate,
      status: startDate > new Date() ? "upcoming" : "active",
    },
  });
  await createNotification({
    userId: volunteer.id,
    type: "INFO",
    title: "Program assignment",
    message: `You were assigned to ${program.title}.`,
    metadata: { assignmentId: assignment.id, programId: program.id },
  });
  res.status(201).json({ id: assignment.id, message: "Volunteer assigned" });
});
