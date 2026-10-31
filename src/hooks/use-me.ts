import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getMyContext } from "@/lib/api/actions.functions";
import { unwrap } from "@/lib/api/result";
import type { AppRole, Permission } from "@/lib/policy";
import { qk } from "@/lib/query-keys";

export interface MyContext {
  user_id: string;
  role: AppRole | null;
  permissions: Permission[];
  employee: {
    id: string;
    name: string;
    department_id: string;
    position_id: string;
    version: number;
  } | null;
  is_active: boolean;
  email: string;
}

export function useMe() {
  const fn = useServerFn(getMyContext);
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => unwrap(await fn()) as unknown as MyContext,
    staleTime: 60_000,
  });
}

/** The single hook components use for permission-dependent UI. */
export function usePermissions() {
  const { data } = useMe();
  return useMemo(() => {
    const set = new Set<string>(data?.permissions ?? []);
    return {
      me: data,
      role: data?.role ?? null,
      has: (p: Permission) => set.has(p),
      any: (...ps: Permission[]) => ps.some((p) => set.has(p)),
      set,
      employeeId: data?.employee?.id ?? null,
    };
  }, [data]);
}
