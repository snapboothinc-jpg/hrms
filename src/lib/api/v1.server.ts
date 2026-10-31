/**
 * Shared helpers for the versioned REST API under /api/v1.
 * Auth: Supabase access token in the Authorization header (same tokens the app uses).
 * Conventions: cursor pagination (?cursor=&limit=), whitelisted sort/filter fields,
 * Idempotency-Key on unsafe methods, ETag/If-Match on updates, standard error format.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export interface ApiUser {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export const apiError = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

export const coursePatchSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().max(4000).optional(),
    duration_minutes: z.number().int().min(1).max(100000).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "At least one field is required");

export function canonicalCoursePatch(patch: z.infer<typeof coursePatchSchema>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(patch).sort(([left], [right]) => left.localeCompare(right))),
  );
}

/** Authenticate a bearer token against Supabase auth; returns an RLS-scoped client. */
export async function authenticate(request: Request): Promise<ApiUser | Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError(401, "UNAUTHENTICATED", "Missing bearer token");
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return apiError(401, "UNAUTHENTICATED", "Invalid or expired token");
  return { supabase, userId: data.user.id };
}

// ---------------- cursor pagination ----------------
export interface PageParams {
  cursor: string | null;
  limit: number;
}

export function pageParams(url: URL, maxLimit = 100): PageParams {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), maxLimit);
  return { cursor: url.searchParams.get("cursor"), limit };
}

export interface StableCursor {
  column: string;
  ascending: boolean;
  value: string;
  id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(cursor: StableCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeCursor(
  token: string,
  column: string,
  ascending: boolean,
): StableCursor | null {
  if (!token || token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (
      typeof value !== "object" ||
      value === null ||
      !("column" in value) ||
      !("ascending" in value) ||
      !("value" in value) ||
      !("id" in value) ||
      value.column !== column ||
      value.ascending !== ascending ||
      typeof value.value !== "string" ||
      value.value.length < 1 ||
      value.value.length > 200 ||
      typeof value.id !== "string" ||
      !UUID_RE.test(value.id) ||
      (column === "created_at" && !Number.isFinite(Date.parse(value.value)))
    )
      return null;
    return value as StableCursor;
  } catch {
    return null;
  }
}

function rowSortValue<T extends { id: string }>(row: T, column: string): string {
  const value = Object.getOwnPropertyDescriptor(row, column)?.value;
  if (typeof value !== "string" || value.length > 200)
    throw new Error(`REST pagination requires a non-null string sort value for ${column}`);
  return value;
}

/** Returns the next page using the selected sort field and a stable id tie-breaker. */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
  sort: { column: string; ascending: boolean },
) {
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({
          column: sort.column,
          ascending: sort.ascending,
          value: rowSortValue(last, sort.column),
          id: last.id,
        })
      : null;
  return { data: page, next_cursor: nextCursor };
}

export function cursorFilter(cursor: StableCursor): string {
  const escaped = `"${cursor.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const operator = cursor.ascending ? "gt" : "lt";
  return `${cursor.column}.${operator}.${escaped},and(${cursor.column}.eq.${escaped},id.gt.${cursor.id})`;
}

export function isAfterCursor(value: string, id: string, cursor: StableCursor): boolean {
  const comparison = value === cursor.value ? 0 : value < cursor.value ? -1 : 1;
  return cursor.ascending
    ? comparison > 0 || (comparison === 0 && id > cursor.id)
    : comparison < 0 || (comparison === 0 && id > cursor.id);
}

// ---------------- whitelisted sort/filter ----------------
export function pickSort(
  url: URL,
  allowed: readonly string[],
  fallback: string,
): { column: string; ascending: boolean } {
  const raw = url.searchParams.get("sort") ?? fallback;
  const desc = raw.startsWith("-");
  const column = desc ? raw.slice(1) : raw;
  if (!allowed.includes(column)) return { column: fallback, ascending: true };
  return { column, ascending: !desc };
}

export function pickFilters(url: URL, allowed: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v) out[key] = v;
  }
  return out;
}

// ---------------- idempotency ----------------
export function requireIdempotencyKey(request: Request): string | Response {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !UUID_RE.test(key)) {
    return apiError(
      400,
      "INVALID",
      "An Idempotency-Key header containing a UUID is required on this method",
    );
  }
  return key;
}

// ---------------- ETag / If-Match ----------------
/** ETag is derived from the row version: W/"<id>:<version>". */
export function etag(id: string, version: number): string {
  return `W/"${id}:${version}"`;
}

export function checkIfMatch(
  request: Request,
  id: string,
  currentVersion: number,
): Response | null {
  const header = request.headers.get("if-match");
  if (!header)
    return apiError(
      428,
      "PRECONDITION_REQUIRED",
      "If-Match header with the current ETag is required",
    );
  if (header !== etag(id, currentVersion)) {
    return apiError(412, "CONFLICT", "The resource changed since you loaded it; refetch and retry");
  }
  return null;
}

/** Validates the ETag resource and extracts its version without a separate read. */
export function ifMatchVersion(request: Request, id: string): number | Response {
  const header = request.headers.get("if-match");
  if (!header)
    return apiError(
      428,
      "PRECONDITION_REQUIRED",
      "If-Match header with the current ETag is required",
    );
  const match = /^W\/"([0-9a-f-]{36}):([1-9]\d*)"$/.exec(header);
  if (!UUID_RE.test(id) || !match || match[1]?.toLowerCase() !== id.toLowerCase())
    return apiError(412, "CONFLICT", "The resource changed since you loaded it; refetch and retry");
  const version = Number(match[2]);
  if (!Number.isSafeInteger(version))
    return apiError(412, "CONFLICT", "The resource changed since you loaded it; refetch and retry");
  return version;
}

export function withEtag(res: Response, id: string, version: number): Response {
  res.headers.set("ETag", etag(id, version));
  return res;
}
