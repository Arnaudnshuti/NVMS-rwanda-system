import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Download, FileText } from "lucide-react";
import { AI_REPORT_SUMMARY } from "@/lib/mock-data";
import { toast } from "sonner";
import { adminDownloadReportApi, adminReportSummaryApi, nvmsApiEnabled, type ApiReportSummary } from "@/lib/nvms-api";


function AdminReportsPage() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [apiSummary, setApiSummary] = useState<ApiReportSummary | null>(null);

  useEffect(() => {
    if (!nvmsApiEnabled()) return;
    void (async () => {
      const r = await adminReportSummaryApi();
      if (r.ok) setApiSummary(r.data);
    })();
  }, []);

  const generate = () => {
    void (async () => {
      setLoading(true);
      setSummary(null);
      if (nvmsApiEnabled()) {
        const r = await adminReportSummaryApi();
        setLoading(false);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setApiSummary(r.data);
        setSummary(
          `**Generated at:** ${new Date(r.data.generatedAt).toLocaleString()}\n\n` +
            `**Users:** ${r.data.metrics.totalUsers} total (${r.data.metrics.volunteers} volunteers, ${r.data.metrics.coordinators} coordinators)\n\n` +
            `**Programs:** ${r.data.metrics.programs} total, ${r.data.metrics.activePrograms} active.\n\n` +
            `**Applications:** ${r.data.metrics.applications}\n\n` +
            `**Top districts by volunteers:** ${r.data.byDistrict
              .slice(0, 5)
              .map((d) => `${d.district} (${d.volunteers})`)
              .join(", ")}`
        );
        toast.success("AI report generated");
        return;
      }
      setTimeout(() => {
        setSummary(AI_REPORT_SUMMARY);
        setLoading(false);
        toast.success("AI report generated");
      }, 1600);
    })();
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="AI Reports"
        description="Automatically generated insights and executive summaries."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              if (!nvmsApiEnabled()) {
                toast.success("Report exported");
                return;
              }
              const r = await adminDownloadReportApi("csv");
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              const url = URL.createObjectURL(r.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "nvms-report.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        }
      />

      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-accent" /> Quarterly Executive Summary
            </div>
            <p className="mt-1 text-sm text-muted-foreground">AI analyzes participation, trends and under-served regions.</p>
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate summary</>}
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Executive Summary — Q2 2026</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {summary.split("\n\n").map((para, i) => (
                <p key={i} className="mb-3 text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {["Monthly participation report", "District coverage report", "Program impact report"].map((title) => (
          <Card key={title}>
            <CardContent className="p-5">
              <FileText className="h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Generated weekly · PDF & Excel</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!nvmsApiEnabled()) return toast.success("Download queued");
                    const r = await adminDownloadReportApi("pdf");
                    if (!r.ok) return toast.error(r.error);
                    const url = URL.createObjectURL(r.blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "nvms-report.pdf";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="mr-2 h-3.5 w-3.5" /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!nvmsApiEnabled()) return toast.success("Download queued");
                    const r = await adminDownloadReportApi("xlsx");
                    if (!r.ok) return toast.error(r.error);
                    const url = URL.createObjectURL(r.blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "nvms-report.xlsx";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="mr-2 h-3.5 w-3.5" /> Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalShell>
  );
}

export default AdminReportsPage;
