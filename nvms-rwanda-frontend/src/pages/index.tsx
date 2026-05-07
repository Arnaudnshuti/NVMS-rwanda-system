import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Users, MapPin, BarChart3, Sparkles, ShieldCheck, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { NATIONAL_KPIS } from "@/lib/mock-data";
import heroImage from "@/assets/hero-volunteers.jpg";
import coatOfArmsBlue from "@/assets/rwanda-coat-of-arms-blue.png";


function Index() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-hero">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/75 to-primary/30" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-28">
            <div className="flex flex-col justify-center text-white">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("site.eyebrow")}
              </div>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] sm:text-5xl md:text-6xl">
                {t("site.heroTitle")}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                {t("site.heroSubtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                  <Link to="/register">{t("site.ctaRegister")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                  <Link to="/programs">{t("site.ctaBrowse")}</Link>
                </Button>
              </div>
            </div>
            <div className="relative hidden items-center justify-center md:flex">
              <div className="absolute inset-0 rounded-full bg-white/5 blur-3xl" />
              <img
                src={coatOfArmsBlue}
                alt="Republic of Rwanda coat of arms"
                className="relative h-72 w-72 rounded-full border border-white/25 bg-white/95 p-5 object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)] lg:h-96 lg:w-96 lg:p-7"
                width={384}
                height={384}
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-10 sm:px-6 md:grid-cols-4">
            <Stat label={t("site.statsVolunteers")} value={NATIONAL_KPIS.totalVolunteers.toLocaleString()} />
            <Stat label={t("site.statsPrograms")} value={NATIONAL_KPIS.activePrograms} />
            <Stat label={t("site.statsHours")} value={NATIONAL_KPIS.totalHours.toLocaleString()} />
            <Stat label={t("site.statsDistricts")} value={`${NATIONAL_KPIS.districtsCovered} / 30`} />
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">{t("site.howItWorksTag")}</span>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t("site.howItWorksTitle")}</h2>
            <p className="mt-4 text-muted-foreground">{t("site.howItWorksDesc")}</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Feature icon={Users} title="Digital registration" desc="Citizens register online, submit skills & ID, and get verified by local coordinators." />
            <Feature icon={MapPin} title="Smart deployment" desc="Volunteers are matched to programs by district, skills and availability — powered by AI suggestions." />
            <Feature icon={BarChart3} title="Real-time monitoring" desc="Activities, hours and outcomes are logged continuously and visualised in the ministry dashboard." />
            <Feature icon={Sparkles} title="Intelligent analytics" desc="AI-generated insights highlight trends, gaps and under-served districts." />
            <Feature icon={HeartHandshake} title="Program coordination" desc="Coordinators plan, recruit, approve and report — all from a single workspace." />
            <Feature icon={ShieldCheck} title="Transparent & secure" desc="Role-based access, audit trails and Rwanda-hosted data for full accountability." />
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-primary">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center text-primary-foreground sm:px-6">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t("site.ctaReadyTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">{t("site.ctaReadyDesc")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                <Link to="/register">{t("common.getStarted")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <Link to="/about">{t("common.learnMore")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-primary sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Users; title: string; desc: string }) {
  return (
    <Card className="border-border/60 transition-all hover:shadow-elegant">
      <CardContent className="p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

export default Index;
