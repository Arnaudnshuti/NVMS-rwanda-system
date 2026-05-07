/** Demo admin-managed user overrides (district, suspend, MFA reset flag) stored in browser. */

export type AdminManagedUserRecord = {
  id: string;
  name: string;
  email: string;
  role: "volunteer" | "coordinator" | "admin";
  district?: string;
  status: "active" | "suspended" | "revoked";
  mfaResetPending?: boolean;
};

const KEY = "nvms.admin.user-overrides";

function readRaw(): Record<string, Partial<Omit<AdminManagedUserRecord, "id">>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Partial<Omit<AdminManagedUserRecord, "id">>>) : {};
  } catch {
    return {};
  }
}

function writeRaw(m: Record<string, Partial<Omit<AdminManagedUserRecord, "id">>>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(m));
}

export function getUserOverride(userId: string): Partial<Omit<AdminManagedUserRecord, "id">> {
  return readRaw()[userId] ?? {};
}

export function upsertUserOverride(userId: string, patch: Partial<Omit<AdminManagedUserRecord, "id">>) {
  const m = readRaw();
  m[userId] = { ...m[userId], ...patch };
  writeRaw(m);
}
