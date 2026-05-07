import { Link, useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { adminCreateCoordinatorApi, listDistrictsApi, nvmsApiEnabled, type ApiDistrict } from "@/lib/nvms-api";
import { useEffect, useState } from "react";

/** MINALOC provisions coordinators and staff — no public self-signup for these roles. UI stub until API exists. */
function AdminInvitesPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [role, setRole] = useState<"coordinator" | "admin" | "">("");
  const [busy, setBusy] = useState(false);
  const apiOn = nvmsApiEnabled();

  useEffect(() => {
    if (!apiOn) return;
    void (async () => {
      const r = await listDistrictsApi();
      if (r.ok) setDistricts(r.data);
    })();
  }, [apiOn]);

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Invite users"
        description={
          apiOn
            ? "Provision coordinators via backend. Invitation email is sent automatically (SMTP or dev mail-out)."
            : "Provision coordinator and ministry accounts. Invitations will be sent by email once the backend is connected."
        }
        actions={<Button asChild variant="outline"><Link to="/admin/users">Back to users</Link></Button>}
      />

      <Alert className="mb-6 max-w-2xl border-primary/30 bg-primary/5">
        <AlertTitle>Access control (MINALOC)</AlertTitle>
        <AlertDescription>
          Ministry administrators have full system access. When inviting a <strong>coordinator</strong>, the backend should record one or more <strong>districts</strong> they may verify volunteers in and run programs for — this limits fraud and matches national deployment policy. Only coordinators (or ministry staff) in the correct district queue should approve volunteers registered in that district.
        </AlertDescription>
      </Alert>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!apiOn) {
                toast.success("Invite queued (connect API to send email and create account).");
                return;
              }
              if (role !== "coordinator") {
                toast.error("Only coordinator provisioning is supported here (admin accounts should be created via secure internal process).");
                return;
              }
              setBusy(true);
              const res = await adminCreateCoordinatorApi({
                name: name.trim() || "District Coordinator",
                email: email.trim(),
                districtId: district || undefined,
                district: !district ? "Unassigned" : undefined,
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Coordinator created and invite email sent.", {
                description: "Temporary password is shown once for audit/test (in production, rely on email only).",
              });
              toast.message("Temporary credentials", {
                description: `${res.data.user.email} / ${res.data.temporaryPassword}`,
              });
              navigate("/admin/users");
            }}
          >
            <div>
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@minaloc.gov.rw"
              />
            </div>
            <div>
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Coordinator name" />
            </div>
            <div>
              <Label htmlFor="invite-district">District</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger id="invite-district"><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select required value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coordinator">District / program coordinator</SelectItem>
                  <SelectItem value="admin">Ministry administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy || (apiOn && role === "admin")}>
              {busy ? "Sending..." : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default AdminInvitesPage;
