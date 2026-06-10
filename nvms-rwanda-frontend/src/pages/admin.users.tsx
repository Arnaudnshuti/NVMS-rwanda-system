import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  adminListUsersApi,
  adminResetPasswordApi,
  adminUpdateUserApi,
  listDistrictsApi,
  type ApiDistrict,
} from "@/lib/nvms-api";
import { limitRwandaPhoneInput, validateRwandaPhone } from "@/lib/validation";

type ManagedRole = "volunteer" | "coordinator" | "admin";
type AccessStatus = "active" | "suspended" | "revoked";
type VolunteerVerification = "pending" | "verified" | "rejected";
type TrustStatus = "unsubmitted" | "pending_review" | "verified" | "rejected";

type AdminManagedUserRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: ManagedRole;
  district?: string | null;
  status: AccessStatus;
  isActive?: boolean;
  mfaResetPending?: boolean;
  verificationStatus?: VolunteerVerification | null;
  profileTrustStatus?: TrustStatus | null;
};

type ManageDraft = {
  name: string;
  email: string;
  phone: string;
  role: ManagedRole;
  district: string;
  accessStatus: AccessStatus;
  mfaResetPending: boolean;
  verificationStatus: VolunteerVerification;
  profileTrustStatus: TrustStatus;
};

function UsersPage() {
  const [rows, setRows] = useState<AdminManagedUserRecord[]>([]);
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [dlg, setDlg] = useState<AdminManagedUserRecord | null>(null);
  const [draft, setDraft] = useState<ManageDraft | null>(null);

  const filteredRows = useMemo(() => rows, [rows]);
  const pageTitle = "Users & Roles";
  const pageDescription = "Register volunteers, invite staff, assign roles and districts, grant or revoke access, and manage account recovery.";

  const statusBadgeCls = (s: AccessStatus) =>
    s === "active"
      ? "border-success/30 bg-success/10 text-success"
      : s === "suspended"
        ? "border-warning/30 bg-warning/15 text-warning-foreground"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const r = await adminListUsersApi();
    setLoadingUsers(false);
    if (!r.ok) {
      setRows([]);
      toast.error(r.error);
      return;
    }
    setRows(
      r.data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        district: u.district,
        isActive: u.isActive,
        status: u.govStatus === "revoked" ? "revoked" : u.isActive === false || u.govStatus === "suspended" ? "suspended" : "active",
        mfaResetPending: u.mfaResetPending,
        verificationStatus: (u.verificationStatus ?? null) as VolunteerVerification | null,
        profileTrustStatus: (u.profileTrustStatus ?? null) as TrustStatus | null,
      })),
    );
  }, []);

  useEffect(() => {
    void loadUsers();
    void listDistrictsApi().then((r) => {
      if (r.ok) setDistricts(r.data);
    });
  }, [loadUsers]);

  const openManage = (u: AdminManagedUserRecord) => {
    setDlg(u);
    setDraft({
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role,
      district: u.district ?? "",
      accessStatus: u.status,
      mfaResetPending: Boolean(u.mfaResetPending),
      verificationStatus: u.verificationStatus ?? "pending",
      profileTrustStatus: u.profileTrustStatus ?? "unsubmitted",
    });
  };

  const closeManage = () => {
    if (busy) return;
    setDlg(null);
    setDraft(null);
  };

  const saveManage = (override?: Partial<ManageDraft>) => {
    if (!dlg || !draft) return;
    void (async () => {
      const next = { ...draft, ...override };
      const phoneCheck = next.phone.trim() ? validateRwandaPhone(next.phone) : null;
      if (phoneCheck && !phoneCheck.ok) {
        toast.error(phoneCheck.error);
        return;
      }
      const needsDistrict = next.role === "volunteer" || next.role === "coordinator";
      const selectedDistrict = districts.find((d) => d.name === next.district);
      if (needsDistrict && !selectedDistrict) {
        toast.error("Select a district for volunteers and coordinators.");
        return;
      }

      setBusy(true);
      const res = await adminUpdateUserApi(dlg.id, {
        name: next.name.trim(),
        email: next.email.trim(),
        phone: phoneCheck?.value ?? null,
        role: next.role,
        district: needsDistrict ? selectedDistrict?.name : undefined,
        districtId: needsDistrict ? selectedDistrict?.id : null,
        govStatus: next.accessStatus,
        isActive: next.accessStatus === "active",
        mfaResetPending: next.mfaResetPending,
        verificationStatus: next.role === "volunteer" ? next.verificationStatus : "verified",
        profileTrustStatus: next.role === "volunteer" ? next.profileTrustStatus : null,
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("User updated");
      setDlg(null);
      setDraft(null);
      void loadUsers();
    })();
  };

  const quickStatus = (accessStatus: AccessStatus) =>
    saveManage({
      accessStatus,
      ...(accessStatus === "active" && draft?.role === "volunteer" ? { verificationStatus: "verified" as const } : {}),
    });

  const resetPassword = () => {
    if (!dlg) return;
    void (async () => {
      setBusy(true);
      const res = await adminResetPasswordApi(dlg.id);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Temporary password generated");
      toast.message("Temporary credentials", {
        description: `${res.data.user.email} / ${res.data.temporaryPassword}`,
      });
      void loadUsers();
    })();
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadUsers()} disabled={loadingUsers}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {loadingUsers ? "Loading..." : "Refresh"}
            </Button>
            <Button variant="outline" asChild><Link to="/admin/audit">Audit log</Link></Button>
            <Button asChild>
              <Link to="/admin/invites"><Plus className="mr-1.5 h-4 w-4" /> Invite or register user</Link>
            </Button>
          </div>
        )}
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Volunteer status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loadingUsers && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No users found in the database.
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs text-primary">{u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.phone && <div className="text-[11px] text-muted-foreground">{u.phone}</div>}
                      {u.mfaResetPending && <div className="text-[10px] text-amber-600 dark:text-amber-400">MFA reset pending</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.district ?? "-"}</TableCell>
                <TableCell><Badge variant="outline" className={statusBadgeCls(u.status)}>{u.status}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.role === "volunteer" ? `${u.verificationStatus ?? "pending"} / ${u.profileTrustStatus ?? "unsubmitted"}` : "-"}
                </TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openManage(u)}>Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={Boolean(dlg)} onOpenChange={(open) => !open && closeManage()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage user</DialogTitle>
            <DialogDescription>
              Edit profile details, role, district, volunteer approval, and access controls for {dlg?.email}.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manage-name">Full name</Label>
                  <Input id="manage-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="manage-email">Email</Label>
                  <Input id="manage-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="manage-phone">Phone</Label>
                  <Input id="manage-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: limitRwandaPhoneInput(e.target.value) })} placeholder="078XXXXXXX or +2507XXXXXXXX" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={draft.role} onValueChange={(role) => setDraft({ ...draft, role: role as ManagedRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                      <SelectItem value="coordinator">District / program coordinator</SelectItem>
                      <SelectItem value="admin">Ministry administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.role !== "admin" && (
                  <div className="sm:col-span-2">
                    <Label>Assigned district</Label>
                    <Select value={draft.district || "__unset__"} onValueChange={(v) => setDraft({ ...draft, district: v === "__unset__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="__unset__">Select district</SelectItem>
                        {districts.map((d) => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Access status</Label>
                  <Select value={draft.accessStatus} onValueChange={(accessStatus) => setDraft({ ...draft, accessStatus: accessStatus as AccessStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active / granted</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.role === "volunteer" && (
                  <>
                    <div>
                      <Label>Volunteer approval</Label>
                      <Select value={draft.verificationStatus} onValueChange={(verificationStatus) => setDraft({ ...draft, verificationStatus: verificationStatus as VolunteerVerification })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="verified">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Trusted profile</Label>
                      <Select value={draft.profileTrustStatus} onValueChange={(profileTrustStatus) => setDraft({ ...draft, profileTrustStatus: profileTrustStatus as TrustStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unsubmitted">Unsubmitted</SelectItem>
                          <SelectItem value="pending_review">Pending review</SelectItem>
                          <SelectItem value="verified">Trusted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <div>
                  <div className="text-sm font-medium">Reset MFA enrolment</div>
                  <div className="text-xs text-muted-foreground">Flags this user to re-enrol MFA when MFA is connected.</div>
                </div>
                <Switch checked={draft.mfaResetPending} onCheckedChange={(mfaResetPending) => setDraft({ ...draft, mfaResetPending })} />
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => quickStatus("active")} disabled={busy}>Grant access</Button>
                  <Button variant="outline" size="sm" onClick={resetPassword} disabled={busy}>Reset password</Button>
                  <Button variant="destructive" size="sm" onClick={() => quickStatus("revoked")} disabled={busy}>Revoke access</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={closeManage} disabled={busy}>Cancel</Button>
                  <Button onClick={() => saveManage()} disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

export default UsersPage;
