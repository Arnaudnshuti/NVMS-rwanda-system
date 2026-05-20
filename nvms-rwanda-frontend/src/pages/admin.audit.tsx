import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, KeyRound, Mail, Search, ShieldCheck, UserCog } from "lucide-react";
import { adminListAuditLogsApi, nvmsApiEnabled, type ApiAuditLogRow } from "@/lib/nvms-api";
import { toast } from "sonner";

const SAMPLE = [
  { id: "e1", at: "2026-05-06T09:14:22Z", actor: "Admin Nyampinga", action: "ADMIN_COORDINATOR_CREATED", target: "new-coordinator@minaloc.gov.rw", detail: "Coordinator account created and invite email prepared." },
  { id: "e2", at: "2026-05-06T09:05:11Z", actor: "District Coordinator", action: "COORDINATOR_VOLUNTEER_APPROVED", target: "new-volunteer@mail.rw", detail: "Volunteer profile approved for participation." },
  { id: "e3", at: "2026-05-05T08:02:51Z", actor: "Admin Demo", action: "AUTH_LOGIN_SUCCESS", target: "Admin portal", detail: "Successful sign-in to the administration dashboard." },
];

const ACTION_COPY: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info"; icon: typeof ShieldCheck }> = {
  AUTH_LOGIN_SUCCESS: { label: "Successful sign-in", tone: "success", icon: CheckCircle2 },
  AUTH_LOGIN_FAILURE: { label: "Failed sign-in attempt", tone: "danger", icon: AlertTriangle },
  AUTH_PASSWORD_CHANGED: { label: "Password changed", tone: "warning", icon: KeyRound },
  ADMIN_COORDINATOR_CREATED: { label: "Coordinator account created", tone: "info", icon: UserCog },
  ADMIN_PASSWORD_RESET: { label: "Password reset", tone: "warning", icon: KeyRound },
  COORDINATOR_VOLUNTEER_APPROVED: { label: "Volunteer approved", tone: "success", icon: ShieldCheck },
  COORDINATOR_VOLUNTEER_REJECTED: { label: "Volunteer rejected", tone: "danger", icon: AlertTriangle },
  EMAIL_SENT: { label: "Email sent", tone: "info", icon: Mail },
};

type DisplayRow = {
  id: string;
  timestamp: string;
  actor: string;
  actorSubtext: string;
  actionType: string;
  actionLabel: string;
  target: string;
  detail: string;
  source: string;
  tone: "success" | "warning" | "danger" | "info";
  Icon: typeof ShieldCheck;
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metadataText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatAuditTime(value: string | null | undefined) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(user: ApiAuditLogRow["actorUser"] | ApiAuditLogRow["targetUser"], fallbackId?: string | null) {
  if (user?.name) return user.name;
  if (user?.email) return user.email;
  return fallbackId ? `User ${fallbackId.slice(0, 8)}` : "";
}

function userSubtext(user: ApiAuditLogRow["actorUser"] | ApiAuditLogRow["targetUser"]) {
  if (!user) return "";
  return [user.email, user.role].filter(Boolean).join(" - ");
}

function describeAudit(row: ApiAuditLogRow): DisplayRow {
  const meta = metadataObject(row.metadata);
  const copy = ACTION_COPY[row.actionType] ?? {
    label: row.actionType.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "info" as const,
    icon: ShieldCheck,
  };
  const email = textValue(meta.email);
  const to = textValue(meta.to);
  const reason = textValue(meta.reason).replaceAll("_", " ");
  const role = textValue(meta.role);
  const actor = userLabel(row.actorUser, row.actorUserId) || email || "System";
  const target = userLabel(row.targetUser, row.targetUserId) || to || email || "System event";
  const detailByAction: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: role ? `Signed in as ${role}.` : "Signed in successfully.",
    AUTH_LOGIN_FAILURE: reason ? `Sign-in blocked: ${reason}.` : "Sign-in was not successful.",
    AUTH_PASSWORD_CHANGED: "The user's password was changed.",
    ADMIN_COORDINATOR_CREATED: role ? `New ${role} account was provisioned.` : "New staff account was provisioned.",
    ADMIN_PASSWORD_RESET: "Temporary credentials were generated for the user.",
    COORDINATOR_VOLUNTEER_APPROVED: "Volunteer can now access approved opportunities.",
    COORDINATOR_VOLUNTEER_REJECTED: "Volunteer approval request was rejected.",
    EMAIL_SENT: to ? `Message delivered to ${to}.` : "A system email was sent.",
  };

  return {
    id: row.id,
    timestamp: formatAuditTime(row.createdAt),
    actor,
    actorSubtext: userSubtext(row.actorUser),
    actionType: row.actionType,
    actionLabel: copy.label,
    target,
    detail: detailByAction[row.actionType] ?? (metadataText(row.metadata) || "Audit event recorded."),
    source: [row.ip, row.userAgent ? row.userAgent.split(" ")[0] : ""].filter(Boolean).join(" - ") || "No device details",
    tone: copy.tone,
    Icon: copy.icon,
  };
}

