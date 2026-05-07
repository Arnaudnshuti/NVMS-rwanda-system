import { Link } from "react-router-dom";
import { useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPlatformMasterData, savePlatformMasterData } from "@/lib/platform-config";
import { nvmsApiEnabled, putPlatformConfigApi } from "@/lib/nvms-api";


function SettingsPage() {
  const [volCatText, setVolCatText] = useState(() => getPlatformMasterData().volunteerCategories.join("\n"));
  const [progTypesText, setProgTypesText] = useState(() => getPlatformMasterData().programTypes.join("\n"));

  const saveTaxonomy = () => {
    void (async () => {
      const volunteerCategories = volCatText.split("\n").map((s) => s.trim()).filter(Boolean);
      const programTypes = progTypesText.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!volunteerCategories.length || !programTypes.length) {
        toast.error("Enter at least one volunteer category and one program type.");
        return;
      }
      if (nvmsApiEnabled()) {
        const res = await putPlatformConfigApi({ volunteerCategories, programTypes });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("National taxonomy saved", {
          description: "Stored in the ministry database for this environment.",
        });
        return;
      }
      savePlatformMasterData({ volunteerCategories, programTypes });
      toast.success("National taxonomy saved for this browser", {
        description: "Volunteer categories & program archetypes propagate to coordinators once the backing service is wired.",
      });
    })();
  };

  return (
    <PortalShell role="admin">
      <PageHeader title="Settings" description="Configure platform-wide options." />
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Security & compliance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Review invite, verification, MFA reset, and export events in the immutable audit stream (sample data until backend connects).</p>
          <Button variant="outline" asChild><Link to="/admin/audit">Open audit log</Link></Button>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">National taxonomy</CardTitle>
          <CardDescription>Volunteer cohort labels and deployment archetypes (MINALOC configuration — stored locally in this prototype).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="vol-cats">Volunteer categories (one per line)</Label>
            <Textarea id="vol-cats" rows={8} value={volCatText} onChange={(e) => setVolCatText(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="prog-types">Program types / templates (one per line)</Label>
            <Textarea id="prog-types" rows={8} value={progTypesText} onChange={(e) => setProgTypesText(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="button" onClick={saveTaxonomy}>Save taxonomy</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const d = getPlatformMasterData();
                setVolCatText(d.volunteerCategories.join("\n"));
                setProgTypesText(d.programTypes.join("\n"));
                toast.message("Reloaded saved values");
              }}
            >
              Reload from storage
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Organization name</Label><Input defaultValue="Ministry of Local Government — Rwanda" /></div>
            <div><Label>Contact email</Label><Input defaultValue="volunteer@minaloc.gov.rw" /></div>
            <div><Label>Support phone</Label><Input defaultValue="+250 788 000 000" /></div>
            <Button onClick={() => toast.success("Saved")}>Save changes</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications & AI</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { k: "Email new volunteer verifications", on: true },
              { k: "SMS notifications for deployments", on: true },
              { k: "Auto-generate weekly AI reports", on: true },
              { k: "Smart-match suggestions enabled", on: true },
              { k: "Anomaly detection (inactive volunteers)", on: false },
            ].map((item) => (
              <div key={item.k} className="flex items-center justify-between">
                <Label className="text-sm font-normal">{item.k}</Label>
                <Switch defaultChecked={item.on} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

export default SettingsPage;
