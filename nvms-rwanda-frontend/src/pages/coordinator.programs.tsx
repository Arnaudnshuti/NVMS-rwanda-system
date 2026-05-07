import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { ProgramCard } from "@/components/ProgramCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROGRAMS, RWANDA_DISTRICTS } from "@/lib/mock-data";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator } from "@/lib/portal-access";
import { createProgramApi, nvmsApiEnabled } from "@/lib/nvms-api";
import { useMemo, useState } from "react";


function CoordinatorPrograms() {
  const { user } = useAuth();
  const visiblePrograms = programsVisibleToCoordinator(user, PROGRAMS);
  const apiOn = nvmsApiEnabled();
  const myDistrict = user?.role === "coordinator" ? (user.district ?? "") : "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slotsTotal, setSlotsTotal] = useState(10);
  const [requiredSkills, setRequiredSkills] = useState("");
  const [busy, setBusy] = useState(false);

  const districtOptions = useMemo(() => {
    if (user?.role === "coordinator" && myDistrict) return [myDistrict];
    return RWANDA_DISTRICTS;
  }, [user?.role, myDistrict]);

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Programs"
        description="Create, edit and manage all volunteer programs in your regions."
        actions={
          <Dialog>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" /> New program</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create new program</DialogTitle>
                <DialogDescription>Define a new volunteer program for deployment.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!apiOn) {
                    toast.success("Program created (demo).");
                    return;
                  }
                  setBusy(true);
                  const res = await createProgramApi({
                    title: title.trim(),
                    description: description.trim(),
                    category,
                    district,
                    startDate,
                    endDate,
                    slotsTotal: Number(slotsTotal),
                    requiredSkills: requiredSkills
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    status: "open",
                  });
                  setBusy(false);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Program created.");
                }}
              >
                <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{["Education","Health","Environment","Agriculture","Community","Emergency"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>District</Label>
                    <Select value={district} onValueChange={setDistrict}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{districtOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                  <div><Label>Slots</Label><Input type="number" min="1" required value={String(slotsTotal)} onChange={(e) => setSlotsTotal(Number(e.target.value || 1))} /></div>
                  <div><Label>Required skills</Label><Input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="Teaching, First Aid" /></div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={busy || !category || !district}>
                    {busy ? "Creating..." : "Create program"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visiblePrograms.map((p) => (
          <ProgramCard key={p.id} program={p} footer={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" disabled title="Program editing UI is not implemented yet.">Edit</Button>
              <Button size="sm" className="flex-1" disabled title="Program management UI is not implemented yet.">Manage</Button>
            </div>
          } />
        ))}
      </div>
    </PortalShell>
  );
}

export default CoordinatorPrograms;
