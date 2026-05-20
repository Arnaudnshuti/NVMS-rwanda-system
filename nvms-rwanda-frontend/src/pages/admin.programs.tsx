import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { ProgramCard } from "@/components/ProgramCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ProgramApplication } from "@/lib/program-applications";
import {
  createProgramApi,
  deleteProgramApi,
  fetchAdminProgramsFromApi,
  fetchMyApplicationsFromApi,
  listDistrictsApi,
  updateProgramApi,
  type ApiDistrict,
  type ProgramMutation,
} from "@/lib/nvms-api";
import { Eye, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Program = Awaited<ReturnType<typeof fetchAdminProgramsFromApi>>[number];

const CATEGORIES = ["Education", "Health", "Environment", "Agriculture", "Community", "Emergency"] as const;
const STATUSES = ["draft", "open", "in_progress", "completed"] as const;

type ProgramFormState = {
  title: string;
  description: string;
  category: string;
  districtValue: string;
  sector: string;
  startDate: string;
  endDate: string;
  slotsTotal: string;
  requiredSkills: string;
  status: Program["status"];
};

function emptyForm(): ProgramFormState {
  return {
    title: "",
    description: "",
    category: "",
    districtValue: "",
    sector: "",
    startDate: "",
    endDate: "",
    slotsTotal: "10",
    requiredSkills: "",
    status: "draft",
  };
}

function formFromProgram(program: Program, districts: ApiDistrict[]): ProgramFormState {
  const matchedDistrict = districts.find((d) => d.name === program.district);
  return {
    title: program.title,
    description: program.description,
    category: program.category,
    districtValue: matchedDistrict?.id ?? program.district,
    sector: program.sector ?? "",
    startDate: program.startDate,
    endDate: program.endDate,
    slotsTotal: String(program.slotsTotal),
    requiredSkills: program.requiredSkills.join(", "),
    status: program.status,
  };
}

function parseSkills(value: string) {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mutationFromForm(form: ProgramFormState, districts: ApiDistrict[]): ProgramMutation | null {
  const district = districts.find((d) => d.id === form.districtValue || d.name === form.districtValue);
  if (!form.title.trim() || !form.description.trim() || !form.category || !district || !form.startDate || !form.endDate) {
    return null;
  }
  const slotsTotal = Number(form.slotsTotal);
  if (!Number.isInteger(slotsTotal) || slotsTotal < 1) {
    return null;
  }
  if (new Date(form.endDate) < new Date(form.startDate)) return null;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    districtId: district.id,
    district: district.name,
    sector: form.sector.trim() || undefined,
    startDate: form.startDate,
    endDate: form.endDate,
    slotsTotal,
    requiredSkills: parseSkills(form.requiredSkills),
    status: form.status,
  };
}

function AdminPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [applications, setApplications] = useState<ProgramApplication[]>([]);
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [details, setDetails] = useState<Program | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Program | null>(null);
  const [form, setForm] = useState<ProgramFormState>(emptyForm());

  const load = useCallback(async () => {
    try {
      const [programRows, appRows, districtRows] = await Promise.all([
        fetchAdminProgramsFromApi(),
        fetchMyApplicationsFromApi(),
        listDistrictsApi(),
      ]);
      setPrograms(programRows);
      setApplications(appRows);
      if (districtRows.ok) setDistricts(districtRows.data);
      else toast.error(districtRows.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load programs");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => a.status.localeCompare(b.status) || a.startDate.localeCompare(b.startDate)),
    [programs],
  );
  const applicationsByProgram = useMemo(() => {
    const map = new Map<string, ProgramApplication[]>();
    for (const app of applications) {
      const list = map.get(app.programId) ?? [];
      list.push(app);
      map.set(app.programId, list);
    }
    return map;
  }, [applications]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditing(program);
    setForm(formFromProgram(program, districts));
    setFormOpen(true);
  };

  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = mutationFromForm(form, districts);
    if (!body) {
      toast.error("Check required fields, dates, district, and total slots.");
      return;
    }
    setBusy(true);
    const res = editing ? await updateProgramApi(editing.id, body) : await createProgramApi(body as ProgramMutation & {
      title: string;
      description: string;
      category: string;
      district: string;
      startDate: string;
      endDate: string;
      slotsTotal: number;
      requiredSkills: string[];
      status: Program["status"];
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Program updated." : "Program created.");
    setFormOpen(false);
    await load();
  };

  const publishProgram = async (program: Program) => {
    setBusy(true);
    const res = await updateProgramApi(program.id, { status: "open" });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Program published. Volunteers can now see it.");
    await load();
  };

  const removeProgram = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    const res = await deleteProgramApi(pendingDelete.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Program deleted.");
    setPendingDelete(null);
    await load();
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="All Programs"
        description="National backend view of every volunteer program. Drafts stay hidden from volunteers until published."
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add program</Button>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sortedPrograms.map((p) => (
          <ProgramCard
            key={p.id}
            program={p}
            footer={(
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => setDetails(p)}><Eye className="mr-1.5 h-4 w-4" /> View</Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button>
                <Button size="sm" disabled={busy || p.status !== "draft"} onClick={() => publishProgram(p)}><Send className="mr-1.5 h-4 w-4" /> Publish</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => setPendingDelete(p)}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
              </div>
            )}
          />
        ))}
      </div>

      {!sortedPrograms.length && (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No programs found in the backend database.
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit program" : "Add program"}</DialogTitle>
            <DialogDescription>
              Save as draft while preparing. Publish when volunteers should be able to see and apply.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveProgram}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as Program["status"] })}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>District</Label>
                <Select value={form.districtValue} onValueChange={(districtValue) => setForm({ ...form, districtValue })}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>{districts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sector</Label>
                <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Start date</Label>
                <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div>
                <Label>Total slots</Label>
                <Input type="number" min="1" required value={form.slotsTotal} onChange={(e) => setForm({ ...form, slotsTotal: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Required skills</Label>
                <Input value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} placeholder="Teaching, First Aid, Logistics" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save program"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(details)} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{details?.title}</DialogTitle>
            <DialogDescription>{details?.description}</DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-4 text-sm">
              {(() => {
                const programApps = applicationsByProgram.get(details.id) ?? [];
                const accepted = programApps.filter((a) => a.status === "accepted").length;
                return (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Applications" value={String(programApps.length)} />
                    <Metric label="Accepted" value={String(accepted)} />
                    <Metric label="Slots" value={`${accepted} / ${details.slotsTotal}`} />
                  </div>
                );
              })()}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{details.status.replace("_", " ")}</Badge>
                <Badge variant="secondary">{details.category}</Badge>
                <Badge variant="secondary">{details.district}{details.sector ? ` / ${details.sector}` : ""}</Badge>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Start date" value={details.startDate} />
                <Detail label="End date" value={details.endDate} />
                <Detail label="Coordinator" value={details.coordinator || "Unassigned"} />
                <Detail label="Volunteer slots" value={`${details.slotsFilled} / ${details.slotsTotal}`} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Required skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {details.requiredSkills.length ? details.requiredSkills.map((s) => <Badge key={s} variant="outline">{s}</Badge>) : <span className="text-muted-foreground">None listed</span>}
                </div>
              </div>
              <Separator />
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Real volunteer applicants</div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {(applicationsByProgram.get(details.id) ?? []).length ? (
                    (applicationsByProgram.get(details.id) ?? []).map((app) => (
                      <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3">
                        <div>
                          <div className="font-medium">{app.volunteerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.volunteerEmail}{app.volunteerDistrict ? ` - ${app.volunteerDistrict}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{app.status.replace("_", " ")}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
                      No real volunteer applications for this program yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{pendingDelete?.title}</strong> and remove its applications, assignments, reports, and report attachments from the backend database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDelete && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-destructive">This action cannot be undone.</div>
              <div className="mt-1 text-muted-foreground">
                Real applications linked to this program: {applicationsByProgram.get(pendingDelete.id)?.length ?? 0}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void removeProgram();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting..." : "Delete program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export default AdminPrograms;
