import { createFileRoute } from "@tanstack/react-router";
import {
  authenticate,
  apiError,
  requireIdempotencyKey,
  ifMatchVersion,
  withEtag,
  coursePatchSchema,
  canonicalCoursePatch,
} from "@/lib/api/v1.server";

/** SHA-256 hex via Web Crypto (workerd-safe, no Node Buffer). */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/v1/courses/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.supabase
          .from("courses")
          .select("id, title, description, status, duration_minutes, created_at, version")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return apiError(403, "FORBIDDEN", "You do not have access to this resource");
        if (!data) return apiError(404, "NOT_FOUND", "Course not found");
        return withEtag(Response.json({ data }), data.id, data.version);
      },

      PATCH: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const idem = requireIdempotencyKey(request);
        if (idem instanceof Response) return idem;

        const expectedVersion = ifMatchVersion(request, params.id);
        if (expectedVersion instanceof Response) return expectedVersion;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return apiError(400, "INVALID", "Request body must be JSON");
        }
        const parsed = coursePatchSchema.safeParse(body);
        if (!parsed.success) return apiError(400, "INVALID", "Request body failed validation");

        const bodyHash = await sha256Hex(
          JSON.stringify({
            id: params.id,
            expected_version: expectedVersion,
            patch: JSON.parse(canonicalCoursePatch(parsed.data)),
          }),
        );

        const { data: result, error } = await auth.supabase.rpc("api_patch_course", {
          _id: params.id,
          _patch: parsed.data,
          _expected_version: expectedVersion,
          _idem: idem,
          _hash: bodyHash,
        });
        if (error) {
          const msg = error.message ?? "";
          if (msg.startsWith("IDEMPOTENCY_CONFLICT"))
            return apiError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "This Idempotency-Key was used for another request",
            );
          if (msg.startsWith("CONFLICT"))
            return apiError(412, "CONFLICT", "The resource changed; refetch and retry");
          if (msg.startsWith("FORBIDDEN"))
            return apiError(403, "FORBIDDEN", "You do not have permission to update courses");
          if (msg.startsWith("NOT_FOUND")) return apiError(404, "NOT_FOUND", "Course not found");
          if (msg.startsWith("RULE"))
            return apiError(409, "RULE", "The course cannot be updated in its current state");
          return apiError(400, "INVALID", "Update rejected");
        }

        const resultVersion =
          result && typeof result === "object" && "version" in result ? result.version : undefined;
        if (typeof resultVersion !== "number")
          return apiError(500, "SERVER_ERROR", "Course update returned an invalid result");
        return withEtag(Response.json({ data: result }), params.id, resultVersion);
      },
    },
  },
});
