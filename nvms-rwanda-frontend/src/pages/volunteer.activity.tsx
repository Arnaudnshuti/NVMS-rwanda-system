import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_LOGS, ASSIGNMENTS, PROGRAMS, type ActivityLog } from "@/lib/mock-data";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";


function ActivityPage() {
  return (
    <PortalShell role="volunteer">
      <ActivityPageInner />
    </PortalShell>
  );
}

function ActivityPageInner() {
  const { user } = useAuth();
  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    setLogs(ACTIVITY_LOGS.filter((l) => l.volunteerId === v.id));
  }, [v.id]);
  const [form, setForm] = useState({ programId: "", date: new Date().toISOString().slice(0, 10), hours: "", description: "" });

  const myAssignments = ASSIGNMENTS.filter((a) => a.volunteerId === v.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog: ActivityLog = {
      id: "l" + Date.now(),
      volunteerId: v.id,
      programId: form.programId,
      date: form.date,
      hours: Number(form.hours),
      description: form.description,
      status: "pending",
    };
    setLogs([newLog, ...logs]);
    setForm({ programId: "", date: new Date().toISOString().slice(0, 10), hours: "", description: "" });
    toast.success("Activity submitted for approval");
  };

  return (
    <>
      <PageHeader
        title="Activity Log"
        description={
          <>
            Quick daily logs for coordinator approval. For each <strong>deployment</strong>, use{" "}
            <Link to="/volunteer/assignments" className="font-semibold text-primary underline">My assignments</Link>{" "}
            to file official program activity reports (required narrative per assigned program).
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Log new activity</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Program</Label>
                <Select value={form.programId} onValueChange={(v) => setForm({ ...form, programId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                  <SelectContent>
                    {myAssignments.map((a) => <SelectItem key={a.programId} value={a.programId}>{a.programTitle}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Hours</Label><Input type="number" step="0.5" min="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required /></div>
              <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="What did you do?" /></div>
              <Button type="submit" className="w-full" disabled={!form.programId}>Submit log</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Activity history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {logs.map((l) => {
              const program = PROGRAMS.find((p) => p.id === l.programId);
              return (
                <div key={l.id} className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{program?.title || "—"}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{l.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{format(new Date(l.date), "MMM d, yyyy")} · {l.hours}h</p>
                  </div>
                  <Badge variant="outline" className={l.status === "approved" ? "border-success/30 bg-success/10 text-success" : l.status === "rejected" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/15 text-warning-foreground"}>
                    {l.status}
                  </Badge>
                </div>
              );
            })}
            {logs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No activity logged yet.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default ActivityPage;
