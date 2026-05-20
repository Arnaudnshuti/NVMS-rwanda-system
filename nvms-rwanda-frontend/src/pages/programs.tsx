import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteShell";
import { PROGRAMS, type Program } from "@/lib/mock-data";
import { ProgramCard } from "@/components/ProgramCard";
import { Button } from "@/components/ui/button";
import { fetchProgramsFromApi, nvmsApiEnabled } from "@/lib/nvms-api";
import { toast } from "sonner";


function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>(PROGRAMS);
  const open = programs.filter((p) => p.status === "open" || p.status === "in_progress");

  useEffect(() => {
    if (!nvmsApiEnabled()) return;
    void fetchProgramsFromApi()
      .then(setPrograms)
      .catch(() => toast.error("Could not load programs"));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-subtle">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-4xl font-bold">Active Programs</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Explore national volunteer programs currently recruiting. Sign up to apply and get deployed where you're needed most.</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {open.map((p) => (
              <ProgramCard key={p.id} program={p} footer={
                <Button asChild size="sm" className="w-full">
                  <Link to="/register">Apply</Link>
                </Button>
              } />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default ProgramsPage;
