import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { VOLUNTEERS } from "@/lib/mock-data";
import { coordinatorDistrictScope } from "@/lib/portal-access";

function CoordinatorMessagesPage() {
  const { user } = useAuth();
  const scope = coordinatorDistrictScope(user);
  const district = user?.district ?? "";

  const recipients = useMemo(() => {
    if (scope === null) return VOLUNTEERS;
    if (!scope.length) return [];
    return VOLUNTEERS.filter((v) => scope.includes(v.district));
  }, [scope]);

  const [audience, setAudience] = useState<"all" | "verified" | "pending">("all");
  const [channel, setChannel] = useState<"inapp" | "email" | "sms" | "all">("inapp");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const filtered = recipients.filter((v) => {
    if (audience === "all") return true;
    return v.status === audience;
  });

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Add a subject and message.");
      return;
    }
    toast.success("Message queued (demo)", {
      description: `Audience: ${audience}. Channel: ${channel}. Recipients: ${filtered.length}. Backend will deliver and track receipts.`,
    });
    setSubject("");
    setMessage("");
  };

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Messages"
        description={
          district
            ? `Send targeted or broadcast messages to volunteers registered in ${district}. Delivery (Email/SMS) requires backend gateway integration.`
            : "Send targeted or broadcast messages to volunteers in your assigned district."
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              Compose message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={send}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All volunteers (district)</SelectItem>
                      <SelectItem value="verified">Verified only</SelectItem>
                      <SelectItem value="pending">Pending verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inapp">In-app</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="all">All channels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Reporting reminder — this week" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Write your message in Kinyarwanda/English/French…" />
              </div>
              <Button type="submit">Queue message</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">In scope</span>
              <Badge variant="secondary">{recipients.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">This message</span>
              <Badge variant="outline">{filtered.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Backend should store each broadcast, audience query, delivery attempts, and receipts for audit and follow-up.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

export default CoordinatorMessagesPage;

