import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { adminListAuditLogsApi, nvmsApiEnabled, type ApiAuditLogRow } from "@/lib/nvms-api";
import { toast } from "sonner";

/** Synthetic audit rows until backend persists AuditEvent streams. */

const SAMPLE = [
  { id: "e1", at: "2026-05-06T09:14:22Z", actor: "a.nyampinga@gov.rw", action: "user.invited", target: "new-coordinator@minaloc.gov.rw" },
  { id: "e2", at: "2026-05-06T09:05:11Z", actor: "coordinator@demo.rw", action: "volunteer.verified", target: "new-volunteer@mail.rw" },
  { id: "e3", at: "2026-05-05T16:41:03Z", actor: "coordinator@demo.rw", action: "kyc.approved", target: "new-volunteer@mail.rw" },
  { id: "e4", at: "2026-05-05T08:02:51Z", actor: "admin@demo.rw", action: "report.export", target: "monthly-national-v2.pdf" },
  { id: "e5", at: "2026-05-04T21:33:07Z", actor: "system", action: "notification.sms.sent", target: "+250788*** — deployment reminder" },
];

export default function AdminAuditPage() {
  const [q, setQ] = useState("");
  const apiOn = nvmsApiEnabled();
  const [apiRows, setApiRows] = useState<ApiAuditLogRow[] | null>(null);
  const rows = apiOn && apiRows ? apiRows : SAMPLE;

  useEffect(() => {
    if (!apiOn) return;
    let alive = true;
    adminListAuditLogsApi()
      .then((r) => {
        if (!alive) return;
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setApiRows(r.data);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load audit logs"));
    return () => {
      alive = false;
    };
  }, [apiOn]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return rows;
    if (apiOn && apiRows) {
      return apiRows.filter((r) => {
        const meta = typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata ?? "");
        return (
          r.actionType.toLowerCase().includes(t) ||
          (r.actorUserId ?? "").toLowerCase().includes(t) ||
          (r.targetUserId ?? "").toLowerCase().includes(t) ||
          meta.toLowerCase().includes(t)
        );
      });
    }
    return SAMPLE.filter(
      (row) =>
        row.actor.toLowerCase().includes(t) ||
        row.action.toLowerCase().includes(t) ||
        row.target.toLowerCase().includes(t),
    );
  }, [q]);

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Audit log"
        description={
          apiOn
            ? "Security-relevant audit events stored in the database (login, provisioning, password changes, approvals)."
            : "Search security-relevant actions (invite, verification, exports, MFA reset). Entries below are illustrative; backend will stream immutable audit events."
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
          <CardDescription>Use your authentication service SIEM feeds in production.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action, or target…" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiOn && apiRows
                ? (filtered as ApiAuditLogRow[]).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.createdAt).toISOString().replace("T", " ").replace("Z", " UTC")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{row.actorUserId ?? "system"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.actionType}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {row.targetUserId ?? (typeof row.metadata === "string" ? row.metadata : JSON.stringify(row.metadata ?? ""))}
                      </TableCell>
                    </TableRow>
                  ))
                : (filtered as typeof SAMPLE).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">{row.at.replace("T", " ").replace("Z", " UTC")}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{row.actor}</TableCell>
                      <TableCell className="font-mono text-xs">{row.action}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{row.target}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
