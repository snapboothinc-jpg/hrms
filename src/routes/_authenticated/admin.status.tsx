import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/admin/status")({
  head: () => ({ meta: [{ title: "System status — Priority Handling Logistics, Inc." }] }),
  component: SystemStatusPage,
});

function SystemStatusPage() {
  const status = useQuery({
    queryKey: ["system", "health"],
    queryFn: async () => {
      const response = await fetch("/api/public/health", { cache: "no-store" });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("System status response was invalid.");
      }
      return (await response.json()) as {
        status: "ok" | "degraded";
        checks: { backend_config: boolean };
        time: string;
      };
    },
    retry: 1,
  });

  return (
    <div>
      <PageHeader title="Support & system status" description="Application service health." />
      <Panel title="Service status">
        {status.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : status.error ? (
          <p role="alert" className="text-sm text-destructive">
            Status check failed: {status.error.message}
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-muted-foreground">Overall</dt>
              <dd>{status.data?.status === "ok" ? "Operational" : "Degraded"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Backend configuration</dt>
              <dd>{status.data?.checks.backend_config ? "Configured" : "Unavailable"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Checked at</dt>
              <dd>
                {status.data?.time ? new Date(status.data.time).toLocaleString() : "Unavailable"}
              </dd>
            </div>
          </dl>
        )}
      </Panel>
    </div>
  );
}
