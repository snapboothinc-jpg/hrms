import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Grid3x3 } from "lucide-react";
import { fetchGaps, fetchDepartments } from "@/lib/data";
import { qk } from "@/lib/query-keys";
import { PageHeader, EmptyState, LoadingRows, NativeSelect } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/competency/matrix")({
  head: () => ({
    meta: [
      { title: "Employee competency matrix — Priority Handling Logistics, Inc." },
      { name: "description", content: "Employees by competency, current vs required level." },
    ],
  }),
  component: Page,
});

function Page() {
  const [dept, setDept] = useState("");
  const q = useQuery({
    queryKey: qk.comp.gaps({ department: dept }),
    queryFn: () => fetchGaps({ department: dept }),
  });
  const depts = useQuery({ queryKey: qk.org.departments(), queryFn: fetchDepartments });
  const { comps, emps, cell } = useMemo(() => {
    const rows = q.data ?? [];
    const comps = [...new Map(rows.map((r) => [r.competency_id, r.competency_name])).entries()];
    const emps = [
      ...new Map(
        rows.map((r) => [r.employee_id, { name: r.employee_name, pos: r.position_title }]),
      ).entries(),
    ];
    const cell = new Map(rows.map((r) => [`${r.employee_id}:${r.competency_id}`, r]));
    return { comps, emps, cell };
  }, [q.data]);
  return (
    <div>
      <PageHeader
        title="Employee competency matrix"
        description="Each cell shows current / required. Blank cells mean the competency isn't required for that position."
      />
      <div className="mb-4 max-w-xs">
        <NativeSelect
          aria-label="Department"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">All departments in scope</option>
          {depts.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {q.isLoading ? (
        <LoadingRows />
      ) : !emps.length ? (
        <EmptyState icon={Grid3x3} title="No data in scope" />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full font-data text-sm">
            <caption className="sr-only">Competency matrix</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="sticky left-0 bg-card p-2 text-left">
                  Employee
                </th>
                {comps.map(([id, n]) => (
                  <th key={id} scope="col" className="min-w-28 p-2 text-left font-semibold">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map(([eid, e]) => (
                <tr key={eid} className="border-b last:border-0">
                  <th scope="row" className="sticky left-0 bg-card p-2 text-left">
                    <Link
                      to="/people/employees/$id"
                      params={{ id: eid }}
                      className="font-bold hover:underline"
                    >
                      {e.name}
                    </Link>
                    <span className="block text-xs font-normal text-muted-foreground">{e.pos}</span>
                  </th>
                  {comps.map(([cid]) => {
                    const r = cell.get(`${eid}:${cid}`);
                    if (!r)
                      return (
                        <td
                          key={cid}
                          className="p-2 text-muted-foreground"
                          aria-label="Not required"
                        >
                          ·
                        </td>
                      );
                    const tone =
                      r.gap_status === "met"
                        ? "bg-success-soft text-success"
                        : r.gap_status === "gap"
                          ? "bg-danger-soft text-destructive"
                          : "bg-muted text-muted-foreground";
                    return (
                      <td key={cid} className="p-1">
                        <span className={cn("block rounded px-2 py-1 font-bold", tone)}>
                          {r.gap_status === "not_assessed"
                            ? "Not Assessed"
                            : `${r.current_level} / ${r.required_level}`}
                          {r.is_safety_critical && (
                            <span className="ml-1" aria-label="safety-critical">
                              ⚠
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
