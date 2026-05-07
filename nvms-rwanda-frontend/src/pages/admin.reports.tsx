import { useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Download, FileText } from "lucide-react";
import { AI_REPORT_SUMMARY } from "@/lib/mock-data";
import { toast } from "sonner";


function AdminReportsPage() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = () => {
    setLoading(true);
    setSummary(null);
    setTimeout(() => {
      setSummary(AI_REPORT_SUMMARY);
      setLoading(false);
      toast.success("AI report generated");
    }, 1600);
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="AI Reports"
        description="Automatically generated insights and executive summaries."
        actions={<Button variant="outline" onClick={() => toast.success("Report exported")}><Download className="mr-1.5 h-4 w-4" /> Export</Button>}
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
              <Button size="sm" variant="outline" className="mt-4 w-full"><Download className="mr-2 h-3.5 w-3.5" /> Download</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalShell>
  );
}

export default AdminReportsPage;
