import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { Target, Eye, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";


function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-subtle">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">About the platform</span>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Coordinating a nation of volunteers</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Volunteer programs drive community development across Rwanda — but fragmented, manual processes make it hard to track participation, deploy the right people, and measure real impact. NVMS changes that.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <InfoCard icon={Target} title="Our Mission" desc="Provide a centralized, transparent digital platform that connects every volunteer with the programs where they can make the greatest impact." />
            <InfoCard icon={Eye} title="Our Vision" desc="A Rwanda where every citizen's willingness to serve is matched with a meaningful, well-coordinated opportunity — in every district." />
            <InfoCard icon={Heart} title="Our Values" desc="Transparency, inclusivity, data-driven decisions, and unwavering support for community development initiatives nationwide." />
          </div>
        </section>

        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl font-bold">Why a national system?</h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>Rwanda's volunteer programs span dozens of sectors and all 30 districts. Historically, coordination has relied on spreadsheets, paper forms, and ad-hoc communication. This limited the Ministry's ability to:</p>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Verify volunteers and prevent duplicate registrations</li>
                <li>Match skills with the right programs</li>
                <li>Track real-time deployment and participation</li>
                <li>Generate evidence-based reports for policy decisions</li>
              </ul>
              <p>NVMS brings all of this into one intelligent, secure platform — giving coordinators, volunteers and government officials the tools they need to serve Rwanda better.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoCard({ icon: Icon, title, desc }: { icon: typeof Target; title: string; desc: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

export default AboutPage;
