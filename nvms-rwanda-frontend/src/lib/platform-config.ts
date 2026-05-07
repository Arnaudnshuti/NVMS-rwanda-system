const KEY = "nvms.platform.masterdata";

export type PlatformMasterData = {
  volunteerCategories: string[];
  programTypes: string[];
};

const DEFAULT_VOLUNTEER_CATEGORIES = ["General community", "Youth mentorship", "Health auxiliary", "Education support", "Emergency response", "Agricultural extension"];

const DEFAULT_PROGRAM_TYPES = ["Awareness campaigns", "Field deployment", "Capacity building", "Data collection / M&E"];

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
    programTypes: Array.isArray(r.programTypes) && r.programTypes.length
      ? r.programTypes
      : DEFAULT_PROGRAM_TYPES,
  };
}

export function savePlatformMasterData(data: PlatformMasterData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      volunteerCategories: data.volunteerCategories.filter(Boolean),
      programTypes: data.programTypes.filter(Boolean),
    }),
  );
}
