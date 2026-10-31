import { createFileRoute } from "@tanstack/react-router";

// Public health check: reports only liveness and whether required configuration is present.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const configured =
          !!process.env["SUPABASE_URL"] && !!process.env["SUPABASE_PUBLISHABLE_KEY"];
        return Response.json(
          {
            status: configured ? "ok" : "degraded",
            checks: { backend_config: configured },
            time: new Date().toISOString(),
          },
          {
            status: configured ? 200 : 503,
            headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
          },
        );
      },
    },
  },
});
