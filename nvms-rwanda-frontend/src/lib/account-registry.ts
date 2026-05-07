import { DEMO_USERS, type DemoUser } from "./mock-data";

const REGISTRY_KEY = "nvms.registry.users";

export function readRegistry(): DemoUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DemoUser[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(users: DemoUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(users));
}

/** Self-registered volunteers (and future invited accounts) stored client-side until a backend exists. */
export function upsertRegistryUser(user: DemoUser) {
  const list = readRegistry().filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
  list.push(user);
  writeRegistry(list);
}

/** Demo accounts first; registry entries override same email; remaining registry users appended. */
export function listAccountsForLogin(): DemoUser[] {
  const registry = readRegistry();
  const regByEmail = new Map(registry.map((u) => [u.email.toLowerCase(), u]));
  const mergedDemo = DEMO_USERS.map((d) => regByEmail.get(d.email.toLowerCase()) ?? d);
  const demoEmails = new Set(DEMO_USERS.map((d) => d.email.toLowerCase()));
  const extra = registry.filter((r) => !demoEmails.has(r.email.toLowerCase()));
  return [...mergedDemo, ...extra];
}

export function patchRegistryUserByEmail(email: string, patch: Partial<DemoUser>): boolean {
  const list = readRegistry();
  const i = list.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (i === -1) return false;
  list[i] = { ...list[i], ...patch };
  writeRegistry(list);
  return true;
}

/** Pending self-registrations (for coordinator verification queues). */
export function readRegistryVolunteersPending(): DemoUser[] {
  return readRegistry().filter(
    (u) => u.role === "volunteer" && (u.verificationStatus ?? "pending") === "pending",
  );
}
