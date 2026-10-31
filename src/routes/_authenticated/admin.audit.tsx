import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { PageHeader, EmptyState, NativeSelect, fmtDateTime } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Priority Handling Logistics, Inc." },
      { name: "description", content: "Append-only audit trail." },
    ],
  }),
  component: Page,
});

type A = {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};
const PAGE = 200;

function Page() {
  const [table, setTable] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const q = useQuery({
    queryKey: qk.shared.audit({ table, cursor }),
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (table) query = query.eq("table_name", table);
      if (cursor) query = query.lt("created_at", cursor);
      return check(await query) as A[];
    },
  });
  const actors = useQuery({
    queryKey: [...qk.org.users(), "names"],
    queryFn: async () =>
      check(await supabase.from("profiles").select("id, email")) as { id: string; email: string }[],
  });
  const [view, setView] = useState<A | null>(null);
  const cols: ColumnDef<A, unknown>[] = [
    {
      header: "When",
      accessorKey: "created_at",
      cell: ({ getValue }) => fmtDateTime(getValue() as string),
    },
    {
      header: "Actor",
      accessorFn: (r) =>
        actors.data?.find((a) => a.id === r.actor_id)?.email ??
        (r.actor_id ? r.actor_id.slice(0, 8) : "system"),
    },
    {
      header: "Action",
      accessorKey: "action",
      cell: ({ getValue }) => <span className="font-bold capitalize">{getValue() as string}</span>,
    },
    { header: "Record type", accessorKey: "table_name" },
    { header: "Record", accessorFn: (r) => r.record_id?.slice(0, 8) ?? "—" },
    {
      id: "v",
      header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setView(row.original)}>
          Details
        </Button>
      ),
    },
  ];
  const tables = [
    "",
    "employees",
    "user_roles",
    "departments",
    "positions",
    "reporting_relationships",
    "evaluation_assignments",
    "evaluation_profile_versions",
    "evaluation_reviews",
    "competencies",
    "position_competency_requirements",
    "competency_assessments",
    "approval_tasks",
    "system_settings",
    "proficiency_levels",
    "profiles",
    "export",
  ];
  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only. Entries cannot be edited or deleted from the app."
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        pageSize={25}
        toolbar={
          <>
            <NativeSelect
              aria-label="Record type"
              value={table}
              onChange={(e) => {
                setTable(e.target.value);
                setCursor(null);
              }}
              className="w-56"
            >
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t || "All record types"}
                </option>
              ))}
            </NativeSelect>
            {cursor && (
              <Button variant="outline" size="sm" onClick={() => setCursor(null)}>
                Newest
              </Button>
            )}
            {q.data?.length === PAGE && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(q.data![q.data!.length - 1].created_at)}
              >
                Older entries
              </Button>
            )}
          </>
        }
        empty={<EmptyState icon={ScrollText} title="No audit entries" />}
      />
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {view?.action} · {view?.table_name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-auto md:grid-cols-2">
            {(["before_data", "after_data"] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 font-data text-xs font-semibold uppercase text-muted-foreground">
                  {k === "before_data" ? "Before" : "After"}
                </p>
                <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 font-data text-xs">
                  {view?.[k] ? JSON.stringify(view[k], null, 2) : "—"}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
