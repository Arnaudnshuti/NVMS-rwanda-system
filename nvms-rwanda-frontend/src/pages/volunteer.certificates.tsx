import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Award, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";


const CERTS = [
  { id: "c1", title: "Youth Empowerment Workshops — Huye", hours: 48, issuedAt: "2026-04-30", signedBy: "Ministry of Local Government" },
  { id: "c2", title: "National Umuganda Day 2026", hours: 8, issuedAt: "2026-03-02", signedBy: "District of Gasabo" },
];

function CertificatesPage() {
  return (
    <PortalShell role="volunteer">
      <CertificatesPageInner />
    </PortalShell>
  );
}

function CertificatesPageInner() {
  const { user } = useAuth();
  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);
  const showDemoCerts = user.email.toLowerCase() === "volunteer@demo.rw";
  const eligibleForMinistryCert = v.programsCompleted >= 3;

  return (
    <>
      <PageHeader
        title="My Certificates"
        description="Ministry-recognized certificates deploy after your record shows high-quality participation. Official PDFs, QR verification, and benefits integration require the national API."
      />
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <AlertTitle>Eligibility (policy preview)</AlertTitle>
        <AlertDescription>
          National policy targets volunteers who complete <strong>at least three verified programs</strong> with approved field reports and no active sanctions.
          Your profile currently shows <strong>{v.programsCompleted}</strong> completed program(s) in this demo roster.
          {!eligibleForMinistryCert && " Keep serving and filing reports so coordinators can close programs and unlock recognition."}
        </AlertDescription>
      </Alert>
      <div className="grid gap-5 md:grid-cols-2">
        {!showDemoCerts && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No certificates yet. Complete verified programs to earn certificates of service (demo certificates appear for the demo volunteer account).
          </div>
        )}
        {showDemoCerts && CERTS.map((c) => (
          <Card key={c.id} className="overflow-hidden border-border/60">
            <div className="bg-gradient-hero p-6 text-white">
              <Award className="h-10 w-10" />
              <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/70">Certificate of Service</div>
              <h3 className="mt-1 font-display text-lg font-bold">{c.title}</h3>
            </div>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Hours served</div><div className="font-semibold">{c.hours}h</div></div>
                <div><div className="text-xs text-muted-foreground">Issued</div><div className="font-semibold">{c.issuedAt}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Signed by</div><div className="font-semibold">{c.signedBy}</div></div>
              </div>
              <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => toast.info("Certificate download will be available when backend is connected.")}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export default CertificatesPage;
