import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { ProgramCard } from "@/components/ProgramCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Program } from "@/lib/mock-data";
import { PROGRAMS, RWANDA_DISTRICTS } from "@/lib/mock-data";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isVolunteerVerified } from "@/lib/portal-access";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";
import { applicationsForVolunteer, submitApplication } from "@/lib/program-applications";
import {
  nvmsApiEnabled,
  fetchProgramsFromApi,
  fetchMyApplicationsFromApi,
  submitApplicationApi,
} from "@/lib/nvms-api";
import {
  canVolunteerApplyToPrograms,
  volunteerApplyBlockReason,
  volunteerTrustTierLabel,
} from "@/lib/volunteer-eligibility";


function BrowsePrograms() {
  return (
    <PortalShell role="volunteer">
      <BrowseProgramsInner />
    </PortalShell>
  );
}

function BrowseProgramsInner() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [programSource, setProgramSource] = useState<Program[]>(PROGRAMS);
  const [remoteApplications, setRemoteApplications] = useState<Awaited<
    ReturnType<typeof fetchMyApplicationsFromApi>
  > | null>(null);

  useEffect(() => {
    if (!nvmsApiEnabled()) {
      setProgramSource(PROGRAMS);
      setRemoteApplications(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [progs, apps] = await Promise.all([fetchProgramsFromApi(), fetchMyApplicationsFromApi()]);
        if (!cancelled) {
          setProgramSource(progs);
          setRemoteApplications(apps);
        }
      } catch {
        if (!cancelled) toast.error("Could not load programs from API");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const v = user ? volunteerProfileForAuthUser(user) : null;
  const accountVerified = Boolean(user && isVolunteerVerified(user));
  const canApply = Boolean(user && v && canVolunteerApplyToPrograms(user, v));
  const tier =
    user && v ? volunteerTrustTierLabel(user, v) : { label: "Standard", detail: "Sign in to continue." };
  const blockReason = user && v ? volunteerApplyBlockReason(user, v) : null;

  const myApplications = useMemo(() => {
    if (nvmsApiEnabled()) return remoteApplications ?? [];
    return v ? applicationsForVolunteer(v.id) : [];
  }, [v?.id, tick, remoteApplications]);
  const appByProgram = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of myApplications) {
      if (!m.has(a.programId)) m.set(a.programId, a.status);
    }
    return m;
  }, [myApplications]);

  if (!user || !v) return null;

  const list = programSource.filter((p) => p.status !== "draft")
    .filter((p) => {
      const end = new Date(p.endDate);
      if (Number.isNaN(end.getTime())) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return end >= today;
    })
    .filter((p) => {
      // Volunteers should only see opportunities for their district.
      if (!user.district) return true;
      return p.district === user.district;
    })
    .filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => district === "all" || p.district === district)
    .filter((p) => category === "all" || p.category === category);

  return (
    <>
      <PageHeader
        title="Browse Programs"
        description={
          !accountVerified
            ? <>Your coordinator must approve registration before browsing applications. Programs below are visible for exploration only.</>
            : !canApply
              ? <>
                  <span className="font-medium text-foreground">{tier.label}</span>
                  {" — "}
                  {blockReason ?? "Complete eligibility to apply."} Use{" "}
                  <Link to="/volunteer/profile" className="font-semibold text-primary underline">My Profile</Link>
                  {" "}and{" "}
                  <Link to="/volunteer/trust-profile" className="font-semibold text-primary underline">Identity &amp; trust</Link>.
                </>
              : <>
                  <span className="text-muted-foreground">{tier.detail}</span>
                  {" "}Track decisions under{" "}
                  <Link to="/volunteer/applications" className="font-semibold text-primary underline">My applications</Link>.
                </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs…" className="pl-9" />
        </div>
        <Select value={district} onValueChange={setDistrict}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="District" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All districts</SelectItem>
            {RWANDA_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {["Education", "Health", "Environment", "Agriculture", "Community", "Emergency"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const st = appByProgram.get(p.id);
          const blocked = Boolean(
            st && ["submitted", "under_review", "accepted", "waitlisted"].includes(st),
          );
          return (
          <ProgramCard key={p.id} program={p} footer={
            <div className="space-y-2">
              {st && (
                <div className="text-center text-xs text-muted-foreground">
                  Application: <span className="font-semibold capitalize text-foreground">{st.replace(/_/g, " ")}</span>
                </div>
              )}
            <Button
              size="sm"
              className="w-full"
              disabled={!canApply || blocked}
              title={
                !accountVerified
                  ? "Your volunteer account must be approved by a coordinator first."
                  : blockReason ?? (blocked ? "You already have an active application for this program." : undefined)
              }
              onClick={() => {
                void (async () => {
                  if (!accountVerified) {
                    toast.message("Account pending", {
                      description: "Wait for district approval of your registration, then sign in again.",
                    });
                    return;
                  }
                  if (!canApply) {
                    toast.message("Cannot apply yet", {
                      description: blockReason ?? "Complete profile and trusted KYC.",
                    });
                    return;
                  }
                  if (nvmsApiEnabled()) {
                    const res = await submitApplicationApi(p.id);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    setTick((n) => n + 1);
                    toast.success(`Application submitted to "${p.title}"`, {
                      description: "Your district coordinator will review it.",
                    });
                    return;
                  }
                  const res = submitApplication({
                    volunteerId: v.id,
                    volunteerEmail: user.email,
                    volunteerName: user.name,
                    volunteerDistrict: user.district,
                    programId: p.id,
                  });
                  if (!res.ok) {
                    toast.error(res.reason);
                    return;
                  }
                  setTick((n) => n + 1);
                  toast.success(`Application submitted to "${p.title}"`, {
                    description: "Your district coordinator will review it.",
                  });
                })();
              }}
            >
              {blocked ? "Application in progress" : "Apply to program"}
            </Button>
            </div>
          }/>
        );
        })}
      </div>
      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">No programs match your filters.</div>
      )}
    </>
  );
}

export default BrowsePrograms;
