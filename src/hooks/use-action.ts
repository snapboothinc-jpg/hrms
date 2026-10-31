import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { ApiError, unwrap, type ApiResult } from "@/lib/api/result";

interface Opts<TOut> {
  invalidate?: QueryKey[];
  success?: string | ((d: TOut) => string);
  onSuccess?: (d: TOut) => void;
  /** send an Idempotency-Key; reused across retries until the call succeeds */
  idempotent?: boolean;
}

/**
 * Wraps a server function: disables while in flight (isPending), reuses the
 * same idempotency key for retries, maps standard errors to toasts (with
 * request id), and invalidates affected query roots.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAction<TIn extends object, TOut = any>(
  fn: (args: { data: TIn }) => Promise<unknown>,
  opts: Opts<TOut> = {},
) {
  const qc = useQueryClient();
  const keyRef = useRef<string | null>(null);
  return useMutation({
    mutationFn: async (input: Omit<TIn, "idempotencyKey">) => {
      let data = input as TIn;
      if (opts.idempotent) {
        keyRef.current ??= crypto.randomUUID();
        data = { ...input, idempotencyKey: keyRef.current } as TIn;
      }
      return unwrap((await fn({ data })) as ApiResult<TOut>);
    },
    onSuccess: (d) => {
      keyRef.current = null;
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success)
        toast.success(typeof opts.success === "function" ? opts.success(d) : opts.success);
      opts.onSuccess?.(d);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === "UNAUTHENTICATED") {
          window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        toast.error(e.message, {
          description: `Reference: ${e.requestId.slice(0, 8)}`,
          action:
            e.code === "CONFLICT"
              ? { label: "Reload", onClick: () => window.location.reload() }
              : undefined,
        });
      } else {
        // Zod validation from the server shows as a generic message
        toast.error("Some input is invalid. Please check the form.");
      }
    },
  });
}
