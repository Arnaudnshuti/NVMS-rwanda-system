import { useEffect, useState } from "react";
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
import { adminCreateCoordinatorApi, listDistrictsApi, type ApiDistrict } from "@/lib/nvms-api";

function AdminInvitesPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [role, setRole] = useState<"coordinator" | "admin" | "">("");
  const [busy, setBusy] = useState(false);
  const districtOptions = districts.map((d) => ({ id: d.id, name: d.name, value: d.id }));

  useEffect(() => {
    void (async () => {
      const r = await listDistrictsApi();
      if (r.ok) setDistricts(r.data);
      else toast.error(r.error);
    })();
  }, []);

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Invite users"
        description="Provision coordinator and ministry accounts in the backend database. Invitation email is sent automatically when SMTP is configured."
        actions={<Button asChild variant="outline"><Link to="/admin/users">Back to users</Link></Button>}
      />

      <Alert className="mb-6 max-w-2xl border-primary/30 bg-primary/5">
        <AlertTitle>Access control (MINALOC)</AlertTitle>
        <AlertDescription>
          Ministry administrators have full system access. When inviting a <strong>coordinator</strong>, the backend records their assigned <strong>district</strong> so verification and program work stay in the correct district queue.
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
              if (!role) {
                toast.error("Please select a role.");
                return;
              }
              const selectedDistrict = districtOptions.find((d) => d.value === district);
              if (role === "coordinator" && districts.length === 0) {
                toast.error("Districts were not loaded from the backend.");
                return;
              }
              if (role === "coordinator" && !selectedDistrict) {
                toast.error("Please select a district for the coordinator.");
                return;
              }
              setBusy(true);
              const res = await adminCreateCoordinatorApi({
                name: name.trim() || (role === "coordinator" ? "District Coordinator" : "Ministry Administrator"),
                email: email.trim(),
                role,
                districtId: role === "coordinator" ? selectedDistrict?.id : undefined,
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("User created and invite email sent.", {
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
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
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
            {role !== "admin" && (
              <div>
                <Label htmlFor="invite-district">District</Label>
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger id="invite-district"><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    {districtOptions.map((d) => (
                      <SelectItem key={d.name} value={d.value}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {districts.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">No districts loaded from the backend yet.</p>
                )}
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default AdminInvitesPage;
