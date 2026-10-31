import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({ meta: [{ title: "Help & support — Priority Handling Logistics, Inc." }] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div>
      <PageHeader title="Help & support" description="Guidance for using the HRMS." />
      <Panel title="Getting help">
        <p className="text-sm text-muted-foreground">
          For access, profile, or workflow questions, contact your HR administrator. Employees
          should contact their supervisor about performance, development goals, or training records.
        </p>
      </Panel>
    </div>
  );
}
