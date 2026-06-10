const KEY = "nvms.platform.masterdata";

export type PlatformMasterData = {
  volunteerCategories: string[];
  programTypes: string[];
  organizationName?: string;
  contactEmail?: string;
  supportPhone?: string;
  featureFlags?: Record<string, boolean>;
};

const DEFAULT_VOLUNTEER_CATEGORIES = ["General community", "Youth mentorship", "Health auxiliary", "Education support", "Emergency response", "Agricultural extension"];

export const DEFAULT_PROGRAM_TYPES = ["Awareness campaigns", "Field deployment", "Capacity building", "Data collection / M&E"];

export function normalizeProgramCategories(value?: string[]) {
  const categories = Array.isArray(value)
    ? value.map((s) => s.trim()).filter(Boolean)
    : [];
  return categories.length ? categories : DEFAULT_PROGRAM_TYPES;
}

function readRaw(): Partial<PlatformMasterData> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<PlatformMasterData>;
  } catch {
    return {};
  }
}

export function getPlatformMasterData(): PlatformMasterData {
  const r = readRaw() ?? {};
  return {
    volunteerCategories: Array.isArray(r.volunteerCategories) && r.volunteerCategories.length
      ? r.volunteerCategories
      : DEFAULT_VOLUNTEER_CATEGORIES,
    programTypes: normalizeProgramCategories(r.programTypes),
    organizationName: typeof r.organizationName === "string" ? r.organizationName : undefined,
    contactEmail: typeof r.contactEmail === "string" ? r.contactEmail : undefined,
    supportPhone: typeof r.supportPhone === "string" ? r.supportPhone : undefined,
    featureFlags: r.featureFlags && typeof r.featureFlags === "object" && !Array.isArray(r.featureFlags)
      ? r.featureFlags as Record<string, boolean>
      : undefined,
  };
}

export function savePlatformMasterData(data: PlatformMasterData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      volunteerCategories: data.volunteerCategories.filter(Boolean),
      programTypes: data.programTypes.filter(Boolean),
      organizationName: data.organizationName,
      contactEmail: data.contactEmail,
      supportPhone: data.supportPhone,
      featureFlags: data.featureFlags ?? {},
    }),
  );
}
