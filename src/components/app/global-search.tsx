import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
import { globalSearch } from "@/lib/api/actions.functions";
import { unwrap } from "@/lib/api/result";
import { Input } from "@/components/ui/input";

const KIND_LABEL: Record<string, string> = {
  employee: "Employees",
  competency: "Competencies",
  position: "Positions",
  department: "Departments",
  evaluation: "Evaluations",
};

export function GlobalSearch() {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fn = useServerFn(globalSearch);
  const navigate = useNavigate();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => unwrap(await fn({ data: { q: debounced } })),
    staleTime: 10_000,
  });
  const groups = React.useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>>();
    (data ?? []).forEach((r) => m.set(r.kind, [...(m.get(r.kind) ?? []), r]));
    return [...m.entries()];
  }, [data]);

  return (
    <div className="relative max-w-md">
      <Search
        className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={open && debounced.length >= 2}
        aria-controls="global-search-results"
        aria-label="Search employees, competencies, evaluations"
        placeholder="Search…  ( / )"
        className="pl-8"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {open && debounced.length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
        >
          <p className="sr-only" aria-live="polite">
            {isFetching ? "Searching" : `${data?.length ?? 0} results`}
          </p>
          {isFetching && !data ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : groups.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results you have access to.</p>
          ) : (
            groups.map(([kind, rows]) => (
              <div key={kind} className="py-1">
                <p className="px-2 py-1 font-data text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[kind] ?? kind}
                </p>
                {rows.map((r) => (
                  <button
                    key={r.kind + r.id}
                    role="option"
                    aria-selected={false}
                    type="button"
                    className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      navigate({ to: r.link });
                    }}
                  >
                    <span className="font-bold">{r.label}</span>
                    <span className="font-data text-xs text-muted-foreground">{r.sublabel}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
