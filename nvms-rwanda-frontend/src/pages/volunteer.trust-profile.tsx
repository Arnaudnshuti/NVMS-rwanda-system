import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, FileCheck2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth, dispatchAuthRefresh } from "@/lib/auth";
import { patchRegistryUserByEmail } from "@/lib/account-registry";
import { isVolunteerVerified, resolveProfileTrustStatus } from "@/lib/portal-access";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nvmsApiEnabled, submitTrustProfileApi, uploadIdentityDocumentApi } from "@/lib/nvms-api";

const EDUCATION_LEVELS = [
  "Primary",
  "Lower secondary",
  "Upper secondary / A-level",
  "Technical / vocational certificate",
  "Associate degree",
  "Bachelor's degree",
  "Postgraduate diploma",
  "Master's degree",
  "Doctorate",
  "Prefer not to say",
] as const;

function fileMetaList(files: FileList | null, label: string) {
  if (!files?.length) return [];
  return Array.from(files).map((f) => ({ label, fileName: f.name }));
}

function TrustProfilePage() {
  return (
    <PortalShell role="volunteer">
      <TrustProfileInner />
    </PortalShell>
  );
}

function TrustProfileInner() {
  const { user } = useAuth();
  const [nationalId, setNationalId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [skills, setSkills] = useState("");
  const [profession, setProfession] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [idScan, setIdScan] = useState<FileList | null>(null);
  const [photo, setPhoto] = useState<FileList | null>(null);
  const [clearanceFiles, setClearanceFiles] = useState<FileList | null>(null);
  const [cvFiles, setCvFiles] = useState<FileList | null>(null);
  const [certFiles, setCertFiles] = useState<FileList | null>(null);
  const [otherFiles, setOtherFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (!user) return;
    setNationalId(user.nationalId ?? "");
    setEmergencyName(user.emergencyContactName ?? "");
    setEmergencyPhone(user.emergencyContactPhone ?? "");
    setSkills(user.trustSkillsSummary ?? "");
    setProfession(user.profession ?? "");
    setEducationLevel(user.educationLevel ?? "");
  }, [user]);

  if (!user) return null;

  const trust = resolveProfileTrustStatus(user);
  const accountOk = isVolunteerVerified(user);
  const isRegistry = String(user.id).startsWith("new-");
  const formLocked = trust === "pending_review" || trust === "verified";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      if (!accountOk) {
        toast.error("Your volunteer account must be approved before you can submit KYC.");
        return;
      }
      if (formLocked) {
        if (trust === "pending_review") toast.message("Already submitted", { description: "Wait for coordinator review." });
        else toast.success("You are already a trusted volunteer.");
        return;
      }
      if (!nationalId.trim() || !skills.trim() || !emergencyName.trim() || !emergencyPhone.trim()) {
        toast.error("Please fill all required fields.");
        return;
      }
      if (!profession.trim() || !educationLevel.trim() || educationLevel === "__none") {
        toast.error("Add your profession and education level—they travel with every deployment record.");
        return;
      }
      if (!idScan?.length || !photo?.length) {
        toast.error("Upload a scan of your national ID and a passport-style photo.");
        return;
      }
      if (!clearanceFiles?.length || !cvFiles?.length) {
        toast.error("Upload police clearance and your CV alongside ID and portrait.");
        return;
      }
      const identityDocuments = [
        ...fileMetaList(idScan, "National ID"),
        ...fileMetaList(photo, "Passport-style photo"),
        ...fileMetaList(clearanceFiles, "Police clearance / CBC"),
        ...fileMetaList(cvFiles, "CV"),
        ...fileMetaList(certFiles, "Professional certificate"),
        ...fileMetaList(otherFiles, "Supporting document"),
      ];

      if (nvmsApiEnabled()) {
        // Upload files first (real storage) then submit metadata for review.
        const uploads: { label: string; fileName: string }[] = [];
        const up = async (label: string, fl: FileList | null) => {
          if (!fl?.length) return;
          for (const f of Array.from(fl)) {
            const r = await uploadIdentityDocumentApi(label, f);
            if (!r.ok) throw new Error(r.error);
            uploads.push({ label: r.data.label, fileName: r.data.fileName });
          }
        };
        try {
          await up("National ID", idScan);
          await up("Passport-style photo", photo);
          await up("Police clearance / CBC", clearanceFiles);
          await up("CV", cvFiles);
          await up("Professional certificate", certFiles);
          await up("Supporting document", otherFiles);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
          return;
        }

        const res = await submitTrustProfileApi({
          nationalId: nationalId.trim(),
          emergencyContactName: emergencyName.trim(),
          emergencyContactPhone: emergencyPhone.trim(),
          trustSkillsSummary: skills.trim(),
          profession: profession.trim(),
          educationLevel: educationLevel.trim(),
          identityDocuments: uploads.length ? uploads : identityDocuments,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        dispatchAuthRefresh();
        toast.success("Submitted for review", {
          description:
            "The coordinator for your registered district will verify your documents. You will be notified when messaging is connected.",
        });
        return;
      }

      if (!isRegistry) {
        toast.info(
          "Demo account is pre-marked as trusted. This full workflow applies after you register your own volunteer account.",
        );
        return;
      }
      const ok = patchRegistryUserByEmail(user.email, {
        nationalId: nationalId.trim(),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
        trustSkillsSummary: skills.trim(),
        profession: profession.trim(),
        educationLevel: educationLevel.trim(),
        identityDocuments,
        profileTrustStatus: "pending_review",
      });
      if (!ok) {
        toast.error("Could not save — try signing in again.");
        return;
      }
      dispatchAuthRefresh();
      toast.success("Submitted for review", {
        description:
          "The coordinator for your registered district will verify your documents. You will be notified by email or SMS when the messaging service is connected.",
      });
    })();
  };

  return (
    <>
      <PageHeader
        title="Trusted volunteer profile"
        description="Upload official identity documents for review by the coordinator of the district where you registered — not another district. MINALOC retains national oversight."
      />

      {!accountOk && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account not approved yet</AlertTitle>
          <AlertDescription>
            After the coordinator for your registered district approves your registration, sign in with your email and password, then return here to complete KYC.
          </AlertDescription>
        </Alert>
      )}

      {accountOk && trust === "verified" && (
        <Alert className="mb-6 border-success/30 bg-success/10">
          <ShieldCheck className="h-4 w-4 text-success" />
          <AlertTitle>Trusted volunteer</AlertTitle>
          <AlertDescription>
            You have the trusted badge. You may apply to programs and be considered for deployment. Keep your profile and documents accurate.
          </AlertDescription>
        </Alert>
      )}

      {accountOk && trust === "pending_review" && (
        <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
          <FileCheck2 className="h-4 w-4" />
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>
            Your documents are with the coordinator for {user.district ? <strong>{user.district}</strong> : "your registered district"}. Program applications stay closed until approval.
          </AlertDescription>
        </Alert>
      )}

      {accountOk && trust === "rejected" && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Previous submission not approved</AlertTitle>
          <AlertDescription>Update your documents below and submit again for review.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Identity & documents
            </CardTitle>
            <CardDescription>
              Rwanda-focused bundle mirrors a serious application dossier—national ID, portrait, police clearance (certificate of conduct), CV, professional certificates where relevant, plus any attachments you would bring to District verification. Metadata only in this prototype; production stores encrypted blobs and hashes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="nid">National ID number *</Label>
                  <Input id="nid" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="e.g. 1 1990 8 …" required disabled={!accountOk || formLocked} />
                </div>
                <div>
                  <Label htmlFor="emg-name">Emergency contact name *</Label>
                  <Input id="emg-name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} required disabled={!accountOk || formLocked} />
                </div>
                <div>
                  <Label htmlFor="emg-phone">Emergency contact phone *</Label>
                  <Input id="emg-phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+250 …" required disabled={!accountOk || formLocked} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="skills">Skills & experience *</Label>
                  <Textarea id="skills" rows={4} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Teaching, first aid, languages, years of experience…" required disabled={!accountOk || formLocked} />
                </div>
                <div>
                  <Label htmlFor="prof">Profession *</Label>
                  <Input id="prof" value={profession} onChange={(e) => setProfession(e.target.value)} disabled={!accountOk || formLocked} placeholder="Occupation reflected on deployments" />
                </div>
                <div>
                  <Label>Highest education *</Label>
                  <Select
                    value={educationLevel || "__none"}
                    onValueChange={(v) => setEducationLevel(v === "__none" ? "" : v)}
                    disabled={!accountOk || formLocked}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Choose…</SelectItem>
                      {EDUCATION_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="id-file">National ID scan (PDF or image) *</Label>
                  <Input id="id-file" type="file" accept="image/*,.pdf" className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setIdScan(e.target.files)} />
                </div>
                <div>
                  <Label htmlFor="photo-file">Passport-style photo *</Label>
                  <Input id="photo-file" type="file" accept="image/*" className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setPhoto(e.target.files)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="clearance">Police clearance / certificate of conduct *</Label>
                  <Input id="clearance" type="file" accept="image/*,.pdf" className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setClearanceFiles(e.target.files)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cv">Curriculum vitae (PDF preferred) *</Label>
                  <Input id="cv" type="file" accept=".pdf,image/*" className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setCvFiles(e.target.files)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="certs">Professional certificates / diplomas (multiple)</Label>
                  <Input id="certs" type="file" accept="image/*,.pdf" multiple className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setCertFiles(e.target.files)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="extras">Other documents (motivation letters, sector endorsements…)</Label>
                  <Input id="extras" type="file" accept="image/*,.pdf,.doc,.docx" multiple className="cursor-pointer" disabled={!accountOk || formLocked} onChange={(e) => setOtherFiles(e.target.files)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!accountOk || formLocked}>
                  Submit for coordinator review
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/volunteer/profile">Edit basic profile</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Account</span>
                <Badge variant="outline" className={accountOk ? "border-success/30 bg-success/10 text-success" : ""}>{accountOk ? "Approved" : "Pending"}</Badge>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Trusted profile</span>
                <Badge variant="outline">
                  {trust === "verified" ? "Trusted" : trust === "pending_review" ? "In review" : trust === "rejected" ? "Rejected" : "Not submitted"}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why this step?</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              Two-step trust reduces impersonation: (1) the coordinator for the district you chose at registration approves your account, (2) that same district office reviews your official documents before deployment. MINALOC retains national oversight.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default TrustProfilePage;
