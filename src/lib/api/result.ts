/** Client-safe API result types. Every server function returns ApiResult<T>. */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID"
  | "RULE"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  request_id: string;
  details?: Record<string, string>;
}

export type ApiResult<T> =
  { ok: true; data: T; request_id: string } | { ok: false; error: ApiErrorBody };

export class ApiError extends Error {
  code: ErrorCode;
  requestId: string;
  details?: Record<string, string>;
  constructor(body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.requestId = body.request_id;
    this.details = body.details;
  }
}

export function unwrap<T>(r: ApiResult<T>): T {
  if (!r.ok) throw new ApiError(r.error);
  return r.data;
}

export const STATUS_FOR: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID: 400,
  RULE: 422,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

/** Map a database exception message ("CODE: detail") to the standard error. */
export function mapDbError(message: string | undefined, requestId: string): ApiErrorBody {
  const msg = message ?? "";
  const m =
    /^(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|CONFLICT|IDEMPOTENCY_CONFLICT|INVALID|RULE)(?::\s*(.*))?$/s.exec(
      msg,
    );
  if (m) {
    const code = m[1] as ErrorCode;
    const defaults: Record<string, string> = {
      UNAUTHENTICATED: "Please sign in again.",
      FORBIDDEN: "You don't have permission to do that.",
      NOT_FOUND: "The record was not found.",
      CONFLICT: "Someone else changed this record. Reload to see the latest version.",
      IDEMPOTENCY_CONFLICT: "This request key was already used for a different request.",
      INVALID: "Some input is invalid.",
      RULE: "This action is not allowed by a business rule.",
    };
    // NOT_FOUND details never reveal whether a record exists out of scope
    const detail = code === "NOT_FOUND" ? undefined : m[2];
    return { code, message: detail || defaults[code], request_id: requestId };
  }
  if (/duplicate key|unique constraint/i.test(msg))
    return {
      code: "CONFLICT",
      message: "A record with these details already exists.",
      request_id: requestId,
    };
  if (/violates check constraint|invalid input syntax|violates not-null/i.test(msg))
    return {
      code: "INVALID",
      message: "Some values are outside the allowed range.",
      request_id: requestId,
    };
  if (/violates foreign key/i.test(msg))
    return {
      code: "RULE",
      message: "This record is linked to other records.",
      request_id: requestId,
    };
  return {
    code: "SERVER_ERROR",
    message: "Something went wrong. Please try again.",
    request_id: requestId,
  };
}
