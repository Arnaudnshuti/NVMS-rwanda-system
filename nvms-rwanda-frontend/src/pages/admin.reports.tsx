import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, Download, FileSpreadsheet, FileText, Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import { adminDownloadReportApi, adminReportSummaryApi, listDistrictsApi, type ApiDistrict, type ApiReportSummary } from "@/lib/nvms-api";
import { toast } from "sonner";

const sectionOptions = [
  { id: "overview", label: "Summary" },
  { id: "districts", label: "District totals" },
  { id: "volunteers", label: "Volunteers and applications" },
  { id: "programs", label: "Programs" },
] as const;

const labels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  verified: "Verified",
  pending: "Pending",
};

function fmt(value: number) {
  return value.toLocaleString();
}

function label(value?: string | null) {
  if (!value) return "Not set";
  return labels[value] ?? value.replaceAll("_", " ");
}

function metric(summary: ApiReportSummary | null, key: string) {
  return summary?.metrics?.[key] ?? 0;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminReportsPage() {
  const [summary, setSummary] = useState<ApiReportSummary | null>(null);
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [district, setDistrict] = useState("all");
  const [view, setView] = useState<"volunteers" | "programs" | "districts">("volunteers");
  const [sections, setSections] = useState<string[]>(["overview", "volunteers", "programs"]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"" | "pdf" | "xlsx" | "csv">("");

  const loadReport = async (nextDistrict = district) => {
    setLoading(true);
    const result = await adminReportSummaryApi({ district: nextDistrict });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSummary(result.data);
  };

  useEffect(() => {
    void listDistrictsApi().then((result) => {
      if (result.ok) setDistricts(result.data);
      else toast.error(result.error);
    });
  }, []);

  useEffect(() => {
    void loadReport(district);
  }, [district]);

  const volunteerApplications = summary?.volunteerApplications ?? [];
  const programs = summary?.programs ?? [];
  const districtRows = summary?.byDistrict ?? [];
  const activeDistricts = districtRows.filter((row) => row.volunteers > 0 || (row.programs ?? 0) > 0);
  const selectedDistrictLabel = district === "all" ? "All districts" : district;

  const selectedSections = useMemo(() => (sections.length ? sections : ["overview"]), [sections]);

  const toggleSection = (id: string) => {
    setSections((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const exportReport = async (format: "pdf" | "xlsx" | "csv") => {
    setDownloading(format);
    const result = await adminDownloadReportApi(format, { district, sections: selectedSections });
    setDownloading("");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    downloadBlob(result.blob, `nvms-${district === "all" ? "national" : district.toLowerCase()}-report.${format}`);
    toast.success(`${format.toUpperCase()} report downloaded`);
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Reports"
        description="Choose a district, review volunteers and programs, then export only what you need."
        actions={
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[260px_1fr]">
          <div>
            <div className="mb-2 text-sm font-medium">District</div>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger><SelectValue placeholder="Choose district" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All districts</SelectItem>
                {districts.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">What to export</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {sectionOptions.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-3 text-sm">
                  <Checkbox checked={sections.includes(option.id)} onCheckedChange={() => toggleSection(option.id)} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Volunteers" value={loading ? "..." : fmt(metric(summary, "volunteers"))} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Programs" value={loading ? "..." : fmt(metric(summary, "programs"))} icon={<FileText className="h-5 w-5" />} accent="accent" />
        <StatCard label="Applications" value={loading ? "..." : fmt(metric(summary, "applications"))} icon={<CheckCircle2 className="h-5 w-5" />} accent="warning" />
        <StatCard label="Approved hours" value={loading ? "..." : fmt(metric(summary, "approvedHours"))} icon={<Clock className="h-5 w-5" />} accent="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{selectedDistrictLabel} report</CardTitle>
              <CardDescription>Showing real volunteer applications and programs from the backend.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={view === "volunteers" ? "default" : "outline"} onClick={() => setView("volunteers")}>Volunteers</Button>
              <Button size="sm" variant={view === "programs" ? "default" : "outline"} onClick={() => setView("programs")}>Programs</Button>
              <Button size="sm" variant={view === "districts" ? "default" : "outline"} onClick={() => setView("districts")}>Districts</Button>
            </div>
          </CardHeader>
          <CardContent>
            {view === "volunteers" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Trust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volunteerApplications.length ? volunteerApplications.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.volunteerName}</div>
                        <div className="text-xs text-muted-foreground">{row.volunteerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.programTitle}</div>
                        <div className="text-xs text-muted-foreground">{row.programCategory}</div>
                      </TableCell>
                      <TableCell>{row.programDistrict}</TableCell>
                      <TableCell><Badge variant="outline">{label(row.status)}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm">{label(row.volunteerVerificationStatus)}</div>
                        <div className="text-xs text-muted-foreground">{label(row.volunteerTrustStatus)}</div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No volunteer applications found for this selection.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {view === "programs" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Slots</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Reports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.length ? programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>
                        <div className="font-medium">{program.title}</div>
                        <div className="text-xs text-muted-foreground">{program.category}{program.sector ? ` / ${program.sector}` : ""}</div>
                      </TableCell>
                      <TableCell>{program.district}</TableCell>
                      <TableCell><Badge variant="outline">{label(program.status)}</Badge></TableCell>
                      <TableCell>{program.slotsFilled}/{program.slotsTotal}</TableCell>
                      <TableCell>{program.applications}</TableCell>
                      <TableCell>{program.reports}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No programs found for this selection.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {view === "districts" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>District</TableHead>
                    <TableHead>Volunteers</TableHead>
                    <TableHead>Programs</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districtRows.length ? districtRows.map((row) => (
                    <TableRow key={row.district}>
                      <TableCell className="font-medium">{row.district}</TableCell>
                      <TableCell>{fmt(row.volunteers)}</TableCell>
                      <TableCell>{fmt(row.programs ?? 0)}</TableCell>
                      <TableCell>{fmt(row.applications ?? 0)}</TableCell>
                      <TableCell>{fmt(row.hours ?? 0)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No district data found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export selected report</CardTitle>
              <CardDescription>Only checked sections will be included.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={() => exportReport("pdf")} disabled={downloading !== "" || loading || !summary}>
                {downloading === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => exportReport("xlsx")} disabled={downloading !== "" || loading || !summary}>
                {downloading === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Export Excel
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => exportReport("csv")} disabled={downloading !== "" || loading || !summary}>
                {downloading === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
              <div className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
                CSV can contain one table. If volunteers are selected, CSV exports volunteers; otherwise it exports programs or district totals.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick summary</CardTitle>
              <CardDescription>{selectedDistrictLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryLine label="Active districts" value={`${activeDistricts.length} / ${districtRows.length || 30}`} />
              <SummaryLine label="Verified volunteers" value={fmt(metric(summary, "verifiedVolunteers"))} />
              <SummaryLine label="Pending volunteer approval" value={fmt(metric(summary, "pendingVolunteers"))} />
              <SummaryLine label="Accepted applications" value={fmt(metric(summary, "acceptedApplications"))} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default AdminReportsPage;
