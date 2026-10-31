import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDbError, type ApiResult } from "./result";

/** Structured JSON log without personal data. */
export function logEvent(e: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...e }));
}

export async function hashBody(body: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body ?? null));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Standard operation wrapper: the auth middleware already authenticated the
 * caller; Zod validated input; the RPC authorizes at record level, runs in one
 * transaction and writes audit rows via triggers. We map errors to the
 * standard error format and never return stack traces.
 */
export async function runOp<T>(
  action: string,
  userId: string,
  fn: () => Promise<T>,
): Promise<ApiResult<T>> {
  const request_id = crypto.randomUUID();
  const start = Date.now();
  try {
    const data = await fn();
    logEvent({
      level: "info",
      request_id,
      user_id: userId,
      action,
      duration_ms: Date.now() - start,
    });
    return { ok: true, data, request_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = mapDbError(message, request_id);
    logEvent({
      level: error.code === "SERVER_ERROR" ? "error" : "warn",
      request_id,
      user_id: userId,
      action,
      code: error.code,
      duration_ms: Date.now() - start,
      ...(error.code === "SERVER_ERROR" ? { detail: message.slice(0, 200) } : {}),
    });
    return { ok: false, error };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rpc<T = any>(
  sb: SupabaseClient<any>,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
