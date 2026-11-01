import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { AssignmentRow } from "@/lib/data";
import { DataTable } from "./data-table";
import { StatusBadge, EmptyState, fmtDate, NativeSelect } from "./kit";

export function AssignmentsTable({
  rows,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyText,
  hideEmployee,
  hideEvaluator,
}: {
  rows?: AssignmentRow[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle: string;
  emptyText?: string;
  hideEmployee?: boolean;
  hideEvaluator?: boolean;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const data = useMemo(
    () => (rows ?? []).filter((r) => !status || r.status === status),
    [rows, status],
  );
  const cols: ColumnDef<AssignmentRow, unknown>[] = [
    ...(hideEmployee
      ? []
      : [
          {
            header: "Employee",
            accessorFn: (r: AssignmentRow) => `${r.employee?.first_name} ${r.employee?.last_name}`,
            cell: ({ getValue }: { getValue: () => unknown }) => (
              <span className="font-bold">{getValue() as string}</span>
            ),
          },
        ]),
    { header: "Cycle", accessorFn: (r) => r.cycle?.name ?? "—" },
    ...(hideEvaluator
      ? []
      : [
          {
            header: "Evaluator",
            accessorFn: (r: AssignmentRow) =>
              `${r.evaluator?.first_name} ${r.evaluator?.last_name}`,
          },
        ]),
    { header: "Profile", accessorFn: (r) => `v${r.profile_version?.version_number ?? "?"}` },
    {
      header: "Due",
      accessorFn: (r) => r.cycle?.due_date ?? "",
      cell: ({ getValue }) => fmtDate(getValue() as string),
    },
    {
      header: "Self score",
      accessorFn: (r) => (r.self_score == null ? "—" : `${r.self_score} / 5`),
    },
    {
      header: "Supervisor score",
      accessorFn: (r) => (r.supervisor_score == null ? "—" : `${r.supervisor_score} / 5`),
    },
    {
      header: "Final score",
      accessorFn: (r) =>
        r.final_score == null
          ? "—"
          : `${r.final_score} / 5${r.classification ? ` · ${r.classification}` : ""}`,
    },
    {
      header: "Acknowledgement",
      accessorKey: "acknowledged_at",
      cell: ({ getValue }) =>
        getValue() ? `Acknowledged · ${fmtDate(getValue() as string)}` : "Pending",
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
  ];
  return (
    <DataTable
      columns={cols}
      data={data}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(r) => navigate({ to: "/performance/evaluations/$id", params: { id: r.id } })}
      toolbar={
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          {["not_started", "in_progress", "submitted", "under_review", "approved", "reopened"].map(
            (s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ),
          )}
        </NativeSelect>
      }
      empty={<EmptyState icon={ClipboardCheck} title={emptyTitle} description={emptyText} />}
    />
  );
}
