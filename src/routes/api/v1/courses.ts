import { createFileRoute } from "@tanstack/react-router";
import {
  authenticate,
  pageParams,
  paginate,
  decodeCursor,
  cursorFilter,
  pickSort,
  pickFilters,
  apiError,
} from "@/lib/api/v1.server";

const SORTABLE = ["created_at", "title"] as const;
const FILTERABLE = ["status"] as const;

export const Route = createFileRoute("/api/v1/courses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const { cursor, limit } = pageParams(url);
        const sort = pickSort(url, SORTABLE, "created_at");
        const filters = pickFilters(url, FILTERABLE);
        const pageCursor = cursor ? decodeCursor(cursor, sort.column, sort.ascending) : null;
        if (cursor && !pageCursor)
          return apiError(400, "INVALID", "Cursor is invalid or does not match the selected sort");

        let q = auth.supabase
          .from("courses")
          .select("id, title, description, status, duration_minutes, created_at, version")
          .order(sort.column, { ascending: sort.ascending })
          .order("id", { ascending: true })
          .limit(limit + 1);
        for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
        if (pageCursor) q = q.or(cursorFilter(pageCursor));

        const { data, error } = await q;
        if (error) return apiError(403, "FORBIDDEN", "You do not have access to this resource");
        return Response.json(paginate(data ?? [], limit, sort));
      },
    },
  },
});
