import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Send, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  createProgramApi,
  deleteProgramApi,
  fetchAdminProgramsFromApi,
  getPublicPlatformConfigApi,
  updateProgramApi,
  type ProgramMutation,
} from "@/lib/nvms-api";
import { getPlatformMasterData, normalizeProgramCategories, savePlatformMasterData } from "@/lib/platform-config";
import { sectorsForDistrict } from "@/lib/rwanda-sectors";

type Program = Awaited<ReturnType<typeof fetchAdminProgramsFromApi>>[number];

const STATUSES = ["draft", "open", "in_progress", "completed"] as const;

type ProgramFormState = {
  title: string;
  description: string;
  category: string;
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
    sector: "",
    startDate: "",
    endDate: "",
    slotsTotal: "10",
    requiredSkills: "",
    status: "draft",
  };
}

function formFromProgram(program: Program): ProgramFormState {
  return {
    title: program.title,
    description: program.description,
    category: program.category,
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

function mutationFromForm(form: ProgramFormState, district: string): ProgramMutation | null {
  if (!form.title.trim() || !form.description.trim() || !form.category || !district || !form.startDate || !form.endDate) return null;
  const slotsTotal = Number(form.slotsTotal);
  if (!Number.isInteger(slotsTotal) || slotsTotal < 1) return null;
  if (new Date(form.endDate) < new Date(form.startDate)) return null;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    district,
    sector: form.sector.trim() || undefined,
    startDate: form.startDate,
    endDate: form.endDate,
    slotsTotal,
    requiredSkills: parseSkills(form.requiredSkills),
    status: form.status,
  };
}

function CoordinatorPrograms() {
  const { user } = useAuth();
  const myDistrict = user?.role === "coordinator" ? (user.district ?? "") : "";
  const [programs, setPrograms] = useState<Program[]>([]);
  const [categories, setCategories] = useState<string[]>(() => getPlatformMasterData().programTypes);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [details, setDetails] = useState<Program | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Program | null>(null);
  const [form, setForm] = useState<ProgramFormState>(emptyForm());
  const [busy, setBusy] = useState(false);

  const districtPrograms = useMemo(
    () => programs.filter((p) => !myDistrict || p.district === myDistrict),
    [myDistrict, programs],
  );
  const sectorOptions = useMemo(
    () => sectorsForDistrict(myDistrict, districtPrograms.map((p) => p.sector ?? "")),
    [districtPrograms, myDistrict],
  );

  const load = async () => {
    try {
      const [programRows, configRows] = await Promise.all([fetchAdminProgramsFromApi(), getPublicPlatformConfigApi()]);
      setPrograms(programRows);
      if (configRows.ok) {
        const nextCategories = normalizeProgramCategories(configRows.data.programTypes);
        setCategories(nextCategories);
        savePlatformMasterData({
          volunteerCategories: configRows.data.volunteerCategories,
          programTypes: nextCategories,
          organizationName: configRows.data.organizationName,
          contactEmail: configRows.data.contactEmail,
          supportPhone: configRows.data.supportPhone,
          featureFlags: configRows.data.featureFlags,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load programs");
      setPrograms([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), status: "open" });
    setFormOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditing(program);
    setForm(formFromProgram(program));
    setFormOpen(true);
  };

  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = mutationFromForm(form, myDistrict);
    if (!body) {
      toast.error("Check required fields, dates, category, and total slots.");
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
    toast.success("Program published.");
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
    <PortalShell role="coordinator">
      <PageHeader
        title="Programs"
        description={myDistrict ? `Create, edit, publish, and manage programs in ${myDistrict} District.` : "Create, edit, publish, and manage programs in your assigned district."}
        actions={<Button onClick={openCreate} disabled={!myDistrict}><Plus className="mr-1.5 h-4 w-4" /> New program</Button>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {districtPrograms.map((p) => (
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

      {!districtPrograms.length && (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No programs found for your district yet.
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit program" : "New district program"}</DialogTitle>
            <DialogDescription>
              Coordinators can only manage programs assigned to their own district.
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
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <Input value={myDistrict} disabled />
              </div>
              <div>
                <Label>Sector</Label>
                <Select value={form.sector || "__district_wide__"} onValueChange={(sector) => setForm({ ...form, sector: sector === "__district_wide__" ? "" : sector })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__district_wide__">No sector / district-wide</SelectItem>
                    {sectorOptions.map((sector) => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">Optional. Leave district-wide when the program covers the whole district.</p>
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
              <Button type="submit" disabled={busy || !myDistrict}>{busy ? "Saving..." : "Save program"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(details)} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{details?.title}</DialogTitle>
            <DialogDescription>{details?.description}</DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{details.status.replace("_", " ")}</Badge>
                <Badge variant="secondary">{details.category}</Badge>
                <Badge variant="secondary">{details.district}{details.sector ? ` / ${details.sector}` : ""}</Badge>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Start date" value={details.startDate} />
                <Detail label="End date" value={details.endDate} />
                <Detail label="Volunteer slots" value={`${details.slotsFilled} / ${details.slotsTotal}`} />
                <Detail label="Coordinator" value={details.coordinator || user?.name || "Unassigned"} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Required skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {details.requiredSkills.length ? details.requiredSkills.map((s) => <Badge key={s} variant="outline">{s}</Badge>) : <span className="text-muted-foreground">None listed</span>}
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
              This will permanently delete <strong>{pendingDelete?.title}</strong> and its related applications, assignments, and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
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

export default CoordinatorPrograms;
