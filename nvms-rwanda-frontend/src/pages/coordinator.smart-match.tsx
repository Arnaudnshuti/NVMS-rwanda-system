import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  coordinatorSmartMatchApi,
  fetchAdminProgramsFromApi,
  patchApplicationApi,
  type ApiSmartMatch,
} from "@/lib/nvms-api";

type ProgramOption = {
  id: string;
  title: string;
  district: string;
  requiredSkills: string[];
  slotsFilled: number;
  slotsTotal: number;
};

function SmartMatchPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const visiblePrograms = useMemo(() => programs, [programs]);
  const [programId, setProgramId] = useState("");
  const [running, setRunning] = useState(false);
  const [assigningId, setAssigningId] = useState("");
  const [results, setResults] = useState<ApiSmartMatch[] | null>(null);

  useEffect(() => {
    void fetchAdminProgramsFromApi().then(setPrograms).catch(() => toast.error("Could not load programs"));
  }, []);

  useEffect(() => {
    if (!visiblePrograms.length) return;
    if (!programId || !visiblePrograms.some((p) => p.id === programId)) {
      setProgramId(visiblePrograms[0].id);
    }
  }, [visiblePrograms, programId]);

  const program = visiblePrograms.find((p) => p.id === programId);

  useEffect(() => {
    setResults(null);
  }, [programId]);

  const runMatch = () => {
    void (async () => {
      setRunning(true);
      setResults(null);
      const r = await coordinatorSmartMatchApi(programId);
      setRunning(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResults(r.data);
      toast.success(`Generated ${r.data.length} ranked candidates`);
    })();
  };

  const acceptAndAssign = (candidate: ApiSmartMatch) => {
    void (async () => {
      if (!candidate.applicationId) {
        toast.error("This match has no application to accept.");
        return;
      }
      setAssigningId(candidate.volunteerId);
      const r = await patchApplicationApi(candidate.applicationId, { status: "accepted" });
      setAssigningId("");
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResults((current) => current?.filter((row) => row.volunteerId !== candidate.volunteerId) ?? null);
      toast.success(`${candidate.volunteerName} accepted and assigned`, {
        description: "The accepted application now appears as an assignment in Deployments.",
      });
    })();
  };

  if (!program) {
    return (
      <PortalShell role="coordinator">
        <PageHeader title="Smart Match" description="Rank program applicants by skills, district, availability, and service history." />
        <p className="text-sm text-muted-foreground">No programs in your assigned districts. Adjust scope or create a program first.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell role="coordinator">
      <PageHeader title="Smart Match" description="Rank applicants for a program, then accept one to create the assignment." />

      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select program</label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {visiblePrograms.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runMatch} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Analyzing..." : "Run match"}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Program details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Title</div><div className="font-medium">{program.title}</div></div>
            <div><div className="text-xs text-muted-foreground">District</div><div>{program.district}</div></div>
            <div>
              <div className="text-xs text-muted-foreground">Required skills</div>
              <div className="mt-1 flex flex-wrap gap-1">{program.requiredSkills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
            </div>
            <div><div className="text-xs text-muted-foreground">Slots</div><div>{program.slotsFilled} / {program.slotsTotal}</div></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-accent" /> Match results</CardTitle></CardHeader>
          <CardContent>
            {!results && !running && (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Click "Run match" to rank volunteers who already applied to this program.
              </div>
            )}
            {running && (
              <div className="space-y-3">
                <Progress value={60} className="h-1.5" />
                <p className="text-sm text-muted-foreground">Scoring program applicants against required skills, district, availability, and past performance...</p>
              </div>
            )}
            {results && (
              <div className="space-y-3">
                {results.map((r) => {
                  const name = r.volunteerName || r.volunteerId;
                  const district = r.district ?? "Unassigned";
                  const hours = r.hoursContributed;
                  const rating = r.rating;
                  return (
                    <div key={r.volunteerId} className="flex items-start gap-4 rounded-lg border border-border/60 p-4">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className="bg-primary/10 text-primary">{name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{name}</div>
                          <div className="flex items-center gap-2">
                            <div className="font-display text-lg font-bold text-accent">{r.score}%</div>
                            <Badge className="bg-accent/15 text-accent hover:bg-accent/15">{r.matchSource === "ai" ? "AI match" : "rules match"}</Badge>
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {district} · {hours}h · {rating.toFixed(1)} · application {r.applicationStatus?.replace("_", " ") ?? "submitted"}
                        </p>
                        <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground">"{r.reason}"</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => acceptAndAssign(r)} disabled={assigningId === r.volunteerId}>
                            {assigningId === r.volunteerId ? (
                              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Assigning...</>
                            ) : (
                              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accept & assign</>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate("/coordinator/volunteers")}>View profile</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

export default SmartMatchPage;
