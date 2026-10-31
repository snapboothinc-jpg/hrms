import { createFileRoute } from "@tanstack/react-router";
import { authenticate, pageParams, pickFilters, apiError } from "@/lib/api/v1.server";

const FILTERABLE = ["employee_id", "status"] as const;

/**
 * Gaps are computed by the scoped database function public.competency_gaps
 * (gap = max(0, required - current); Not Assessed stays distinct). The cursor
 * is the row offset, since the function orders deterministically.
 */
export const Route = createFileRoute("/api/v1/gaps")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const { cursor, limit } = pageParams(url);
        const filters = pickFilters(url, FILTERABLE);
        const offset = cursor ? Number(cursor) : 0;
        if (!Number.isInteger(offset) || offset < 0)
          return apiError(400, "INVALID", "Invalid cursor");

        const { data, error } = await auth.supabase.rpc("competency_gaps", {
          _employee: filters["employee_id"] || undefined,
          _status: filters["status"] || undefined,
          _limit: limit + 1,
          _offset: offset,
        });
        if (error) return apiError(403, "FORBIDDEN", "You do not have access to this resource");

        const rows = (data ?? []) as Record<string, unknown>[];
        const page = rows.slice(0, limit);
        const nextCursor = rows.length > limit ? String(offset + limit) : null;
        return Response.json({ data: page, next_cursor: nextCursor });
      },
    },
  },
});
