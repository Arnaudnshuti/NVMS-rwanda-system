import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { getPlatformMasterData, savePlatformMasterData } from "@/lib/platform-config";
import { getPlatformConfigApi, nvmsApiEnabled, putPlatformConfigApi } from "@/lib/nvms-api";
import { Bot, Mail, MessageSquare, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";

const DEFAULT_ORG = "Ministry of Local Government - Rwanda";
const DEFAULT_EMAIL = "volunteer@minaloc.gov.rw";
const DEFAULT_PHONE = "+250 788 000 000";

const FEATURE_FLAGS = [
  {
    key: "emailVolunteerVerifications",
    label: "Email new volunteer verifications",
    description: "Send email updates when volunteer approval status changes.",
    icon: Mail,
    defaultValue: true,
  },
  {
    key: "smsDeploymentNotifications",
    label: "SMS notifications for deployments",
    description: "Send deployment and assignment notices to volunteer phone numbers.",
    icon: MessageSquare,
    defaultValue: true,
  },
  {
    key: "weeklyAiReports",
    label: "Auto-generate weekly AI reports",
    description: "Prepare national summaries for admin review each week.",
    icon: Bot,
    defaultValue: true,
  },
  {
    key: "smartMatchSuggestions",
    label: "Smart-match suggestions enabled",
    description: "Allow coordinators to use suggested volunteer matches for programs.",
    icon: Sparkles,
    defaultValue: true,
  },
  {
    key: "anomalyDetection",
    label: "Anomaly detection",
    description: "Flag inactive volunteers and unusual reporting patterns.",
    icon: ShieldCheck,
    defaultValue: false,
  },
] as const;

type FeatureFlagKey = typeof FEATURE_FLAGS[number]["key"];
type FeatureFlags = Record<FeatureFlagKey, boolean>;

function defaultFeatureFlags(): FeatureFlags {
  return FEATURE_FLAGS.reduce((acc, item) => {
    acc[item.key] = item.defaultValue;
    return acc;
  }, {} as FeatureFlags);
}

function normalizeFlags(raw?: Record<string, boolean>): FeatureFlags {
  const defaults = defaultFeatureFlags();
  return FEATURE_FLAGS.reduce((acc, item) => {
    acc[item.key] = typeof raw?.[item.key] === "boolean" ? raw[item.key] : defaults[item.key];
    return acc;
  }, {} as FeatureFlags);
}

function linesToList(value: string) {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function SettingsPage() {
  const localDefaults = useMemo(() => getPlatformMasterData(), []);
  const [volCatText, setVolCatText] = useState(() => localDefaults.volunteerCategories.join("\n"));
  const [progTypesText, setProgTypesText] = useState(() => localDefaults.programTypes.join("\n"));
  const [organizationName, setOrganizationName] = useState(localDefaults.organizationName ?? DEFAULT_ORG);
  const [contactEmail, setContactEmail] = useState(localDefaults.contactEmail ?? DEFAULT_EMAIL);
  const [supportPhone, setSupportPhone] = useState(localDefaults.supportPhone ?? DEFAULT_PHONE);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(() => normalizeFlags(localDefaults.featureFlags));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyConfig = (data: {
    volunteerCategories: string[];
    programTypes: string[];
    organizationName?: string;
    contactEmail?: string;
    supportPhone?: string;
    featureFlags?: Record<string, boolean>;
  }) => {
    setVolCatText(data.volunteerCategories.join("\n"));
    setProgTypesText(data.programTypes.join("\n"));
    setOrganizationName(data.organizationName ?? DEFAULT_ORG);
    setContactEmail(data.contactEmail ?? DEFAULT_EMAIL);
    setSupportPhone(data.supportPhone ?? DEFAULT_PHONE);
    setFeatureFlags(normalizeFlags(data.featureFlags));
  };

  const loadSettings = async () => {
    if (!nvmsApiEnabled()) {
      applyConfig(getPlatformMasterData());
      toast.message("Reloaded saved browser settings");
      return;
    }
    setLoading(true);
    const r = await getPlatformConfigApi();
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    applyConfig(r.data);
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = () => {
    void (async () => {
      const volunteerCategories = linesToList(volCatText);
      const programTypes = linesToList(progTypesText);
      if (!volunteerCategories.length || !programTypes.length) {
        toast.error("Enter at least one volunteer category and one program type.");
        return;
      }
      if (!organizationName.trim() || !contactEmail.trim() || !supportPhone.trim()) {
        toast.error("Organization name, contact email, and support phone are required.");
        return;
      }

      setSaving(true);
      if (nvmsApiEnabled()) {
        const res = await putPlatformConfigApi({
          volunteerCategories,
          programTypes,
          organizationName: organizationName.trim(),
          contactEmail: contactEmail.trim(),
          supportPhone: supportPhone.trim(),
          featureFlags,
        });
        setSaving(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        applyConfig(res.data);
        toast.success("Settings saved", {
          description: "Platform configuration was stored in the ministry database.",
        });
        return;
      }

      savePlatformMasterData({
        volunteerCategories,
        programTypes,
        organizationName: organizationName.trim(),
        contactEmail: contactEmail.trim(),
        supportPhone: supportPhone.trim(),
        featureFlags,
      });
      setSaving(false);
      toast.success("Settings saved for this browser");
    })();
  };

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Settings"
        description="Manage platform master data, organization contact details, notifications, and AI features."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {loading ? "Loading..." : "Reload"}
            </Button>
            <Button type="button" onClick={saveSettings} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        )}
      />

      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Security & compliance</AlertTitle>
        <AlertDescription>
          Invite, verification, MFA reset, and export events are available in the audit stream.{" "}
          <Link to="/admin/audit" className="font-semibold text-primary underline">Open audit log</Link>
        </AlertDescription>
      </Alert>

      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Platform master data</CardTitle>
            <CardDescription>
              Central lists reused across the system. Program categories from this section appear in admin and coordinator program forms.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="vol-cats">Volunteer categories</Label>
              <Textarea id="vol-cats" rows={8} value={volCatText} onChange={(e) => setVolCatText(e.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Labels used to group volunteers by service profile, such as youth mentor, health auxiliary, or emergency responder.
              </p>
            </div>
            <div>
              <Label htmlFor="prog-types">Program categories</Label>
              <Textarea id="prog-types" rows={8} value={progTypesText} onChange={(e) => setProgTypesText(e.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                The category choices shown when creating or editing a program, such as Education, Health, Environment, or Emergency response.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>Public support details shown to users and used in platform communications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contact-email">Contact email</Label>
                <Input id="contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="support-phone">Support phone</Label>
                <Input id="support-phone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications & AI</CardTitle>
              <CardDescription>Feature switches are persisted with platform settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FEATURE_FLAGS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 rounded-md border border-border/70 p-3">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <Label htmlFor={item.key} className="text-sm font-medium">{item.label}</Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={item.key}
                      checked={featureFlags[item.key]}
                      onCheckedChange={(checked) => setFeatureFlags((prev) => ({ ...prev, [item.key]: checked }))}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}

export default SettingsPage;
