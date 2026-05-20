import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Award, CheckCircle2, Clock, Download, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { downloadMyCertificateApi, fetchMyCertificatesApi, type ApiCertificate, type ApiCertificateSummary } from "@/lib/nvms-api";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-RW", { year: "numeric", month: "short", day: "numeric" });
}

function CertificatesPage() {
  return (
    <PortalShell role="volunteer">
      <CertificatesPageInner />
    </PortalShell>
  );
}

function CertificatesPageInner() {
  const [summary, setSummary] = useState<ApiCertificateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");

  const loadCertificates = async () => {
    setLoading(true);
    const res = await fetchMyCertificatesApi();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSummary(res.data);
  };

  useEffect(() => {
    void loadCertificates();
  }, []);

  const issued = useMemo(() => summary?.certificates.filter((c) => c.status === "issued") ?? [], [summary]);
  const pending = useMemo(() => summary?.certificates.filter((c) => c.status !== "issued") ?? [], [summary]);
  const approvedHours = issued.reduce((sum, c) => sum + c.hoursServed, 0);
  const threshold = summary?.policy.ministryCertificateThreshold ?? 3;

  const download = async (cert: ApiCertificate) => {
    setDownloadingId(cert.assignmentId);
    const res = await downloadMyCertificateApi(cert.assignmentId);
    setDownloadingId("");
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    downloadBlob(res.blob, `nvms-certificate-${cert.programTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  };

  return (
    <>
      <PageHeader
        title="My Certificates"
        description="Certificates are generated from your real assignments and approved field reports."
        actions={<Button variant="outline" onClick={loadCertificates} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Issued certificates" value={loading ? "..." : issued.length} icon={<Award className="h-5 w-5" />} accent="primary" />
        <StatCard label="Approved hours" value={loading ? "..." : approvedHours} icon={<Clock className="h-5 w-5" />} accent="success" />
        <StatCard label="Ministry threshold" value={`${summary?.completedEligibleCount ?? 0} / ${threshold}`} icon={<ShieldCheck className="h-5 w-5" />} accent="accent" />
        <StatCard label="Pending records" value={loading ? "..." : pending.length} icon={<FileText className="h-5 w-5" />} accent="warning" />
      </div>

      <Alert className="mt-6 border-primary/30 bg-primary/5">
        <AlertTitle>{summary?.eligibleForMinistryCertificate ? "Ministry recognition threshold reached" : "Certificate eligibility"}</AlertTitle>
        <AlertDescription>
          A certificate is issued when an assignment has approved field report hours.
          The ministry recognition threshold is <strong>{threshold}</strong> issued certificate(s), with no active sanctions.
        </AlertDescription>
      </Alert>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {loading && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Loading certificate records...
          </div>
        )}

        {!loading && issued.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No issued certificates yet. Submit field reports and wait for your coordinator to approve them.
          </div>
        )}

        {issued.map((cert) => (
          <Card key={cert.id} className="overflow-hidden border-border/60">
            <div className="bg-gradient-hero p-6 text-white">
              <Award className="h-10 w-10" />
              <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/70">Certificate of Service</div>
              <h3 className="mt-1 font-display text-lg font-bold">{cert.programTitle}</h3>
            </div>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Approved hours</div><div className="font-semibold">{cert.hoursServed}h</div></div>
                <div><div className="text-xs text-muted-foreground">Issued</div><div className="font-semibold">{formatDate(cert.issuedAt)}</div></div>
                <div><div className="text-xs text-muted-foreground">District</div><div className="font-semibold">{cert.programDistrict}</div></div>
                <div><div className="text-xs text-muted-foreground">Completed</div><div className="font-semibold">{formatDate(cert.endDate)}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Signed by</div><div className="font-semibold">{cert.signedBy}</div></div>
              </div>
              <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => download(cert)} disabled={downloadingId === cert.assignmentId}>
                <Download className="mr-2 h-4 w-4" /> {downloadingId === cert.assignmentId ? "Preparing PDF..." : "Download PDF"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {pending.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Not eligible yet</CardTitle>
            <CardDescription>These real assignments still need approved report hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((cert) => (
              <div key={cert.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{cert.programTitle}</div>
                  <div className="mt-1 text-muted-foreground">{cert.reason}</div>
                </div>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {cert.hoursServed} approved hour(s)
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default CertificatesPage;
