import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Play, Save, Trash2 } from "lucide-react";
import {
  fetchCompetencies,
  fetchCourses,
  fetchCycles,
  fetchDepartments,
  fetchEmployees,
  fetchPositions,
  fetchRecognitionCategories,
  fetchReportExportHistory,
  fetchReportRows,
  fetchSessions,
  fetchSavedReportDefinitions,
  fetchTrainers,
  type ReportFilters,
  type ReportKind,
  type ReportRowsResult,
} from "@/lib/data";
import {
  deleteReportDefinition,
  logExport,
  logReportView,
  saveReportDefinition,
} from "@/lib/api/succession.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { qk } from "@/lib/query-keys";
import { PageHeader, Panel, Field, NativeSelect } from "@/components/app/kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Scope-respecting reports from live data with audited CSV export.",
      },
    ],
  }),
  component: Page,
});

const KINDS: { value: ReportKind; label: string }[] = [
  { value: "performance", label: "Performance" },
  { value: "gaps", label: "Competency" },
  { value: "learning", label: "Learning" },
  { value: "training", label: "Training" },
  { value: "succession", label: "Succession" },
  { value: "recognition", label: "Recognition" },
  { value: "audit", label: "Audit / export activity" },
];

const FILTER_KEYS: Record<ReportKind, (keyof ReportFilters)[]> = {
  performance: ["from", "to", "department", "position", "supervisor", "cycle", "status"],
  gaps: ["department", "position", "competency", "category", "criticality", "status", "from", "to"],
  learning: ["from", "to", "department", "position", "course", "status"],
  training: ["from", "to", "department", "position", "trainer", "activity", "status"],
  succession: ["from", "to", "department", "position", "status"],
  recognition: ["from", "to", "department", "category", "status"],
  audit: ["from", "to", "actor", "action", "tableName"],
};
const STATUS_OPTIONS: Partial<Record<ReportKind, string[]>> = {
  performance: ["not_started", "in_progress", "submitted", "under_review", "approved", "reopened"],
  gaps: ["not_assessed", "met", "gap"],
  learning: ["assigned", "in_progress", "completed"],
  training: ["planned", "in_progress", "completed", "cancelled"],
  succession: ["active", "monitoring", "closed"],
  recognition: ["submitted", "approved", "rejected"],
};

function csvCell(value: unknown): string {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
}

function filterLabel(key: keyof ReportFilters): string {
  return (
    {
      from: "From",
      to: "To",
      department: "Department",
      position: "Position / target role",
      supervisor: "Supervisor / evaluator",
      cycle: "Evaluation cycle",
      status: "Status",
      course: "Course",
      trainer: "Trainer",
      activity: "Training activity",
      competency: "Competency",
      category: "Category",
      criticality: "Criticality",
      actor: "User ID (actor)",
      action: "Action",
      tableName: "Record type",
    } satisfies Record<keyof ReportFilters, string>
  )[key];
}

