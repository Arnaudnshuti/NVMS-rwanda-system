/**
 * HTTP client for NVMS backend. Active only when `VITE_API_URL` is set at build time.
 */

const envObj = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const raw = envObj.VITE_API_URL ?? envObj.REACT_APP_API_URL;
export const nvmsApiUrl = typeof raw === "string" ? raw.replace(/\/$/, "") : "";

export function nvmsApiEnabled(): boolean {
  return nvmsApiUrl.length > 0;
}

const TOKEN_KEY = "nvms.auth.token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined = init?.body as BodyInit | undefined;
  if (init && "json" in init && init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const url = path.startsWith("http") ? path : `${nvmsApiUrl}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, { ...init, headers, body });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: res.status, error: text || res.statusText };
    }

    if (!res.ok) {
      const msg =
        parsed &&
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : res.statusText;
      return { ok: false, status: res.status, error: msg };
    }

    return { ok: true, data: parsed as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, status: 0, error: msg };
  }
}

export async function fetchProgramsFromApi(): Promise<import("./mock-data").Program[]> {
  const res = await apiFetchJson<import("./mock-data").Program[]>("/api/programs");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function createProgramApi(body: {
  title: string;
  description: string;
  category: string;
  district: string;
  sector?: string;
  startDate: string;
  endDate: string;
  slotsTotal: number;
  requiredSkills: string[];
  status: "open" | "in_progress" | "completed" | "draft";
}) {
  return apiFetchJson<import("./mock-data").Program>("/api/programs", { method: "POST", json: body });
}

export async function fetchMyApplicationsFromApi(): Promise<import("./program-applications").ProgramApplication[]> {
  const res = await apiFetchJson<import("./program-applications").ProgramApplication[]>("/api/applications");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function submitApplicationApi(programId: string) {
  return apiFetchJson<import("./program-applications").ProgramApplication>("/api/applications", {
    method: "POST",
    json: { programId },
  });
}

export async function patchApplicationApi(
  id: string,
  patch: { status: import("./program-applications").ApplicationStatus; coordinatorNote?: string },
) {
  return apiFetchJson<import("./program-applications").ProgramApplication>(`/api/applications/${id}`, {
    method: "PATCH",
    json: patch,
  });
}

export type ApiAssignment = {
  id: string;
  volunteerId: string;
  programId: string;
  programTitle: string;
  district: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "upcoming";
  hoursLogged: number;
};

export async function fetchMyAssignmentsFromApi(): Promise<ApiAssignment[]> {
  const res = await apiFetchJson<ApiAssignment[]>("/api/me/assignments");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export type ApiActivityLog = {
  id: string;
  volunteerId: string;
  programId: string;
  date: string;
  hours: number;
  description: string;
  status: "pending" | "approved" | "rejected";
};

export async function fetchActivityLogsFromApi(): Promise<ApiActivityLog[]> {
  const res = await apiFetchJson<ApiActivityLog[]>("/api/me/activity-logs");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function patchMyProfileApi(patch: Record<string, unknown>) {
  return apiFetchJson<Record<string, unknown>>("/api/me/profile", { method: "PATCH", json: patch });
}

export async function submitTrustProfileApi(body: Record<string, unknown>) {
  return apiFetchJson<Record<string, unknown>>("/api/me/trust-submit", { method: "POST", json: body });
}

export async function putPlatformConfigApi(body: { volunteerCategories: string[]; programTypes: string[] }) {
  return apiFetchJson<{ volunteerCategories: string[]; programTypes: string[] }>("/api/admin/platform-config", {
    method: "PUT",
    json: body,
  });
}

export type ApiUserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "coordinator" | "volunteer";
  district?: string | null;
  phone?: string | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  govStatus?: string;
  verificationStatus?: string | null;
  profileTrustStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function adminListUsersApi() {
  return apiFetchJson<ApiUserRow[]>("/api/admin/users");
}

export async function adminCreateCoordinatorApi(body: {
  name: string;
  email: string;
  district: string;
  phone?: string;
}) {
  return apiFetchJson<{ user: ApiUserRow; temporaryPassword: string }>("/api/admin/users", {
    method: "POST",
    json: body,
  });
}

export async function adminResetPasswordApi(userId: string) {
  return apiFetchJson<{ user: { id: string; email: string; mustChangePassword: boolean }; temporaryPassword: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/reset-password`,
    { method: "PATCH", json: {} },
  );
}

export async function adminActivateUserApi(userId: string) {
  return apiFetchJson<{ id: string; email: string; isActive: boolean; govStatus: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/activate`,
    { method: "PATCH" },
  );
}

export async function adminDeactivateUserApi(userId: string) {
  return apiFetchJson<{ id: string; email: string; isActive: boolean; govStatus: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/deactivate`,
    { method: "PATCH" },
  );
}

export type ApiAuditLogRow = {
  id: string;
  actionType: string;
  actorUserId: string | null;
  targetUserId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

export async function adminListAuditLogsApi(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetchJson<ApiAuditLogRow[]>(`/api/admin/audit-logs${qs}`);
}

export type ApiCoordinatorVolunteerRow = {
  id: string;
  name: string;
  email: string;
  district: string | null;
  phone: string | null;
  verificationStatus: "pending" | "verified" | "rejected" | null;
  profileTrustStatus: string | null;
  createdAt: string;
};

export async function coordinatorListVolunteersApi(params?: { q?: string; verificationStatus?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.verificationStatus) qs.set("verificationStatus", params.verificationStatus);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetchJson<ApiCoordinatorVolunteerRow[]>(`/api/coordinator/volunteers${suffix}`);
}

export async function coordinatorPatchVolunteerVerificationApi(
  userId: string,
  body: { verificationStatus: "verified" | "rejected" },
) {
  return apiFetchJson<ApiCoordinatorVolunteerRow>(`/api/coordinator/volunteers/${encodeURIComponent(userId)}/verification`, {
    method: "PATCH",
    json: body,
  });
}

export type ApiDistrict = { id: string; code: string; name: string };
export async function listDistrictsApi() {
  return apiFetchJson<ApiDistrict[]>("/api/meta/districts");
}

export async function uploadMyAvatarApi(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetchJson<{ avatarUrl: string | null }>("/api/me/avatar", { method: "POST", body: form });
}

export type ApiIdentityDocument = {
  id: string;
  label: string;
  fileName: string;
  storageKey: string | null;
  contentType: string | null;
  createdAt: string;
  url: string | null;
};

export async function uploadIdentityDocumentApi(label: string, file: File) {
  const form = new FormData();
  form.append("label", label);
  form.append("file", file);
  return apiFetchJson<ApiIdentityDocument>("/api/me/identity-documents", { method: "POST", body: form });
}

export async function listMyIdentityDocumentsApi() {
  return apiFetchJson<ApiIdentityDocument[]>("/api/me/identity-documents");
}

export async function changePasswordApi(currentPassword: string, newPassword: string) {
  return apiFetchJson<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    json: { currentPassword, newPassword },
  });
}
