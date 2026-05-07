import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VOLUNTEERS, type DemoUser, type Volunteer, type VolunteerStatus } from "@/lib/mock-data";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth, dispatchAuthRefresh } from "@/lib/auth";
import { listAccountsForLogin, patchRegistryUserByEmail, readRegistry } from "@/lib/account-registry";
import { canCoordinatorVerifyVolunteer, coordinatorDistrictScope } from "@/lib/portal-access";
import { effectiveVolunteerStatus, setVolunteerStatusOverride } from "@/lib/volunteer-status-overrides";
import {
  coordinatorListVolunteersApi,
  coordinatorPatchVolunteerVerificationApi,
  nvmsApiEnabled,
  type ApiCoordinatorVolunteerRow,
} from "@/lib/nvms-api";

const statusColor: Record<VolunteerStatus, string> = {
  verified: "border-success/30 bg-success/10 text-success",
  pending: "border-warning/30 bg-warning/15 text-warning-foreground",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  suspended: "bg-muted text-muted-foreground",
};

function approvalNoticeDescription(contact?: string) {
  if (contact === "sms") return "SMS would be sent (basic phone / no smartphone) once the SMS gateway is connected.";
  if (contact === "email") return "Email would be sent once the mail service is connected.";
  return "Email and SMS would be sent according to the volunteer’s chosen preference once messaging is connected.";
}

function VolunteersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [version, setVersion] = useState(0);
  const apiOn = nvmsApiEnabled();
  const [apiRows, setApiRows] = useState<ApiCoordinatorVolunteerRow[] | null>(null);
  const [apiBusy, setApiBusy] = useState(false);

  const rows = useMemo(() => {
    if (apiOn && apiRows) {
      return apiRows.map(
        (u): Volunteer => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          district: u.district ?? "—",
          skills: [] as string[],
          availability: "—",
          status: (u.verificationStatus ?? "pending") as VolunteerStatus,
          joinedAt: (u.createdAt ?? new Date().toISOString()).slice(0, 10),
          hoursContributed: 0,
          programsCompleted: 0,
          rating: 0,
        }),
      );
    }

    const baseEmails = new Set(VOLUNTEERS.map((v) => v.email.toLowerCase()));
    const base: Volunteer[] = VOLUNTEERS.map((v) => ({
      ...v,
      status: effectiveVolunteerStatus(v.id, v.status),
    }));
    const regExtras: Volunteer[] = readRegistry()
      .filter(
        (u) =>
          u.role === "volunteer" &&
          (u.verificationStatus ?? "pending") === "pending" &&
          !baseEmails.has(u.email.toLowerCase()),
      )
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? "",
        district: u.district ?? "—",
        skills: [] as string[],
        availability: "—",
        status: "pending" as const,
        joinedAt: new Date().toISOString().slice(0, 10),
        hoursContributed: 0,
        programsCompleted: 0,
        rating: 0,
      }));
    return [...base, ...regExtras];
  }, [apiOn, apiRows, version]);

  useEffect(() => {
    if (!apiOn) return;
    setApiBusy(true);
    coordinatorListVolunteersApi({
      q: q.trim() || undefined,
      verificationStatus: status !== "all" ? status : undefined,
    })
      .then((r) => {
        setApiBusy(false);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setApiRows(r.data);
      })
      .catch((e) => {
        setApiBusy(false);
        toast.error(e instanceof Error ? e.message : "Failed to load volunteers");
      });
  }, [apiOn, q, status, version]);

  const scope = coordinatorDistrictScope(user);
  const districtFiltered = useMemo(() => {
    if (scope === null) return rows;
    if (scope.length === 0) return [];
    return rows.filter((r) => scope.includes(r.district));
  }, [rows, scope]);

  const list = districtFiltered
    .filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase()) || v.district.toLowerCase().includes(q.toLowerCase()) || v.email.toLowerCase().includes(q.toLowerCase()))
    .filter((v) => status === "all" || v.status === status);

  const bump = () => setVersion((n) => n + 1);

  const trustQueue = useMemo(() => {
    return listAccountsForLogin().filter(
      (u): u is DemoUser =>
        u.role === "volunteer" &&
        (u.verificationStatus ?? "") === "verified" &&
        u.profileTrustStatus === "pending_review" &&
        Boolean(u.district) &&
        Boolean(user && canCoordinatorVerifyVolunteer(user, u.district!)),
    );
  }, [user, version]);

  const approveTrust = (u: DemoUser) => {
    if (!user || !u.district || !canCoordinatorVerifyVolunteer(user, u.district)) return;
    const ok = patchRegistryUserByEmail(u.email, { profileTrustStatus: "verified" });
    if (!ok) {
      toast.error("Could not update this record (demo KYC is stored only for self-registered accounts).");
      return;
    }
    bump();
    dispatchAuthRefresh();
    toast.success(`${u.name} marked as trusted volunteer`, {
      description: "They may now apply to programs in NVMS. Notifications will send when messaging is connected.",
    });
  };

  const rejectTrust = (u: DemoUser) => {
    if (!user || !u.district || !canCoordinatorVerifyVolunteer(user, u.district)) return;
    const ok = patchRegistryUserByEmail(u.email, { profileTrustStatus: "rejected" });
    if (!ok) {
      toast.error("Could not update this record.");
      return;
    }
    bump();
    dispatchAuthRefresh();
    toast.message(`${u.name} — trusted profile not approved`);
  };

  const verify = (v: Volunteer) => {
    if (!user || !canCoordinatorVerifyVolunteer(user, v.district)) return;
    if (apiOn) {
      setApiBusy(true);
      coordinatorPatchVolunteerVerificationApi(v.id, { verificationStatus: "verified" })
        .then((r) => {
          setApiBusy(false);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          bump();
          toast.success(`${v.name} verified`, {
            description: "Volunteer approval email is sent automatically.",
          });
        })
        .catch((e) => {
          setApiBusy(false);
          toast.error(e instanceof Error ? e.message : "Failed to update volunteer");
        });
      return;
    }
    const reg = readRegistry().find((u) => u.email.toLowerCase() === v.email.toLowerCase());
    const patched = patchRegistryUserByEmail(v.email, {
      verificationStatus: "verified",
      profileTrustStatus: "unsubmitted",
    });
    if (!patched) setVolunteerStatusOverride(v.id, "verified");
    bump();
    dispatchAuthRefresh();
    toast.success(`${v.name} verified`, {
      description: approvalNoticeDescription(reg?.contactPreference === "both" ? undefined : reg?.contactPreference),
    });
  };

  const reject = (v: Volunteer) => {
    if (!user || !canCoordinatorVerifyVolunteer(user, v.district)) return;
    if (apiOn) {
      setApiBusy(true);
      coordinatorPatchVolunteerVerificationApi(v.id, { verificationStatus: "rejected" })
        .then((r) => {
          setApiBusy(false);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          bump();
          toast.message(`${v.name} not approved`, {
            description: "A notification email is sent automatically when messaging is connected.",
          });
        })
        .catch((e) => {
          setApiBusy(false);
          toast.error(e instanceof Error ? e.message : "Failed to update volunteer");
        });
      return;
    }
    const patched = patchRegistryUserByEmail(v.email, { verificationStatus: "rejected" });
    if (!patched) setVolunteerStatusOverride(v.id, "rejected");
    bump();
    dispatchAuthRefresh();
    toast.message(`${v.name} not approved`, {
      description: "A notice would be sent by email or SMS according to the volunteer’s preference when messaging is connected.",
    });
  };

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Volunteers"
        description="Each district coordinator only sees and approves volunteers who registered in that same district. MINALOC admins can review nationwide."
      />

      {user?.role === "coordinator" && scope && scope.length > 0 && (
        <Alert className="mb-5 border-border bg-muted/40">
          <AlertTitle>Your district office</AlertTitle>
          <AlertDescription>
            You manage registrations, trusted identity (KYC), and related actions for <strong>{scope[0]}</strong> only — not for volunteers from other districts.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-5">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or district…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Volunteer</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Skills</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((v) => {
              const canAct = user ? canCoordinatorVerifyVolunteer(user, v.district) : false;
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs text-primary">{v.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.district}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.skills.slice(0, 2).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      {v.skills.length > 2 && <Badge variant="outline" className="text-[10px]">+{v.skills.length - 2}</Badge>}
                      {v.skills.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{v.hoursContributed}h</TableCell>
                  <TableCell className="text-sm">{v.rating > 0 ? v.rating.toFixed(1) : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor[v.status]}>{v.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {v.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canAct || apiBusy}
                          title={!canAct ? "Outside your assigned districts — only MINALOC or the responsible coordinator may act." : undefined}
                          onClick={() => reject(v)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          disabled={!canAct || apiBusy}
                          title={!canAct ? "Outside your assigned districts." : undefined}
                          onClick={() => verify(v)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={true} title="Volunteer profile view is not implemented yet.">
                        View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Trusted profile reviews</CardTitle>
          <p className="text-sm text-muted-foreground">
            Volunteers who submitted ID, photo, and skills for KYC. Approve only after district-level checks to limit fraud.
          </p>
        </CardHeader>
        <CardContent>
          {trustQueue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No documents awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {trustQueue.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4"
                >
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email} · {u.district}</div>
                    {u.nationalId && <div className="mt-1 text-xs">National ID (submitted): <span className="font-mono">{u.nationalId}</span></div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => rejectTrust(u)}>Reject KYC</Button>
                    <Button size="sm" onClick={() => approveTrust(u)}>Approve trusted profile</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default VolunteersPage;
