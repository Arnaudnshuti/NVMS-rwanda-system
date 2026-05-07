import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DEMO_USERS, RWANDA_DISTRICTS } from "@/lib/mock-data";
import { Plus } from "lucide-react";
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
import { getUserOverride, upsertUserOverride, type AdminManagedUserRecord } from "@/lib/admin-user-overrides";

const extras: AdminManagedUserRecord[] = [
  { id: "u4", name: "Immaculée Nyirahabimana", email: "i.nyira@gov.rw", role: "coordinator", district: "Musanze", status: "active" },
  { id: "u5", name: "David Rugamba", email: "d.rugamba@gov.rw", role: "coordinator", district: "Rubavu", status: "active" },
  { id: "u6", name: "Alice Nyampinga", email: "a.nyampinga@gov.rw", role: "admin", status: "active" },
];

function mergedUsers(version: number) {
  const base: AdminManagedUserRecord[] = [
    ...DEMO_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      district: u.district,
      status: "active" as const,
    })),
    ...extras,
  ];
  return base.map((u) => {
    const ov = getUserOverride(u.id);
    return {
      ...u,
      district: ov.district ?? u.district,
      status: ov.status ?? u.status,
      mfaResetPending: ov.mfaResetPending,
    };
  });
}

function UsersPage() {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);

  const rows = useMemo(() => mergedUsers(version), [version]);

  const [dlg, setDlg] = useState<AdminManagedUserRecord | null>(null);
  const [districtDraft, setDistrictDraft] = useState<string>("");
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
    const revoked = dlg.status === "revoked";
    upsertUserOverride(dlg.id, {
      ...(dlg.role === "coordinator" ? { district: districtDraft || undefined } : {}),
      status: revoked ? "revoked" : suspendedDraft ? "suspended" : "active",
    });
    toast.success("User updated (demo: local overrides only until API connects).");
    setDlg(null);
    bump();
  };

  const revokeAccess = () => {
    if (!dlg) return;
    upsertUserOverride(dlg.id, { status: "revoked" });
    toast.message("Access revoked locally", {
      description: "Backend must invalidate sessions for production.",
    });
    setDlg(null);
    bump();
  };

  const resetMfa = () => {
    if (!dlg) return;
    upsertUserOverride(dlg.id, { mfaResetPending: true });
    toast.success("MFA reset flagged", { description: "User must re-enrol on next sign-in once auth service supports it." });
    setDlg(null);
    bump();
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Users & Roles"
        description="Invite staff, assign coordinator districts, suspend or revoke accounts, and flag MFA resets. Changes below are stored locally for prototyping."
        actions={(
          <div className="flex flex-wrap gap-2">
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
            {rows.map((u) => (
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
                <TableCell className="text-sm text-muted-foreground">{u.role === "coordinator" ? (u.district ?? "—") : "—"}</TableCell>
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
              {dlg?.email} — map to PATCH /admin/users/:id endpoints.
            </DialogDescription>
          </DialogHeader>
          {dlg?.role === "coordinator" && (
            <div className="space-y-2">
              <Label>Assigned district</Label>
              <Select value={districtDraft || "__unset__"} onValueChange={(v) => setDistrictDraft(v === "__unset__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__unset__">—</SelectItem>
                  {RWANDA_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button variant="outline" size="sm" onClick={resetMfa}>Reset MFA enrolment</Button>
              <Button variant="destructive" size="sm" onClick={revokeAccess} disabled={dlg?.status === "revoked"}>Revoke access</Button>
            </div>
            <Button onClick={saveManage} disabled={dlg?.status === "revoked"}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

export default UsersPage;
