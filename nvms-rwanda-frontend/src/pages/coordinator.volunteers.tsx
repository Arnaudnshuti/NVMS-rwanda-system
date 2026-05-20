import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VOLUNTEERS, type DemoUser, type Volunteer, type VolunteerStatus } from "@/lib/mock-data";
import { Search, CheckCircle2, XCircle, FileText, ExternalLink, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, dispatchAuthRefresh } from "@/lib/auth";
import { listAccountsForLogin, patchRegistryUserByEmail, readRegistry } from "@/lib/account-registry";
import { canCoordinatorVerifyVolunteer, coordinatorDistrictScope } from "@/lib/portal-access";
import { effectiveVolunteerStatus, setVolunteerStatusOverride } from "@/lib/volunteer-status-overrides";
import {
  coordinatorListVolunteersApi,
  coordinatorDeleteVolunteerApi,
  coordinatorGetVolunteerApi,
  coordinatorPatchVolunteerTrustApi,
  coordinatorPatchVolunteerVerificationApi,
  coordinatorUpdateVolunteerApi,
  nvmsApiEnabled,
  type ApiCoordinatorVolunteerRow,
  type CoordinatorVolunteerMutation,
} from "@/lib/nvms-api";

const statusColor: Record<VolunteerStatus, string> = {
  verified: "border-success/30 bg-success/10 text-success",
  pending: "border-warning/30 bg-warning/15 text-warning-foreground",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  suspended: "bg-muted text-muted-foreground",
};

const trustStatusColor: Record<string, string> = {
  verified: "border-success/30 bg-success/10 text-success",
  pending_review: "border-warning/30 bg-warning/15 text-warning-foreground",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  unsubmitted: "bg-muted text-muted-foreground",
};

function trustLabel(value?: string | null) {
  if (!value) return "unsubmitted";
  return value.replace(/_/g, " ");
}

function approvalNoticeDescription(contact?: string) {
  if (contact === "sms") return "SMS would be sent (basic phone / no smartphone) once the SMS gateway is connected.";
  if (contact === "email") return "Email would be sent once the mail service is connected.";
  return "Email and SMS would be sent according to the volunteer’s chosen preference once messaging is connected.";
}

function VolunteersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [trustStatus, setTrustStatus] = useState<string>("all");
  const [reviewQ, setReviewQ] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string>("all");
  const [version, setVersion] = useState(0);
  const apiOn = nvmsApiEnabled();
  const [apiRows, setApiRows] = useState<ApiCoordinatorVolunteerRow[] | null>(null);
  const [apiBusy, setApiBusy] = useState(false);
  const [reviewing, setReviewing] = useState<ApiCoordinatorVolunteerRow | DemoUser | null>(null);
  const [details, setDetails] = useState<ApiCoordinatorVolunteerRow | null>(null);
  const [editing, setEditing] = useState<ApiCoordinatorVolunteerRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Volunteer | null>(null);
  const [editForm, setEditForm] = useState<VolunteerEditForm | null>(null);

  const rows = useMemo(() => {
    if (apiOn && apiRows) {
      return apiRows.map(
        (u): Volunteer => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          district: u.district ?? "—",
          skills: u.skills ?? [],
          availability: u.volunteerAvailability ?? "—",
          status: (u.verificationStatus ?? "pending") as VolunteerStatus,
          joinedAt: (u.createdAt ?? new Date().toISOString()).slice(0, 10),
          hoursContributed: u.hoursContributed ?? 0,
          programsCompleted: u.programsCompleted ?? 0,
          rating: Number(u.rating ?? 0),
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

  const loadVolunteers = useCallback(() => {
    if (!apiOn) return Promise.resolve();
    setApiBusy(true);
    return coordinatorListVolunteersApi({
      q: q.trim() || undefined,
      verificationStatus: status !== "all" ? status : undefined,
      profileTrustStatus: trustStatus !== "all" ? trustStatus : undefined,
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
  }, [apiOn, q, status, trustStatus]);

  useEffect(() => {
    void loadVolunteers();
  }, [loadVolunteers, version]);

  const scope = coordinatorDistrictScope(user);
  const districtFiltered = useMemo(() => {
    if (scope === null) return rows;
    if (scope.length === 0) return [];
    return rows.filter((r) => scope.includes(r.district));
  }, [rows, scope]);

  const list = districtFiltered
    .filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase()) || v.district.toLowerCase().includes(q.toLowerCase()) || v.email.toLowerCase().includes(q.toLowerCase()))
    .filter((v) => status === "all" || v.status === status);

  const rowById = useMemo(() => new Map((apiRows ?? []).map((row) => [row.id, row])), [apiRows]);

  const bump = () => setVersion((n) => n + 1);

  const loadVolunteerProfile = async (v: Volunteer) => {
    if (!apiOn) {
      toast.error("Volunteer profile actions need the backend connection.");
      return null;
    }
    setApiBusy(true);
    const res = await coordinatorGetVolunteerApi(v.id);
    setApiBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.data;
  };

  const openDetails = async (v: Volunteer) => {
    const row = await loadVolunteerProfile(v);
    if (row) setDetails(row);
  };

  const openEdit = async (v: Volunteer) => {
    const row = await loadVolunteerProfile(v);
    if (!row) return;
    setEditing(row);
    setEditForm(editFormFromVolunteer(row));
  };

  const saveVolunteer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    const body: CoordinatorVolunteerMutation = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      volunteerAvailability: editForm.availability.trim() || null,
      profession: editForm.profession.trim() || null,
      educationLevel: editForm.educationLevel.trim() || null,
      skills: parseSkillText(editForm.skills),
      verificationStatus: editForm.verificationStatus,
      profileTrustStatus: editForm.profileTrustStatus,
    };
    if (!body.name) {
      toast.error("Volunteer name is required.");
      return;
    }
    setApiBusy(true);
    const res = await coordinatorUpdateVolunteerApi(editing.id, body);
    setApiBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Volunteer updated.");
    setEditing(null);
    setEditForm(null);
    bump();
  };

  const deleteVolunteer = async () => {
    if (!pendingDelete) return;
    if (!apiOn) {
      toast.error("Delete needs the backend connection.");
      return;
    }
    setApiBusy(true);
    const res = await coordinatorDeleteVolunteerApi(pendingDelete.id);
    setApiBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Volunteer deleted.");
    setPendingDelete(null);
    bump();
  };

  const trustReviews = useMemo(() => {
    if (apiOn) {
      return (apiRows ?? [])
        .filter((u) => u.verificationStatus === "verified")
        .filter((u) => ["pending_review", "verified", "rejected"].includes(u.profileTrustStatus ?? ""))
        .filter((u) => reviewStatus === "all" || u.profileTrustStatus === reviewStatus)
        .filter((u) => {
          const needle = reviewQ.trim().toLowerCase();
          if (!needle) return true;
          return [u.name, u.email, u.district ?? "", u.nationalId ?? ""].some((value) => value.toLowerCase().includes(needle));
        })
        .map(
          (u): DemoUser => ({
            id: u.id,
            name: u.name,
            email: u.email,
            password: "",
            role: "volunteer",
            district: u.district ?? undefined,
            phone: u.phone ?? undefined,
            nationalId: u.nationalId ?? undefined,
            emergencyContactName: u.emergencyContactName ?? undefined,
            emergencyContactPhone: u.emergencyContactPhone ?? undefined,
            trustSkillsSummary: u.trustSkillsSummary ?? undefined,
            profession: u.profession ?? undefined,
            educationLevel: u.educationLevel ?? undefined,
            identityDocuments: u.identityDocuments?.map((d) => ({
              id: d.id,
              label: d.label,
              fileName: d.fileName,
              url: d.url,
            })) ?? undefined,
            verificationStatus: u.verificationStatus ?? undefined,
            profileTrustStatus: (u.profileTrustStatus ?? "unsubmitted") as DemoUser["profileTrustStatus"],
          }),
        );
    }
    return listAccountsForLogin().filter(
      (u): u is DemoUser =>
        u.role === "volunteer" &&
        (u.verificationStatus ?? "") === "verified" &&
        ["pending_review", "verified", "rejected"].includes(u.profileTrustStatus ?? "") &&
        (reviewStatus === "all" || u.profileTrustStatus === reviewStatus) &&
        (!reviewQ.trim() ||
          [u.name, u.email, u.district ?? "", u.nationalId ?? ""].some((value) => value.toLowerCase().includes(reviewQ.trim().toLowerCase()))) &&
        Boolean(u.district) &&
        Boolean(user && canCoordinatorVerifyVolunteer(user, u.district!)),
    );
  }, [apiOn, apiRows, reviewQ, reviewStatus, user, version]);

  const approveTrust = (u: DemoUser) => {
    if (!user || !u.district || !canCoordinatorVerifyVolunteer(user, u.district)) return;
    if (apiOn) {
      setApiBusy(true);
      coordinatorPatchVolunteerTrustApi(u.id, { profileTrustStatus: "verified" })
        .then((r) => {
          setApiBusy(false);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          bump();
          toast.success(`${u.name} marked as trusted volunteer`, {
            description: "They may now apply to programs in NVMS.",
          });
        })
        .catch((e) => {
          setApiBusy(false);
          toast.error(e instanceof Error ? e.message : "Failed to update trusted profile");
        });
      return;
    }
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
    if (apiOn) {
      setApiBusy(true);
      coordinatorPatchVolunteerTrustApi(u.id, { profileTrustStatus: "rejected" })
        .then((r) => {
          setApiBusy(false);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          bump();
          toast.message(`${u.name} - trusted profile not approved`);
        })
        .catch((e) => {
          setApiBusy(false);
          toast.error(e instanceof Error ? e.message : "Failed to update trusted profile");
        });
      return;
    }
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
          <Select value={trustStatus} onValueChange={setTrustStatus}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Trusted profile" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trust statuses</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="verified">Trusted</SelectItem>
              <SelectItem value="rejected">Trust rejected</SelectItem>
              <SelectItem value="unsubmitted">Unsubmitted</SelectItem>
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
              <TableHead>Status</TableHead>
              <TableHead>Trusted profile</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((v) => {
              const canAct = user ? canCoordinatorVerifyVolunteer(user, v.district) : false;
              const apiRow = rowById.get(v.id);
              const trust = apiRow?.profileTrustStatus ?? "unsubmitted";
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
                  <TableCell><Badge variant="outline" className={statusColor[v.status]}>{v.status}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={trustStatusColor[trust] ?? "bg-muted text-muted-foreground"}>
                      {trustLabel(trust)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={apiBusy} title="View volunteer profile" onClick={() => void openDetails(v)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!canAct || apiBusy}
                        title={!canAct ? "Outside your assigned districts." : "Edit volunteer profile"}
                        onClick={() => void openEdit(v)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {v.status === "pending" && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={!canAct || apiBusy}
                            title={!canAct ? "Outside your assigned districts." : "Reject volunteer"}
                            onClick={() => reject(v)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            disabled={!canAct || apiBusy}
                            title={!canAct ? "Outside your assigned districts." : "Verify volunteer"}
                            onClick={() => verify(v)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        disabled={!canAct || apiBusy}
                        title={!canAct ? "Outside your assigned districts." : "Delete volunteer"}
                        onClick={() => setPendingDelete(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={reviewQ} onChange={(e) => setReviewQ(e.target.value)} placeholder="Search trusted profiles..." className="pl-9" />
            </div>
            <Select value={reviewStatus} onValueChange={setReviewStatus}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Review status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reviews</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="verified">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trustReviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No trusted profile reviews match these filters.</p>
          ) : (
            <div className="space-y-3">
              {trustReviews.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{u.name}</div>
                      <Badge variant="outline" className={trustStatusColor[u.profileTrustStatus ?? "unsubmitted"] ?? "bg-muted text-muted-foreground"}>
                        {trustLabel(u.profileTrustStatus)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email} · {u.district}</div>
                    {u.nationalId && <div className="mt-1 text-xs">National ID (submitted): <span className="font-mono">{u.nationalId}</span></div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setReviewing(u)}>
                      <FileText className="mr-1.5 h-4 w-4" /> Review documents
                    </Button>
                    {u.profileTrustStatus === "pending_review" && (
                      <>
                        <Button size="sm" variant="outline" disabled={apiBusy} onClick={() => rejectTrust(u)}>
                          Reject
                        </Button>
                        <Button size="sm" disabled={apiBusy || !(u.identityDocuments ?? []).some((doc) => doc.url)} onClick={() => approveTrust(u)}>
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(details)} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{details?.name ?? "Volunteer profile"}</DialogTitle>
            <DialogDescription>Live profile details from the backend volunteer record.</DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewField label="Email" value={details.email} />
                <ReviewField label="Phone" value={details.phone ?? "Not set"} />
                <ReviewField label="District" value={details.district ?? "Not set"} />
                <ReviewField label="Availability" value={details.volunteerAvailability ?? "Not set"} />
                <ReviewField label="Verification" value={details.verificationStatus ?? "pending"} />
                <ReviewField label="Trusted profile" value={trustLabel(details.profileTrustStatus)} />
                <ReviewField label="Profession" value={details.profession ?? "Not submitted"} />
                <ReviewField label="Education" value={details.educationLevel ?? "Not submitted"} />
                <ReviewField label="Approved hours" value={`${details.hoursContributed ?? 0}h`} />
                <ReviewField label="Completed programs" value={String(details.programsCompleted ?? 0)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Skills</div>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-border/60 p-3">
                  {(details.skills ?? []).length ? (
                    (details.skills ?? []).map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)
                  ) : (
                    <span className="text-sm text-muted-foreground">No skills recorded.</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Submitted documents</div>
                <div className="space-y-2">
                  {(details.identityDocuments ?? []).length ? (
                    (details.identityDocuments ?? []).map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3">
                        <div>
                          <div className="font-medium">{doc.label}</div>
                          <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                        </div>
                        {doc.url ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={doc.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                            </a>
                          </Button>
                        ) : (
                          <Badge variant="outline">Metadata only</Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No submitted documents found for this volunteer.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit volunteer</DialogTitle>
            <DialogDescription>Update the real volunteer profile saved in the backend.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <form className="space-y-4" onSubmit={saveVolunteer}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Availability</Label>
                  <Input value={editForm.availability} onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })} placeholder="Weekends, weekdays, emergency only" />
                </div>
                <div>
                  <Label>Profession</Label>
                  <Input value={editForm.profession} onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })} />
                </div>
                <div>
                  <Label>Education level</Label>
                  <Input value={editForm.educationLevel} onChange={(e) => setEditForm({ ...editForm, educationLevel: e.target.value })} />
                </div>
                <div>
                  <Label>Verification</Label>
                  <Select value={editForm.verificationStatus} onValueChange={(verificationStatus) => setEditForm({ ...editForm, verificationStatus: verificationStatus as VolunteerEditForm["verificationStatus"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trusted profile</Label>
                  <Select value={editForm.profileTrustStatus} onValueChange={(profileTrustStatus) => setEditForm({ ...editForm, profileTrustStatus: profileTrustStatus as VolunteerEditForm["profileTrustStatus"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unsubmitted">Unsubmitted</SelectItem>
                      <SelectItem value="pending_review">Pending review</SelectItem>
                      <SelectItem value="verified">Trusted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Skills</Label>
                  <Textarea rows={4} value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} placeholder="Teaching, First aid, Logistics" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditing(null); setEditForm(null); }}>Cancel</Button>
                <Button type="submit" disabled={apiBusy}>{apiBusy ? "Saving..." : "Save changes"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this volunteer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{pendingDelete?.name}</strong> and remove their applications, assignments, reports, notifications, and submitted documents from the backend database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <div className="font-medium text-destructive">This action cannot be undone.</div>
            <div className="mt-1 text-muted-foreground">Use this only for wrong or duplicate volunteer records.</div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apiBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={apiBusy}
              onClick={(e) => {
                e.preventDefault();
                void deleteVolunteer();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {apiBusy ? "Deleting..." : "Delete volunteer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review trusted profile documents</DialogTitle>
            <DialogDescription>
              Inspect submitted identity details and attachments before approving or rejecting trusted status.
            </DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewField label="Volunteer" value={reviewing.name} />
                <ReviewField label="District" value={reviewing.district ?? "Not set"} />
                <ReviewField label="Email" value={reviewing.email} />
                <ReviewField label="Phone" value={reviewing.phone ?? "Not set"} />
                <ReviewField label="National ID" value={reviewing.nationalId ?? "Not submitted"} />
                <ReviewField label="Emergency contact" value={`${reviewing.emergencyContactName ?? "Not set"}${reviewing.emergencyContactPhone ? ` / ${reviewing.emergencyContactPhone}` : ""}`} />
                <ReviewField label="Profession" value={reviewing.profession ?? "Not submitted"} />
                <ReviewField label="Education" value={reviewing.educationLevel ?? "Not submitted"} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Skills and experience</div>
                <div className="rounded-md border border-border/60 p-3 text-sm">
                  {reviewing.trustSkillsSummary ?? "Not submitted"}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Submitted documents</div>
                <div className="space-y-2">
                  {(reviewing.identityDocuments ?? []).length ? (
                    (reviewing.identityDocuments ?? []).map((doc, idx) => {
                      const docUrl = "url" in doc && typeof doc.url === "string" ? doc.url : "";
                      return (
                        <div key={`${doc.label}-${doc.fileName}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3">
                          <div>
                            <div className="font-medium">{doc.label}</div>
                            <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                          </div>
                          {docUrl ? (
                            <Button size="sm" variant="outline" asChild>
                              <a href={docUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                              </a>
                            </Button>
                          ) : (
                            <Badge variant="outline">Metadata only</Badge>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No submitted documents found for this volunteer.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setReviewing(null)}>Close</Button>
            {reviewing?.profileTrustStatus === "pending_review" && (
              <div className="flex gap-2">
                <Button variant="destructive" disabled={apiBusy} onClick={() => { rejectTrust(reviewing as DemoUser); setReviewing(null); }}>
                  Reject KYC
                </Button>
                <Button disabled={apiBusy || !(reviewing.identityDocuments ?? []).some((doc) => doc.url)} onClick={() => { approveTrust(reviewing as DemoUser); setReviewing(null); }}>
                  Approve trusted profile
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

type VolunteerEditForm = {
  name: string;
  phone: string;
  availability: string;
  profession: string;
  educationLevel: string;
  skills: string;
  verificationStatus: "pending" | "verified" | "rejected";
  profileTrustStatus: "unsubmitted" | "pending_review" | "verified" | "rejected";
};

function editFormFromVolunteer(row: ApiCoordinatorVolunteerRow): VolunteerEditForm {
  return {
    name: row.name,
    phone: row.phone ?? "",
    availability: row.volunteerAvailability ?? "",
    profession: row.profession ?? "",
    educationLevel: row.educationLevel ?? "",
    skills: (row.skills ?? []).join(", "),
    verificationStatus: row.verificationStatus ?? "pending",
    profileTrustStatus: (row.profileTrustStatus ?? "unsubmitted") as VolunteerEditForm["profileTrustStatus"],
  };
}

function parseSkillText(value: string) {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export default VolunteersPage;
