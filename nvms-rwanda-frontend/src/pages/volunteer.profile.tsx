import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ShieldCheck, Clock, XCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { dispatchAuthRefresh, useAuth } from "@/lib/auth";
import { nvmsApiEnabled, patchMyProfileApi } from "@/lib/nvms-api";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";
import { resolveProfileTrustStatus } from "@/lib/portal-access";
import { patchRegistryUserByEmail } from "@/lib/account-registry";
import {
  volunteerProfileMissingFields,
  volunteerTrustTierLabel,
  canVolunteerApplyToPrograms,
} from "@/lib/volunteer-eligibility";

const EDUCATION_LEVELS = [
  "Primary",
  "Lower secondary",
  "Upper secondary / A-level",
  "Technical / vocational certificate",
  "Associate degree",
  "Bachelor's degree",
  "Postgraduate diploma",
  "Master's degree",
  "Doctorate",
  "Prefer not to say",
] as const;

function ProfilePage() {
  return (
    <PortalShell role="volunteer">
      <ProfilePageInner />
    </PortalShell>
  );
}

function ProfilePageInner() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState("");
  const [profession, setProfession] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [skillsLine, setSkillsLine] = useState("");

  useEffect(() => {
    if (!user) return;
    const vp = volunteerProfileForAuthUser(user);
    setAvailability(user.volunteerAvailability?.trim() || vp.availability || "");
    setProfession(user.profession ?? "");
    setEducationLevel(user.educationLevel ?? "");
    setNationalId(user.nationalId ?? "");
    setSkillsLine(user.trustSkillsSummary?.trim() ? user.trustSkillsSummary : vp.skills.join(", "));
  }, [user]);

  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);
  const isRegistry = String(user.id).startsWith("new-");
  const verified = v.status === "verified";
  const rejected = v.status === "rejected";
  const trust = resolveProfileTrustStatus(user);
  const trusted = trust === "verified";
  const tier = volunteerTrustTierLabel(user, v);
  const eligibleApply = canVolunteerApplyToPrograms(user, v);
  const missing = volunteerProfileMissingFields(user, v);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      if (!skillsLine.trim()) {
        toast.error("Add at least one skill.");
        return;
      }
      if (nvmsApiEnabled()) {
        const res = await patchMyProfileApi({
          volunteerAvailability: availability.trim(),
          profession: profession.trim(),
          educationLevel: educationLevel && educationLevel !== "__none" ? educationLevel : "",
          nationalId: nationalId.trim(),
          trustSkillsSummary: skillsLine.trim(),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        dispatchAuthRefresh();
        toast.success("Profile saved");
        return;
      }
      if (!isRegistry) {
        toast.info("Demo volunteer", {
          description:
            "Profiles for built-in demo accounts stay fixed until the API connects. Self-registered accounts can save edits here.",
        });
        return;
      }
      const ok = patchRegistryUserByEmail(user.email, {
        volunteerAvailability: availability.trim(),
        profession: profession.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        trustSkillsSummary: skillsLine.trim(),
      });
      if (!ok) {
        toast.error("Could not save — try signing in again.");
        return;
      }
      dispatchAuthRefresh();
      toast.success("Profile saved");
    })();
  };

  return (
    <>
      <PageHeader title="My Profile" description="Keep your profile up to date so coordinators can match you to the best programs." />

      {(missing.length > 0 || !eligibleApply) && verified && (
        <Card className="mb-6 border-amber-500/35 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div>
              <div className="font-semibold text-foreground">Profile completeness</div>
              <p className="mt-1 text-muted-foreground">
                {eligibleApply
                  ? `${tier.label} · ${tier.detail}`
                  : `Before applying to programs: ${missing.length ? missing.join(", ") : "complete Identity & trust"}.`}
              </p>
            </div>
            {!eligibleApply && (
              <Button size="sm" variant="outline" asChild>
                <Link to={trusted ? "/volunteer/profile" : "/volunteer/trust-profile"}>{trusted ? "Finish profile fields" : "Open Identity & trust"}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-gradient-primary text-2xl text-primary-foreground">
                {v.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-4 font-display text-lg font-semibold">{v.name}</h3>
            <p className="text-sm text-muted-foreground">{v.district}, Rwanda</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge
                className={
                  verified
                    ? "gap-1 bg-success/15 text-success hover:bg-success/15"
                    : rejected
                      ? "gap-1 bg-destructive/15 text-destructive hover:bg-destructive/15"
                      : "gap-1 bg-amber-500/15 text-amber-900 dark:text-amber-100 hover:bg-amber-500/15"
                }
              >
                {verified && <><ShieldCheck className="h-3 w-3" /> Account verified</>}
                {rejected && <><XCircle className="h-3 w-3" /> Not approved</>}
                {!verified && !rejected && <><Clock className="h-3 w-3" /> Account pending</>}
              </Badge>
              {trusted && (
                <Badge className="gap-1 border-accent/40 bg-accent/15 text-accent-foreground hover:bg-accent/15">
                  <Award className="h-3 w-3" /> Trusted for deployment
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">{tier.label}</Badge>
            </div>
            <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-border pt-4">
              <div><div className="font-display text-xl font-bold">{v.hoursContributed}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hours</div></div>
              <div><div className="font-display text-xl font-bold">{v.programsCompleted}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Programs</div></div>
              <div><div className="font-display text-xl font-bold">{v.rating > 0 ? v.rating.toFixed(1) : "—"}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rating</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Personal information</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {isRegistry ? "Updates save to this browser for self-registered accounts." : "Built-in demo account — viewing only."}
              </div>
              <div><Label>Full name</Label><Input value={user.name} readOnly /></div>
              <div><Label>Email</Label><Input value={user.email} type="email" readOnly /></div>
              <div><Label>Phone</Label><Input value={v.phone} readOnly className={!v.phone.trim() ? "border-destructive/50" : ""} /></div>
              <div><Label>District</Label><Input value={user.district ?? ""} readOnly /></div>
              <div className="sm:col-span-2">
                <Label htmlFor="avail">Availability *</Label>
                <Input
                  id="avail"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. Weekends, evenings, August–October…"
                  disabled={!isRegistry}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="prof">Profession / occupation</Label>
                <Input
                  id="prof"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="What you do today (student, farmer, nurse…)"
                  disabled={!isRegistry}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Highest education</Label>
                <Select
                  value={educationLevel || "__none"}
                  onValueChange={(vl) => setEducationLevel(vl === "__none" ? "" : vl)}
                  disabled={!isRegistry}
                >
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not specified</SelectItem>
                    {EDUCATION_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nid-p">National ID (masked in UI)</Label>
                <Input
                  id="nid-p"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="1 1990 8 …"
                  disabled={!isRegistry}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={!isRegistry} onClick={() => window.location.reload()}>Reset view</Button>
                <Button type="submit" disabled={!isRegistry}>Save changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Trust & identity</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/volunteer/trust-profile">Manage documents &amp; KYC</Link>
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Status:{" "}
              <span className="font-medium text-foreground">
                {trust === "verified" ? "Trusted volunteer — eligible for programs once profile is complete" : trust === "pending_review" ? "Documents under review" : trust === "rejected" ? "KYC needs update" : "KYC not submitted"}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Skills & expertise</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="skills-line">Skills (comma-separated) *</Label>
              <Textarea
                id="skills-line"
                rows={3}
                value={skillsLine}
                onChange={(e) => setSkillsLine(e.target.value)}
                placeholder="Teaching, nursing, logistics…"
                disabled={!isRegistry}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Coordinators match these strings to programme requirements before deployment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(skillsLine
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter(Boolean).length > 0
                ? skillsLine
                    .split(/[,;\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : v.skills
              ).map((s, idx) => (
                <Badge key={`${s}-${idx}`} variant="secondary" className="gap-1 px-3 py-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />{s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default ProfilePage;
