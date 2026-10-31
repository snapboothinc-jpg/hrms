import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileStack, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check, fetchPositions } from "@/lib/data";
import { createProfile } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import { PageHeader, StatusBadge, EmptyState, Field, NativeSelect } from "@/components/app/kit";
import { DataTable } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/performance/profiles/")({
  head: () => ({
    meta: [
      { title: "Evaluation profiles — Priority Handling Logistics, Inc." },
      { name: "description", content: "Position-specific, versioned evaluation profiles." },
    ],
  }),
  component: Page,
});

type P = {
  id: string;
  name: string;
  position_id: string;
  description: string | null;
  position: { title: string } | null;
  versions: { id: string; version_number: number; status: string }[];
};

const fetchProfiles = async () =>
  check(
    await supabase
      .from("evaluation_profiles")
      .select(
        "*, position:positions(title), versions:evaluation_profile_versions(id, version_number, status)",
      )
      .order("name"),
  ) as unknown as P[];

function Page() {
  const q = useQuery({ queryKey: qk.perf.profiles(), queryFn: fetchProfiles });
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const cols: ColumnDef<P, unknown>[] = [
    {
      header: "Profile",
      accessorKey: "name",
      cell: ({ getValue }) => <span className="font-bold">{getValue() as string}</span>,
    },
    { header: "Position", accessorFn: (r) => r.position?.title ?? "—" },
    {
      header: "Active version",
      accessorFn: (r) => {
        const a = r.versions.find((v) => v.status === "active");
        return a ? `v${a.version_number}` : "None";
      },
    },
    { header: "Versions", accessorFn: (r) => r.versions.length },
    {
      header: "Draft",
      id: "d",
      cell: ({ row }) =>
        row.original.versions.some((v) => v.status === "draft") ? (
          <StatusBadge status="draft" label="Draft open" />
        ) : null,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Evaluation profiles"
        description="Each position has its own criteria, KPIs, competencies and weights. Only one version per position is active."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New profile
          </Button>
        }
      />
      <DataTable
        columns={cols}
        data={q.data}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(r) => navigate({ to: "/performance/profiles/$id", params: { id: r.id } })}
        empty={
          <EmptyState
            icon={FileStack}
            title="No profiles yet"
            description="Create a profile for a position, add sections and items, then activate it."
            action={<Button onClick={() => setCreating(true)}>New profile</Button>}
          />
        }
      />
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const positions = useQuery({ queryKey: qk.org.positions(), queryFn: fetchPositions });
  const [position, setPosition] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const navigate = useNavigate();
  const create = useAction(useServerFn(createProfile), {
    invalidate: [qk.perf.profiles()],
    success: "Profile created",
    onSuccess: (r) => navigate({ to: "/performance/profiles/$id", params: { id: r.profile.id } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New evaluation profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Position" htmlFor="pp" required>
            <NativeSelect id="pp" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">Select…</option>
              {positions.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Name" htmlFor="pn" required>
            <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="pd">
            <Textarea
              id="pd"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!position || name.trim().length < 3 || create.isPending}
            onClick={() => create.mutate({ position_id: position, name, description: desc })}
          >
            Create draft v1
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
