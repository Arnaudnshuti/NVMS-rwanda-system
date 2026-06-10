import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { dispatchAuthRefresh, useAuth } from "@/lib/auth";
import { nvmsApiEnabled, patchMyProfileApi } from "@/lib/nvms-api";
import { limitRwandaPhoneInput, validateRwandaPhone } from "@/lib/validation";

function AccountProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const role = user?.role ?? "volunteer";

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      if (!user) return;
      if (!name.trim()) {
        toast.error("Name is required.");
        return;
      }
      const phoneCheck = phone.trim() ? validateRwandaPhone(phone) : null;
      if (phoneCheck && !phoneCheck.ok) {
        toast.error(phoneCheck.error);
        return;
      }
      if (!nvmsApiEnabled()) {
        toast.info("Profile editing needs the backend connection.");
        return;
      }
      setBusy(true);
      const res = await patchMyProfileApi({
        name: name.trim(),
        phone: phoneCheck?.value ?? "",
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      dispatchAuthRefresh();
      toast.success("Profile saved");
    })();
  };

  return (
    <PortalShell role={role}>
      <PageHeader
        title="My profile"
        description="View and update your own account details."
        actions={user?.role === "volunteer" ? <Button variant="outline" asChild><Link to="/volunteer/profile">Volunteer profile</Link></Button> : undefined}
      />

      <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                {(user?.name ?? "User").split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 font-display text-lg font-semibold">{user?.name}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="capitalize">{user?.role}</Badge>
              {user?.district && <Badge variant="secondary">{user.district}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account information</CardTitle>
            <CardDescription>Email, role, and district are managed by an administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div className="sm:col-span-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email ?? ""} readOnly />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(limitRwandaPhoneInput(e.target.value))} placeholder="078XXXXXXX or +2507XXXXXXXX" maxLength={13} />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={user?.role ?? ""} readOnly disabled className="capitalize" />
                <p className="mt-1.5 text-xs text-muted-foreground">Role is assigned by an administrator.</p>
              </div>
              <div>
                <Label>District</Label>
                <Select value={user?.district ?? "__national__"} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__national__">National</SelectItem>
                    {user?.district && <SelectItem value={user.district}>{user.district}</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">District assignment is managed by an administrator.</p>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save profile"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

export default AccountProfilePage;
