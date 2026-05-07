import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { ProgramCard } from "@/components/ProgramCard";
import { Button } from "@/components/ui/button";
import { PROGRAMS } from "@/lib/mock-data";


function AdminPrograms() {
  return (
    <PortalShell role="admin">
      <PageHeader title="All Programs" description="National view of every volunteer program." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PROGRAMS.map((p) => (
          <ProgramCard key={p.id} program={p} footer={<Button size="sm" variant="outline" className="w-full">View details</Button>} />
        ))}
      </div>
    </PortalShell>
  );
}

export default AdminPrograms;
