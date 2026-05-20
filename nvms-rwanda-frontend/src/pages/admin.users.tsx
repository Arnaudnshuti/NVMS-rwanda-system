import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  adminListUsersApi,
  adminUpdateUserApi,
  listDistrictsApi,
  type ApiDistrict,
} from "@/lib/nvms-api";

type AdminManagedUserRecord = {
  id: string;
  name: string;
  email: string;
  role: "volunteer" | "coordinator" | "admin";
  district?: string;
  status: "active" | "suspended" | "revoked";
  mfaResetPending?: boolean;
};

function UsersPage() {
  const [searchParams] = useSearchParams();
  const roleFilter = searchParams.get("role");
  const [rows, setRows] = useState<AdminManagedUserRecord[]>([]);
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const filteredRows = useMemo(
    () => rows.filter((u) => roleFilter === "volunteer" || roleFilter === "coordinator" ? u.role === roleFilter : true),
    [roleFilter, rows],
  );
  const pageTitle =
    roleFilter === "volunteer"
      ? "Volunteer workspace"
      : roleFilter === "coordinator"
        ? "Coordination workspace"
        : "Users & Roles";
  const pageDescription =
    roleFilter === "volunteer"
      ? "Review and manage volunteer accounts from the admin portal without entering the volunteer dashboard."
      : roleFilter === "coordinator"
        ? "Review and manage coordinator accounts, district assignments, access status, and MFA resets from the admin portal."
        : "Invite staff, assign coordinator districts, suspend or revoke accounts, and flag MFA resets from the backend.";

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
        role: u.role,
        district: u.district ?? undefined,
        status: u.govStatus === "revoked" ? "revoked" : u.isActive === false || u.govStatus === "suspended" ? "suspended" : "active",
        mfaResetPending: u.mfaResetPending,
      })),
    );
  }, []);

  useEffect(() => {
    void loadUsers();
    void listDistrictsApi().then((r) => {
      if (r.ok) setDistricts(r.data);
    });
  }, [loadUsers]);

  const [dlg, setDlg] = useState<AdminManagedUserRecord | null>(null);
  const [districtDraft, setDistrictDraft] = useState("");
  const [suspendedDraft, setSuspendedDraft] = useState(false);

  const statusBadgeCls = (s: AdminManagedUserRecord["status"]) =>
    s === "active"
      ? "border-success/30 bg-success/10 text-success"
      : s === "suspended"
        ? "border-warning/30 bg-warning/15 text-warning-foreground"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  const openManage = (u: AdminManagedUserRecord) => {
    setDlg(u);
    setDistrictDraft(u.district ?? "");
    setSuspendedDraft(u.status === "suspended");
  };

  const saveManage = () => {
    if (!dlg) return;
    void (async () => {
      setBusy(true);
      const selectedDistrict = districts.find((d) => d.name === districtDraft);
      const res = await adminUpdateUserApi(dlg.id, {
        ...(dlg.role === "coordinator"
          ? { district: districtDraft || undefined, districtId: selectedDistrict?.id }
          : {}),
        govStatus: suspendedDraft ? "suspended" : "active",
        isActive: !suspendedDraft,
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("User updated");
      setDlg(null);
      void loadUsers();
    })();
  };

  const revokeAccess = () => {
    if (!dlg) return;
    void (async () => {
      setBusy(true);
      const res = await adminUpdateUserApi(dlg.id, { govStatus: "revoked", isActive: false });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.message("Access revoked");
      setDlg(null);
      void loadUsers();
    })();
  };

  const resetMfa = () => {
    if (!dlg) return;
    void (async () => {
      setBusy(true);
      const res = await adminUpdateUserApi(dlg.id, { mfaResetPending: true });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("MFA reset flagged");
      setDlg(null);
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
              <Link to="/admin/invites"><Plus className="mr-1.5 h-4 w-4" /> Invite user</Link>
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loadingUsers && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
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
                      {u.mfaResetPending && <div className="text-[10px] text-amber-600 dark:text-amber-400">MFA reset pending</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.role === "coordinator" ? (u.district ?? "-") : "-"}</TableCell>
                <TableCell><Badge variant="outline" className={statusBadgeCls(u.status)}>{u.status}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openManage(u)}>Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={Boolean(dlg)} onOpenChange={() => setDlg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage user</DialogTitle>
            <DialogDescription>
              Update account access and district assignment for {dlg?.email}.
            </DialogDescription>
          </DialogHeader>
          {dlg?.role === "coordinator" && (
            <div className="space-y-2">
              <Label>Assigned district</Label>
              <Select value={districtDraft || "__unset__"} onValueChange={(v) => setDistrictDraft(v === "__unset__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__unset__">-</SelectItem>
                  {districts.map((d) => d.name).map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {districts.length === 0 && (
                <p className="text-xs text-muted-foreground">No districts were loaded from the backend.</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">Suspend account</div>
              <div className="text-xs text-muted-foreground">Blocks portal access until lifted.</div>
            </div>
            <Switch checked={suspendedDraft} onCheckedChange={setSuspendedDraft} disabled={dlg?.status === "revoked"} />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetMfa} disabled={busy}>Reset MFA enrolment</Button>
              <Button variant="destructive" size="sm" onClick={revokeAccess} disabled={busy || dlg?.status === "revoked"}>Revoke access</Button>
            </div>
            <Button onClick={saveManage} disabled={busy || dlg?.status === "revoked"}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

export default UsersPage;
