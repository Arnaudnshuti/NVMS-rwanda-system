/**
 * HTTP client for NVMS backend. Active only when `VITE_API_URL` is set at build time.
 */

const envObj = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const raw = envObj.VITE_API_URL ?? envObj.REACT_APP_API_URL ?? "http://localhost:4000";
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

export async function fetchAdminProgramsFromApi(): Promise<import("./mock-data").Program[]> {
  const res = await apiFetchJson<import("./mock-data").Program[]>("/api/programs/admin/all");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function createProgramApi(body: {
  title: string;
  description: string;
  category: string;
  district: string;
  districtId?: string;
  sector?: string;
  startDate: string;
  endDate: string;
  slotsTotal: number;
  slotsFilled?: number;
  requiredSkills: string[];
  status: "open" | "in_progress" | "completed" | "draft";
}) {
  return apiFetchJson<import("./mock-data").Program>("/api/programs", { method: "POST", json: body });
}

export type ProgramMutation = Partial<{
  title: string;
  description: string;
  category: string;
  district: string;
  districtId: string;
  sector: string;
  startDate: string;
  endDate: string;
  slotsTotal: number;
  slotsFilled: number;
  requiredSkills: string[];
  status: "open" | "in_progress" | "completed" | "draft";
  coordinatorDisplayName: string;
}>;

export async function updateProgramApi(id: string, body: ProgramMutation) {
  return apiFetchJson<import("./mock-data").Program>(`/api/programs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: body,
  });
}

export async function deleteProgramApi(id: string) {
  return apiFetchJson<{ ok: true }>(`/api/programs/${encodeURIComponent(id)}`, { method: "DELETE" });
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

export type ApiCertificate = {
  id: string;
  assignmentId: string;
  volunteerName: string;
  volunteerEmail: string;
  volunteerDistrict: string;
  programId: string;
  programTitle: string;
  programDistrict: string;
  hoursServed: number;
  startDate: string;
  endDate: string;
  issuedAt: string;
  signedBy: string;
  status: "issued" | "not_eligible";
  reason: string;
};

export type ApiCertificateSummary = {
  generatedAt: string;
  policy: {
    ministryCertificateThreshold: number;
    requiresApprovedReports: boolean;
    requiresNoActiveSanctions: boolean;
  };
  eligibleForMinistryCertificate: boolean;
  completedEligibleCount: number;
  certificates: ApiCertificate[];
};

export async function fetchMyCertificatesApi() {
  return apiFetchJson<ApiCertificateSummary>("/api/me/certificates");
}

export async function downloadMyCertificateApi(assignmentId: string) {
  const token = getAccessToken();
  const url = `${nvmsApiUrl}/api/me/certificates/${encodeURIComponent(assignmentId)}/pdf`;
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, error: text || res.statusText };
    }
    return { ok: true as const, blob: await res.blob() };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Download failed" };
  }
}

export type ApiActivityLog = {
  id: string;
  volunteerId: string;
  volunteerName?: string;
  volunteerEmail?: string;
  volunteerDistrict?: string;
  programId: string;
  programTitle?: string;
  programDistrict?: string;
  date: string;
  hours: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  attachments?: Array<{ id: string; fileName: string; contentType?: string; url: string }>;
};

export async function fetchActivityLogsFromApi(): Promise<ApiActivityLog[]> {
  const res = await apiFetchJson<ApiActivityLog[]>("/api/me/activity-logs");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function submitActivityLogApi(body: {
  programId: string;
  date: string;
  hours: number;
  description: string;
  files?: File[];
}) {
  const form = new FormData();
  form.append("programId", body.programId);
  form.append("date", body.date);
  form.append("hours", String(body.hours));
  form.append("description", body.description);
  for (const f of body.files ?? []) form.append("files", f);
  return apiFetchJson<{ id: string; message: string }>("/api/me/activity-logs", { method: "POST", body: form });
}

export async function patchMyProfileApi(patch: Record<string, unknown>) {
  return apiFetchJson<Record<string, unknown>>("/api/me/profile", { method: "PATCH", json: patch });
}

export async function submitTrustProfileApi(body: Record<string, unknown>) {
  return apiFetchJson<Record<string, unknown>>("/api/me/trust-submit", { method: "POST", json: body });
}

export async function putPlatformConfigApi(body: {
  volunteerCategories: string[];
  programTypes: string[];
  organizationName?: string;
  contactEmail?: string;
  supportPhone?: string;
  featureFlags?: Record<string, boolean>;
}) {
  return apiFetchJson<{
    volunteerCategories: string[];
    programTypes: string[];
    organizationName?: string;
    contactEmail?: string;
    supportPhone?: string;
    featureFlags?: Record<string, boolean>;
  }>("/api/admin/platform-config", {
    method: "PUT",
    json: body,
  });
}

export async function getPlatformConfigApi() {
  return apiFetchJson<{
    volunteerCategories: string[];
    programTypes: string[];
    organizationName?: string;
    contactEmail?: string;
    supportPhone?: string;
    featureFlags?: Record<string, boolean>;
  }>("/api/admin/platform-config");
}

export async function getPublicPlatformConfigApi() {
  return apiFetchJson<{
    volunteerCategories: string[];
    programTypes: string[];
    organizationName?: string;
    contactEmail?: string;
    supportPhone?: string;
    featureFlags?: Record<string, boolean>;
  }>("/api/meta/platform-config");
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
  mfaResetPending?: boolean;
  govStatus?: string;
  verificationStatus?: string | null;
  profileTrustStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function adminListUsersApi() {
  return apiFetchJson<ApiUserRow[]>("/api/admin/users");
}

export async function adminUpdateUserApi(
  userId: string,
  body: {
    name?: string;
    email?: string;
    role?: "admin" | "coordinator" | "volunteer";
    phone?: string | null;
    district?: string;
    districtId?: string | null;
    govStatus?: "active" | "suspended" | "revoked";
    isActive?: boolean;
    mfaResetPending?: boolean;
    verificationStatus?: "pending" | "verified" | "rejected" | null;
    profileTrustStatus?: "unsubmitted" | "pending_review" | "verified" | "rejected" | null;
  },
) {
  return apiFetchJson<ApiUserRow>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    json: body,
  });
}

export async function adminCreateCoordinatorApi(body: {
  name: string;
  email: string;
  role?: "volunteer" | "coordinator" | "admin";
  district?: string;
  districtId?: string;
  phone?: string;
  dateOfBirth?: string;
  contactPreference?: "email" | "sms" | "both";
  verificationStatus?: "pending" | "verified" | "rejected";
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

export async function adminResendInviteApi(userId: string) {
  return apiFetchJson<{ ok: true; temporaryPassword: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/resend-invite`,
    { method: "PATCH" },
  );
}

export type ApiAuditLogRow = {
  id: string;
  actionType: string;
  actorUserId: string | null;
  actorUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  targetUserId: string | null;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

export async function adminListAuditLogsApi(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetchJson<ApiAuditLogRow[]>(`/api/admin/audit-logs${qs}`);
}

export type ApiReportSummary = {
  generatedAt: string;
  filter?: { district: string | null };
  metrics: Record<string, number>;
  byDistrict: Array<{ district: string; volunteers: number; programs?: number; applications?: number; hours?: number }>;
  programStatus?: Array<{ status: string; count: number }>;
  applicationStatus?: Array<{ status: string; count: number }>;
  categoryDistribution?: Array<{ category: string; count: number }>;
  recentApplications?: Array<{
    id: string;
    submittedAt: string;
    status: string;
    volunteerName: string;
    volunteerEmail: string;
    volunteerDistrict: string;
    programTitle: string;
    programDistrict: string;
  }>;
  recentActivity?: Array<{
    id: string;
    date: string;
    hours: number;
    status: string;
    volunteerName: string;
    volunteerDistrict: string;
    programTitle: string;
    programDistrict: string;
  }>;
  volunteerApplications?: Array<{
    id: string;
    submittedAt: string;
    reviewedAt: string | null;
    status: string;
    coordinatorNote: string | null;
    volunteerId: string;
    volunteerName: string;
    volunteerEmail: string;
    volunteerPhone: string | null;
    volunteerDistrict: string;
    volunteerVerificationStatus: string | null;
    volunteerTrustStatus: string | null;
    programId: string;
    programTitle: string;
    programCategory: string;
    programDistrict: string;
    programStatus: string;
  }>;
  programs?: Array<{
    id: string;
    title: string;
    category: string;
    district: string;
    sector?: string | null;
    status: string;
    startDate: string;
    endDate: string;
    slotsTotal: number;
    slotsFilled: number;
    applications: number;
    assignments: number;
    reports: number;
    requiredSkills: string[];
  }>;
};
export async function adminReportSummaryApi(params?: { district?: string }) {
  const qs = new URLSearchParams();
  if (params?.district && params.district !== "all") qs.set("district", params.district);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetchJson<ApiReportSummary>(`/api/admin/reports/summary${suffix}`);
}

export type ApiAdminAnalytics = {
  monthlyParticipation: Array<{ month: string; volunteers: number; hours: number }>;
  districtParticipation: Array<{ district: string; volunteers: number; programs: number; hours: number }>;
  categoryDistribution: Array<{ name: string; value: number }>;
  totals: { hours: number; districts: number };
};
export async function adminAnalyticsApi() {
  return apiFetchJson<ApiAdminAnalytics>("/api/admin/analytics");
}

export async function adminDownloadReportApi(format: "csv" | "xlsx" | "pdf" | "docx", params?: { district?: string; sections?: string[] }) {
  const token = getAccessToken();
  const qs = new URLSearchParams({ format });
  if (params?.district && params.district !== "all") qs.set("district", params.district);
  if (params?.sections?.length) qs.set("sections", params.sections.join(","));
  const url = `${nvmsApiUrl}/api/admin/reports/export?${qs.toString()}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false as const, error: txt || `Download failed (${res.status})` };
  }
  const blob = await res.blob();
  return { ok: true as const, blob };
}

export type ApiCoordinatorVolunteerRow = {
  id: string;
  name: string;
  email: string;
  district: string | null;
  phone: string | null;
  skills?: string[];
  volunteerAvailability?: string | null;
  hoursContributed?: number;
  programsCompleted?: number;
  rating?: number | string;
  verificationStatus: "pending" | "verified" | "rejected" | null;
  profileTrustStatus: string | null;
  nationalId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  trustSkillsSummary?: string | null;
  profession?: string | null;
  educationLevel?: string | null;
  identityDocuments?: Array<{
    id: string;
    label: string;
    fileName: string;
    contentType?: string;
    createdAt: string;
    url: string | null;
  }>;
  createdAt: string;
};

export type CoordinatorVolunteerMutation = Partial<{
  name: string;
  phone: string | null;
  volunteerAvailability: string | null;
  profession: string | null;
  educationLevel: string | null;
  skills: string[];
  verificationStatus: "pending" | "verified" | "rejected";
  profileTrustStatus: "unsubmitted" | "pending_review" | "verified" | "rejected";
}>;

export async function coordinatorListVolunteersApi(params?: { q?: string; verificationStatus?: string; profileTrustStatus?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.verificationStatus) qs.set("verificationStatus", params.verificationStatus);
  if (params?.profileTrustStatus) qs.set("profileTrustStatus", params.profileTrustStatus);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetchJson<ApiCoordinatorVolunteerRow[]>(`/api/coordinator/volunteers${suffix}`);
}

export async function coordinatorGetVolunteerApi(userId: string) {
  return apiFetchJson<ApiCoordinatorVolunteerRow>(`/api/coordinator/volunteers/${encodeURIComponent(userId)}`);
}

export async function coordinatorUpdateVolunteerApi(userId: string, body: CoordinatorVolunteerMutation) {
  return apiFetchJson<ApiCoordinatorVolunteerRow>(`/api/coordinator/volunteers/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    json: body,
  });
}

