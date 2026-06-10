import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { adminCreateCoordinatorApi, listDistrictsApi, type ApiDistrict } from "@/lib/nvms-api";
import { limitRwandaPhoneInput, validateBirthDate, validateRwandaPhone } from "@/lib/validation";
import { Building2, CheckCircle2, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";

type InviteRole = "volunteer" | "coordinator" | "admin";

const ROLE_OPTIONS: Array<{
  value: InviteRole;
  title: string;
  description: string;
  icon: typeof UserPlus;
}> = [
  {
    value: "volunteer",
    title: "Register volunteer",
    description: "Create a volunteer account attached to a district.",
    icon: Users,
  },
  {
    value: "coordinator",
    title: "Invite coordinator",
    description: "Provision a district or program coordinator account.",
    icon: Building2,
  },
  {
    value: "admin",
    title: "Invite ministry admin",
    description: "Grant national administration access.",
    icon: ShieldCheck,
  },
];

function AdminInvitesPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [role, setRole] = useState<InviteRole>("volunteer");
  const [contactPreference, setContactPreference] = useState<"email" | "sms" | "both">("both");
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "verified">("pending");
  const [busy, setBusy] = useState(false);
  const districtOptions = districts.map((d) => ({ id: d.id, name: d.name, value: d.id }));
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - 18);
  const maxBirthDateValue = maxBirthDate.toISOString().slice(0, 10);

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
        title="Invite or register users"
        description="Register volunteers, invite district coordinators, and provision ministry administrator accounts from one admin workflow."
        actions={<Button asChild variant="outline"><Link to="/admin/users">Back to users</Link></Button>}
      />

      <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5 text-primary" />
            New user access
          </CardTitle>
          <CardDescription>
            Choose the account type first. The form will only ask for fields needed by that user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const selectedDistrict = districtOptions.find((d) => d.value === district);
              if ((role === "coordinator" || role === "volunteer") && districts.length === 0) {
                toast.error("Districts were not loaded from the backend.");
                return;
              }
              if ((role === "coordinator" || role === "volunteer") && !selectedDistrict) {
                toast.error("Please select a district for this user.");
                return;
              }
              const phoneCheck = phone.trim() ? validateRwandaPhone(phone) : null;
              if (phoneCheck && !phoneCheck.ok) {
                toast.error(phoneCheck.error);
                return;
              }
              if (role === "volunteer") {
                if (!phoneCheck) {
                  toast.error("Phone is required when registering a volunteer.");
                  return;
                }
                const dobCheck = validateBirthDate(dateOfBirth);
                if (!dobCheck.ok) {
                  toast.error(dobCheck.error);
                  return;
                }
              }
              setBusy(true);
              const res = await adminCreateCoordinatorApi({
                name: name.trim() || (role === "volunteer" ? "Registered Volunteer" : role === "coordinator" ? "District Coordinator" : "Ministry Administrator"),
                email: email.trim(),
                role,
                phone: phoneCheck?.value,
                districtId: role === "coordinator" || role === "volunteer" ? selectedDistrict?.id : undefined,
                dateOfBirth: role === "volunteer" ? dateOfBirth : undefined,
                contactPreference: role === "volunteer" ? contactPreference : undefined,
                verificationStatus: role === "volunteer" ? verificationStatus : undefined,
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(role === "volunteer" ? "Volunteer registered." : "User created and invite email sent.", {
                description: "Temporary password is shown once for audit/test. In production, rely on email only.",
              });
              toast.message("Temporary credentials", {
                description: `${res.data.user.email} / ${res.data.temporaryPassword}`,
              });
              navigate("/admin/users");
            }}
          >
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Account type</h2>
                <p className="text-xs text-muted-foreground">This controls district requirements, approval flow, and access level.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={[
                        "flex min-h-28 items-start gap-3 rounded-md border p-4 text-left transition-colors",
                        active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <span className={active ? "text-primary" : "text-muted-foreground"}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 rounded-md border border-border/70 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h2 className="text-sm font-semibold">Profile details</h2>
                <p className="text-xs text-muted-foreground">Basic identity and contact information for the account.</p>
              </div>
              <div>
                <Label htmlFor="invite-name">Full name</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === "volunteer" ? "volunteer@example.rw" : "name@minaloc.gov.rw"}
                />
              </div>
              <div>
                <Label htmlFor="invite-phone">Phone</Label>
                <Input
                  id="invite-phone"
                  value={phone}
                  onChange={(e) => setPhone(limitRwandaPhoneInput(e.target.value))}
                  placeholder={role === "volunteer" ? "Required for volunteers" : "Optional"}
                  maxLength={13}
                  required={role === "volunteer"}
                />
              </div>
              {role === "volunteer" && (
                <div>
                  <Label htmlFor="invite-dob">Date of birth</Label>
                  <Input id="invite-dob" type="date" max={maxBirthDateValue} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                </div>
              )}
            </section>

            <section className="grid gap-5 rounded-md border border-border/70 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h2 className="text-sm font-semibold">Assignment & access</h2>
                <p className="text-xs text-muted-foreground">
                  Volunteers and coordinators are assigned to a district. Admins receive national access.
                </p>
              </div>
              {role !== "admin" ? (
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
              ) : (
                <Alert className="md:col-span-2 border-primary/30 bg-primary/5">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Ministry administrator access</AlertTitle>
                  <AlertDescription>
                    This user will have national-level access and does not need a district assignment.
                  </AlertDescription>
                </Alert>
              )}
              {role === "volunteer" && (
                <>
                  <div>
                    <Label>Approval status</Label>
                    <Select value={verificationStatus} onValueChange={(v) => setVerificationStatus(v as "pending" | "verified")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Register as pending approval</SelectItem>
                        <SelectItem value="verified">Register and grant login access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notification preference</Label>
                    <Select value={contactPreference} onValueChange={(v) => setContactPreference(v as typeof contactPreference)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="both">Both email and SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-md border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {role === "volunteer" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                ) : (
                  <Mail className="mt-0.5 h-5 w-5 text-primary" />
                )}
                <div>
                  <h2 className="text-sm font-semibold">
                    {role === "volunteer" ? "Create volunteer account" : "Send staff invitation"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {role === "volunteer"
                      ? "A temporary password will be generated. If access is pending, the volunteer can sign in after approval."
                      : "A temporary password is generated and the account must change it after first login."}
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? "Saving..." : role === "volunteer" ? "Register volunteer" : "Send invite"}
              </Button>
            </section>
          </form>
        </CardContent>
      </Card>
      </div>
    </PortalShell>
  );
}

export default AdminInvitesPage;