function sampleToDisplay(row: (typeof SAMPLE)[number]): DisplayRow {
  const copy = ACTION_COPY[row.action] ?? { label: row.action, tone: "info" as const, icon: ShieldCheck };
  return {
    id: row.id,
    timestamp: formatAuditTime(row.at),
    actor: row.actor,
    actorSubtext: "Sample data",
    actionType: row.action,
    actionLabel: copy.label,
    target: row.target,
    detail: row.detail,
    source: "Demo record",
    tone: copy.tone,
    Icon: copy.icon,
  };
}

function toneClass(tone: DisplayRow["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function AdminAuditPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const apiOn = nvmsApiEnabled();
  const [apiRows, setApiRows] = useState<ApiAuditLogRow[] | null>(null);

  useEffect(() => {
    if (!apiOn) return;
    let alive = true;
    setLoading(true);
    setLoadError("");
    adminListAuditLogsApi()
      .then((r) => {
        if (!alive) return;
        if (!r.ok) {
          setLoadError(r.error);
          toast.error(r.error);
          return;
        }
        setApiRows(r.data);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Failed to load audit logs";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apiOn]);

  const displayRows = useMemo(
    () => (apiOn && apiRows ? apiRows.map(describeAudit) : SAMPLE.map(sampleToDisplay)),
    [apiOn, apiRows],
  );

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return displayRows;
    return displayRows.filter((row) =>
      [row.actor, row.actorSubtext, row.actionLabel, row.actionType, row.target, row.detail, row.source].some((value) =>
        value.toLowerCase().includes(t),
      ),
    );
  }, [displayRows, q]);

  const stats = useMemo(
    () => ({
      total: displayRows.length,
      signIns: displayRows.filter((row) => row.actionType.startsWith("AUTH_LOGIN")).length,
      people: displayRows.filter((row) => row.actionType.includes("VOLUNTEER") || row.actionType.includes("COORDINATOR")).length,
      alerts: displayRows.filter((row) => row.tone === "danger" || row.tone === "warning").length,
    }),
    [displayRows],
  );

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Audit log"
        description="Review important security and account activity in plain language."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total events</CardDescription>
            <CardTitle className="text-2xl">{loading ? "..." : stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sign-in activity</CardDescription>
            <CardTitle className="text-2xl">{loading ? "..." : stats.signIns}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>People changes</CardDescription>
            <CardTitle className="text-2xl">{loading ? "..." : stats.people}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Needs attention</CardDescription>
            <CardTitle className="text-2xl">{loading ? "..." : stats.alerts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>
              {apiOn ? "Showing database audit events with readable names and context." : "Showing sample activity because the API is not configured."}
            </CardDescription>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, target..." />
          </div>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
          ) : loading ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">Loading audit activity...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">No audit events match your search.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-[260px]">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-md border p-2 ${toneClass(row.tone)}`}>
                          <row.Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{row.actionLabel}</span>
                            <Badge variant="outline" className={toneClass(row.tone)}>
                              {row.tone === "danger" ? "Attention" : row.tone}
                            </Badge>
                          </div>
                          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{row.detail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.actor}</div>
                      {row.actorSubtext ? <div className="text-xs text-muted-foreground">{row.actorSubtext}</div> : null}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.target}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{row.timestamp}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{row.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}