export async function coordinatorDeleteVolunteerApi(userId: string) {
  return apiFetchJson<{ ok: true }>(`/api/coordinator/volunteers/${encodeURIComponent(userId)}`, { method: "DELETE" });
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

export async function coordinatorPatchVolunteerTrustApi(
  userId: string,
  body: { profileTrustStatus: "verified" | "rejected" | "unsubmitted" },
) {
  return apiFetchJson<ApiCoordinatorVolunteerRow>(`/api/coordinator/volunteers/${encodeURIComponent(userId)}/trust`, {
    method: "PATCH",
    json: body,
  });
}

export type ApiCoordinatorResourceItem = {
  item: string;
  quantity: number;
  unit: string;
};

export type ApiCoordinatorResourceProgram = {
  id: string;
  title: string;
  category: string;
  district: string;
  sector?: string | null;
  status: "open" | "in_progress";
  startDate: string;
  endDate: string;
  slotsTotal: number;
  slotsFilled: number;
  assignedCount: number;
  openSlots: number;
  pendingApplications: number;
  acceptedApplications: number;
  pendingReports: number;
  approvedHours: number;
  requiredSkills: string[];
  resourceKit: ApiCoordinatorResourceItem[];
  readiness: "needs_volunteers" | "reports_pending" | "ready";
};

export type ApiCoordinatorResources = {
  generatedAt: string;
  district: string | null;
  totals: {
    activePrograms: number;
    trustedVolunteers: number;
    assignedVolunteers: number;
    openSlots: number;
    pendingReports: number;
    estimatedResourceLines: number;
  };
  programs: ApiCoordinatorResourceProgram[];
};

export async function coordinatorResourcesApi() {
  return apiFetchJson<ApiCoordinatorResources>("/api/coordinator/resources");
}

export type ApiDeployment = {
  id: string;
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string;
  volunteerDistrict?: string | null;
  programId: string;
  programTitle: string;
  district: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "upcoming";
  hoursLogged: number;
  strikes: number;
};
export async function coordinatorListDeploymentsApi() {
  return apiFetchJson<ApiDeployment[]>("/api/coordinator/deployments");
}

export async function coordinatorListActivityLogsApi() {
  return apiFetchJson<ApiActivityLog[]>("/api/coordinator/activity-logs");
}

export async function coordinatorPatchActivityLogApi(
  id: string,
  body: { status: "approved" | "rejected"; coordinatorNote?: string },
) {
  return apiFetchJson<ApiActivityLog>(`/api/coordinator/activity-logs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: body,
  });
}

export type ApiSmartMatch = {
  applicationId?: string;
  applicationStatus?: string;
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string;
  district?: string | null;
  hoursContributed: number;
  rating: number;
  skills: string[];
  score: number;
  reason: string;
  matchSource?: "ai" | "rules";
};

export async function coordinatorSmartMatchApi(programId: string) {
  return apiFetchJson<ApiSmartMatch[]>(`/api/coordinator/smart-match?programId=${encodeURIComponent(programId)}`);
}

export async function coordinatorSendMessageApi(body: {
  audience: "all" | "verified" | "pending";
  channel: "inapp" | "email" | "sms" | "all";
  subject: string;
  message: string;
}) {
  return apiFetchJson<{ queued: number }>("/api/coordinator/messages", {
    method: "POST",
    json: body,
  });
}
export async function coordinatorAssignVolunteerApi(body: {
  programId: string;
  volunteerId: string;
  startDate?: string;
  endDate?: string;
}) {
  return apiFetchJson<{ id: string; message: string }>("/api/coordinator/deployments/assign", {
    method: "POST",
    json: body,
  });
}

export type ApiDistrict = { id: string; code: string; name: string };
export async function listDistrictsApi() {
  return apiFetchJson<ApiDistrict[]>("/api/meta/districts");
}

export async function publicStatsApi() {
  return apiFetchJson<{ volunteers: number; activePrograms: number; hours: number; districts: number }>("/api/meta/public-stats");
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

export type ApiNotification = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  readAt?: string;
  createdAt: string;
  metadata?: unknown;
};

export async function listMyNotificationsApi() {
  return apiFetchJson<ApiNotification[]>("/api/me/notifications");
}

export async function markNotificationReadApi(id: string) {
  return apiFetchJson<{ ok: true }>(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export async function markAllNotificationsReadApi() {
  return apiFetchJson<{ ok: true }>("/api/me/notifications/read-all", { method: "PATCH" });
}

export async function changePasswordApi(currentPassword: string, newPassword: string) {
  return apiFetchJson<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    json: { currentPassword, newPassword },
  });
}