function Page() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ReportKind>("performance");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [result, setResult] = useState<ReportRowsResult | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [reportName, setReportName] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; version: number | null }>({
    id: null,
    version: null,
  });
  const [busy, setBusy] = useState(false);
  const departments = useQuery({
    queryKey: qk.org.departments(),
    queryFn: fetchDepartments,
    enabled: kind !== "audit",
  });
  const positions = useQuery({
    queryKey: ["reports", "positions"],
    queryFn: fetchPositions,
    enabled: ["performance", "gaps", "learning", "training", "succession"].includes(kind),
  });
  const employees = useQuery({
    queryKey: ["reports", "employees"],
    queryFn: fetchEmployees,
    enabled: kind === "performance",
  });
  const cycles = useQuery({
    queryKey: ["reports", "cycles"],
    queryFn: fetchCycles,
    enabled: kind === "performance",
  });
  const courses = useQuery({
    queryKey: ["reports", "courses"],
    queryFn: () => fetchCourses(),
    enabled: kind === "learning",
  });
  const trainers = useQuery({
    queryKey: ["reports", "trainers"],
    queryFn: fetchTrainers,
    enabled: kind === "training",
  });
  const sessions = useQuery({
    queryKey: ["reports", "sessions"],
    queryFn: () => fetchSessions(),
    enabled: kind === "training",
  });
  const recognitionCategories = useQuery({
    queryKey: qk.rec.categories(),
    queryFn: fetchRecognitionCategories,
    enabled: kind === "recognition",
  });
  const competencies = useQuery({
    queryKey: ["reports", "competencies"],
    queryFn: fetchCompetencies,
    enabled: kind === "gaps",
  });
  const definitions = useQuery({
    queryKey: ["reports", "definitions"],
    queryFn: fetchSavedReportDefinitions,
  });
  const history = useQuery({
    queryKey: ["reports", "history"],
    queryFn: fetchReportExportHistory,
  });
  const save = useServerFn(saveReportDefinition);
  const remove = useServerFn(deleteReportDefinition);
  const recordView = useServerFn(logReportView);
  const log = useServerFn(logExport);
  const availableColumns = result?.rows[0] ? Object.keys(result.rows[0]) : columns;

  const setFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };
  const runReport = async () => {
    if (filters.from && filters.to && filters.from > filters.to) {
      toast.error("The start date must be on or before the end date.");
      return;
    }
    setBusy(true);
    try {
      const next = await fetchReportRows(kind, filters);
      unwrap(
        await recordView({
          data: {
            kind,
            ...Object.fromEntries(
              Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]),
            ),
          },
        }),
      );
      setResult(next);
      setColumns((current) => {
        const available = next.rows[0] ? Object.keys(next.rows[0]) : current;
        return current.length && current.every((column) => available.includes(column))
          ? current
          : available;
      });
    } catch (error) {
      setResult(null);
      toast.error(
        error instanceof ApiError ? error.message : "Report failed. Check access and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveDefinition = async () => {
    if (!result || !reportName.trim() || columns.length === 0) {
      toast.error("Run a report, select at least one column, and enter a report name.");
      return;
    }
    try {
      unwrap(
        await save({
          data: {
            id: editing.id,
            version: editing.version,
            name: reportName.trim(),
            kind,
            filters: Object.fromEntries(
              Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]),
            ),
            columns,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["reports", "definitions"] });
      toast.success("Report definition saved.");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save this report definition.",
      );
    }
  };
  const loadDefinition = (definition: NonNullable<typeof definitions.data>[number]) => {
    setKind(definition.report_kind);
    setFilters(definition.filters);
    setColumns(definition.selected_columns);
    setReportName(definition.name);
    setEditing({ id: definition.id, version: definition.version });
    setResult(null);
  };
  const deleteDefinition = async (definition: NonNullable<typeof definitions.data>[number]) => {
    try {
      unwrap(
        await remove({
          data: {
            id: definition.id,
            version: definition.version,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["reports", "definitions"] });
      if (editing.id === definition.id) {
        setEditing({ id: null, version: null });
        setReportName("");
      }
      toast.success("Report definition deleted.");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not delete this report definition.",
      );
    }
  };
  const exportCsv = async () => {
    if (!result || result.truncated || !columns.length) return;
    try {
      const csv = toCsv(result.rows, columns);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      unwrap(
        await log({
          data: {
            name: reportName.trim() || `${KINDS.find((item) => item.value === kind)?.label} report`,
            kind,
            scope: Object.fromEntries(
              Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]),
            ),
            rowCount: result.rows.length,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      await queryClient.invalidateQueries({ queryKey: ["reports", "history"] });
      toast.success("CSV downloaded and export metadata recorded.");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Export history could not be recorded.",
      );
      await queryClient.invalidateQueries({ queryKey: ["reports", "history"] });
    }
  };
  type OptionRow = {
    id: string;
    name?: string;
    title?: string;
    code?: string;
    first_name?: string;
    last_name?: string;
  };
  const dataFor = (key: keyof ReportFilters): OptionRow[] => {
    if (key === "department") return (departments.data ?? []) as OptionRow[];
    if (key === "position") return (positions.data ?? []) as OptionRow[];
    if (key === "supervisor") return (employees.data ?? []) as OptionRow[];
    if (key === "cycle") return (cycles.data ?? []) as OptionRow[];
    if (key === "course") return (courses.data ?? []) as OptionRow[];
    if (key === "trainer") return (trainers.data ?? []) as OptionRow[];
    if (key === "activity") return (sessions.data ?? []) as OptionRow[];
    if (key === "competency") return (competencies.data ?? []) as OptionRow[];
    if (key === "category") {
      if (kind === "recognition") return (recognitionCategories.data ?? []) as OptionRow[];
      return [
        ...new Map(
          (competencies.data ?? []).map((competency) => [
            competency.category_id,
            { id: competency.category_id, name: competency.category?.name ?? "Category" },
          ]),
        ).values(),
      ];
    }
    return [];
  };
  const optionLabel = (key: keyof ReportFilters, row: OptionRow) => {
    if (key === "department") return String(row.name ?? "");
    if (key === "position") return String(row.title ?? "");
    if (key === "supervisor")
      return `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`;
    if (key === "cycle") return String(row.name ?? "");
    if (key === "course") return `${String(row.code ?? "")} — ${String(row.title ?? "")}`;
    if (key === "trainer") return String(row.name ?? "");
    if (key === "activity") return `${String(row.code ?? "")} — ${String(row.title ?? "")}`;
    if (key === "competency") return `${String(row.code ?? "")} — ${String(row.name ?? "")}`;
    return String(row.name ?? "");
  };

  const optionQueries = [
    departments,
    positions,
    employees,
    cycles,
    courses,
    trainers,
    sessions,
    competencies,
    recognitionCategories,
    definitions,
    history,
  ];
  const optionsError = optionQueries.find((query) => query.isError)?.error;
  return (
    <div>
      <PageHeader
        title="Reports & exports"
        description="Row-level report data is read through your authorized database scope. Exports are logged."
      />
      {optionsError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Some report options could not be loaded: {optionsError.message}
        </p>
      )}
      <Panel className="mt-4" title="Build a report">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Report" htmlFor="rp-kind" required>
            <NativeSelect
              id="rp-kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ReportKind);
                setFilters({});
                setResult(null);
                setColumns([]);
                setReportName("");
                setEditing({ id: null, version: null });
              }}
            >
              {KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {FILTER_KEYS[kind].map((key) => (
            <Field key={key} label={filterLabel(key)} htmlFor={`rp-${key}`}>
              {key === "from" || key === "to" ? (
                <Input
                  id={`rp-${key}`}
                  type="date"
                  value={filters[key] ?? ""}
                  onChange={(event) => setFilter(key, event.target.value)}
                />
              ) : key === "status" ? (
                <NativeSelect
                  id={`rp-${key}`}
                  value={filters.status ?? ""}
                  onChange={(event) => setFilter(key, event.target.value)}
                >
                  <option value="">All statuses</option>
                  {(STATUS_OPTIONS[kind] ?? []).map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </NativeSelect>
              ) : key === "action" || key === "tableName" || key === "actor" ? (
                <Input
                  id={`rp-${key}`}
                  value={filters[key] ?? ""}
                  placeholder={key === "actor" ? "User UUID" : "Exact filter value"}
                  onChange={(event) => setFilter(key, event.target.value)}
                />
              ) : key === "criticality" ? (
                <NativeSelect
                  id={`rp-${key}`}
                  value={filters.criticality ?? ""}
                  onChange={(event) => setFilter(key, event.target.value)}
                >
                  <option value="">All criticality levels</option>
                  <option value="mandatory">Mandatory</option>
                  <option value="safety_critical">Safety critical</option>
                </NativeSelect>
              ) : (
                <NativeSelect
                  id={`rp-${key}`}
                  value={filters[key] ?? ""}
                  onChange={(event) => setFilter(key, event.target.value)}
                >
                  <option value="">All in authorized scope</option>
                  {dataFor(key).map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {optionLabel(key, row)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={runReport} disabled={busy}>
            <Play className="size-4" aria-hidden /> {busy ? "Running…" : "Run report"}
          </Button>
          {result && (
            <>
              <Input
                className="max-w-xs"
                aria-label="Saved report name"
                placeholder="Report definition name"
                value={reportName}
                onChange={(event) => setReportName(event.target.value)}
              />
              <Button variant="outline" onClick={saveDefinition}>
                <Save className="size-4" aria-hidden /> Save definition
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={result.truncated || !columns.length}
              >
                <Download className="size-4" aria-hidden /> Export CSV
              </Button>
            </>
          )}
        </div>
      </Panel>
      {definitions.data && definitions.data.length > 0 && (
        <Panel className="mt-5" title="Saved report definitions">
          <ul className="space-y-2">
            {definitions.data.map((definition) => (
              <li
                key={definition.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
              >
                <span>
                  <strong>{definition.name}</strong>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {KINDS.find((item) => item.value === definition.report_kind)?.label}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadDefinition(definition);
                    }}
                  >
                    Load
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void deleteDefinition(definition)}
                  >
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {result && (
        <Panel
          className="mt-5"
          title={`${KINDS.find((item) => item.value === kind)?.label} — results`}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "row" : "rows"} in the current result.
            {result.truncated &&
              " The 5,000-row limit was reached; refine filters before exporting."}
          </p>
          {availableColumns.length > 0 && (
            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-semibold">Columns</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {availableColumns.map((column) => (
                  <label key={column} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={columns.includes(column)}
                      onChange={(event) =>
                        setColumns((current) =>
                          event.target.checked
                            ? [...current, column]
                            : current.filter((entry) => entry !== column),
                        )
                      }
                    />
                    {column.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data in your authorized scope for these filters.
            </p>
          ) : columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select at least one column to preview or export.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {columns.map((column) => (
                      <th key={column} className="py-2 pr-3 font-semibold">
                        {column.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 100).map((row, index) => (
                    <tr key={String(row.id ?? index)} className="border-b last:border-0">
                      {columns.map((column) => (
                        <td key={column} className="max-w-64 truncate py-2 pr-3">
                          {row[column] == null
                            ? "—"
                            : typeof row[column] === "object"
                              ? JSON.stringify(row[column])
                              : String(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 100 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Previewing 100 rows; CSV includes all {result.rows.length} loaded rows.
                </p>
              )}
            </div>
          )}
        </Panel>
      )}
      <Panel className="mt-5" title="Export history">
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading export history…</p>
        ) : history.data?.rows.length ? (
          <div className="overflow-x-auto">
            {history.data.truncated && (
              <p className="mb-2 text-sm text-muted-foreground">
                Showing the latest 200 of {history.data.total} exports. Use the Audit report to
                filter older activity.
              </p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Report</th>
                  <th className="py-2 pr-3">Requested by</th>
                  <th className="py-2 pr-3">Format</th>
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2 pr-3">Rows</th>
                  <th className="py-2 pr-3">Requested</th>
                  <th className="py-2 pr-3">Download</th>
                  <th className="py-2">Filters</th>
                </tr>
              </thead>
              <tbody>
                {history.data.rows.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{item.report_name}</td>
                    <td className="py-2 pr-3">
                      {item.requester?.full_name ?? item.requester?.email ?? item.user_id}
                    </td>
                    <td className="py-2 pr-3">{item.format.toUpperCase()}</td>
                    <td className="py-2 pr-3">{item.result}</td>
                    <td className="py-2 pr-3">{item.row_count}</td>
                    <td className="py-2 pr-3">{new Date(item.requested_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {item.download_available ? "Available" : "Not retained"}
                    </td>
                    <td className="max-w-64 truncate py-2">{JSON.stringify(item.scope)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : history.isError ? (
          <p className="text-sm text-destructive">Export history could not be loaded.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No export history is available in your scope.
          </p>
        )}
      </Panel>
    </div>
  );
}
