import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROGRAMS, VOLUNTEERS, type Program } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator } from "@/lib/portal-access";
import {
  coordinatorAssignVolunteerApi,
  fetchAdminProgramsFromApi,
  coordinatorListDeploymentsApi,
  coordinatorListVolunteersApi,
  nvmsApiEnabled,
  type ApiDeployment,
  type ApiCoordinatorVolunteerRow,
} from "@/lib/nvms-api";
import { CalendarDays, CheckCircle2, Clock, MapPin, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

function statusClass(status: ApiDeployment["status"] | Program["status"]) {
  if (status === "active" || status === "in_progress") return "border-success/30 bg-success/10 text-success";
  if (status === "upcoming" || status === "open") return "border-accent/30 bg-accent/10 text-accent";
  return "bg-muted text-muted-foreground";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-RW", { month: "short", day: "numeric", year: "numeric" });
}

function volunteerDetail(v: ApiCoordinatorVolunteerRow) {
  return [v.profession, v.educationLevel, v.trustSkillsSummary].filter(Boolean).join(" - ");
}

function DeploymentsPage() {
  const { user } = useAuth();
  const apiOn = nvmsApiEnabled();
  const [programs, setPrograms] = useState<Program[]>(PROGRAMS);
  const visible = programsVisibleToCoordinator(user, programs);
  const activePrograms = visible.filter((p) => p.status === "in_progress" || p.status === "open");
  const [deployments, setDeployments] = useState<ApiDeployment[]>([]);
  const [volunteers, setVolunteers] = useState<ApiCoordinatorVolunteerRow[]>([]);
  const [selectedByProgram, setSelectedByProgram] = useState<Record<string, string>>({});
  const [busyProgramId, setBusyProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!apiOn) return;
    setLoading(true);
    const [d, v, p] = await Promise.all([
      coordinatorListDeploymentsApi(),
      coordinatorListVolunteersApi({ verificationStatus: "verified", profileTrustStatus: "verified" }),
      fetchAdminProgramsFromApi(),
    ]);
    setLoading(false);
    if (d.ok) setDeployments(d.data);
    else toast.error(d.error);
    if (v.ok) setVolunteers(v.data);
    else toast.error(v.error);
    if (Array.isArray(p)) setPrograms(p);
  };

  useEffect(() => {
    void loadData();
  }, [apiOn]);

  const byProgram = useMemo(() => {
    const m = new Map<string, ApiDeployment[]>();
    for (const d of deployments) {
      const arr = m.get(d.programId) ?? [];
      arr.push(d);
      m.set(d.programId, arr);
    }
    return m;
  }, [deployments]);

  const deployedVolunteerIds = useMemo(() => new Set(deployments.map((d) => d.volunteerId)), [deployments]);
  const totalAssigned = deployments.filter((d) => d.status === "active" || d.status === "upcoming").length;
  const totalSlots = activePrograms.reduce((sum, p) => sum + p.slotsTotal, 0);
  const availableVolunteers = volunteers.filter((v) => !deployedVolunteerIds.has(v.id));

  const assignVolunteer = async (program: Program) => {
    if (!apiOn) {
      toast.message("Connect to the backend to create real deployments.");
      return;
    }
    const volunteerId = selectedByProgram[program.id];
    if (!volunteerId) {
      toast.error("Choose a verified trusted volunteer first.");
      return;
    }
    setBusyProgramId(program.id);
    const r = await coordinatorAssignVolunteerApi({ programId: program.id, volunteerId });
    setBusyProgramId(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Volunteer deployed", {
      description: "The assignment now appears on the volunteer's My Assignments page.",
    });
    setSelectedByProgram((current) => ({ ...current, [program.id]: "" }));
    await loadData();
  };

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Deployments"
        description={
          user?.district
            ? `Assign trusted volunteers to active programs in ${user.district}. Accepted deployments become assignments for volunteers.`
            : "Assign trusted volunteers to active programs within your role scope."
        }
        actions={
          <Button variant="outline" onClick={loadData} disabled={loading || !apiOn}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active programs" value={activePrograms.length} icon={<CalendarDays className="h-5 w-5" />} accent="primary" />
        <StatCard label="Deployed volunteers" value={totalAssigned} icon={<Users className="h-5 w-5" />} accent="accent" />
        <StatCard label="Trusted available" value={apiOn ? availableVolunteers.length : VOLUNTEERS.filter((v) => v.status === "verified").length} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Total capacity" value={totalSlots} icon={<UserPlus className="h-5 w-5" />} accent="warning" />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-start gap-3">
          <UserPlus className="mt-1 h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">How deployment works</CardTitle>
            <CardDescription>
              Normal flow: volunteers apply, you accept the application, and NVMS creates the assignment automatically. Use manual deployment only when a trusted volunteer must be added without an application.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="mt-6 space-y-5">
        {activePrograms.map((program) => {
          const currentDeployments = byProgram.get(program.id) ?? [];
          const remainingSlots = Math.max(0, program.slotsTotal - currentDeployments.length);
          const eligibleForProgram = apiOn
            ? availableVolunteers.filter((v) => !v.district || v.district === program.district)
            : [];
          const selectedVolunteer = selectedByProgram[program.id] ?? "";

          return (
            <Card key={program.id} className="border-border/70">
              <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{program.title}</CardTitle>
                    <Badge variant="outline" className={statusClass(program.status)}>{program.status.replace("_", " ")}</Badge>
                  </div>
                  <CardDescription className="mt-1 flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {program.district}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(program.startDate)} - {formatDate(program.endDate)}</span>
                  </CardDescription>
                </div>
                <div className="grid min-w-[220px] gap-1 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Assigned</span><strong>{currentDeployments.length}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Capacity</span><strong>{program.slotsTotal}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><strong>{remainingSlots}</strong></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border p-4">
                  <div className="mb-3 text-sm font-medium">Manual deployment</div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <Select
                      value={selectedVolunteer}
                      onValueChange={(value) => setSelectedByProgram((current) => ({ ...current, [program.id]: value }))}
                      disabled={!apiOn || remainingSlots === 0 || eligibleForProgram.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={eligibleForProgram.length ? "Choose verified trusted volunteer" : "No eligible volunteers available"} />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleForProgram.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} - {v.district ?? "No district"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => assignVolunteer(program)} disabled={!apiOn || !selectedVolunteer || busyProgramId === program.id || remainingSlots === 0}>
                      {busyProgramId === program.id ? "Deploying..." : "Deploy volunteer"}
                    </Button>
                  </div>
                  {selectedVolunteer ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {volunteerDetail(volunteers.find((v) => v.id === selectedVolunteer)!)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {remainingSlots === 0
                        ? "This program has reached its deployment capacity."
                        : "For the normal workflow, accept applications or use Smart Match. This manual action is for coordinator-selected exceptions."}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 text-sm font-medium">Current deployments</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Volunteer</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentDeployments.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <div className="font-medium">{d.volunteerName}</div>
                            <div className="text-xs text-muted-foreground">{d.volunteerEmail}</div>
                          </TableCell>
                          <TableCell>{d.volunteerDistrict ?? d.district}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(d.startDate)} - {formatDate(d.endDate)}</TableCell>
                          <TableCell>{d.hoursLogged}h</TableCell>
                          <TableCell><Badge variant="outline" className={statusClass(d.status)}>{d.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {currentDeployments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            No volunteers deployed to this program yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {activePrograms.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No open or in-progress programs are available for deployment in your scope.
            </CardContent>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}

export default DeploymentsPage;
