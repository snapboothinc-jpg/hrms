import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { fetchEmployees, fetchRecognitionCategories, empName } from "@/lib/data";
import { submitNomination } from "@/lib/api/succession.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { useMe } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Panel,
  LoadingRows,
  ErrorState,
  Field,
  NativeSelect,
  DefaultNote,
} from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/recognition/nominate")({
  head: () => ({
    meta: [
      { title: "Nominate a colleague — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content:
          "Recognize a colleague's contribution. Nominations are reviewed before publishing.",
      },
    ],
  }),
  component: Page,
});

export function NominationForm({ onDone }: { onDone?: () => void }) {
  const me = useMe();
  const employees = useQuery({ queryKey: qk.org.employees(), queryFn: fetchEmployees });
  const categories = useQuery({
    queryKey: qk.rec.categories(),
    queryFn: fetchRecognitionCategories,
  });
  const submit = useServerFn(submitNomination);
  const [form, setForm] = useState({
    recipient_id: "",
    category_id: "",
    message: "",
    supporting_info: "",
  });
  const [busy, setBusy] = useState(false);

  if (employees.error)
    return <ErrorState error={employees.error} onRetry={() => employees.refetch()} />;
  if (!employees.data || !categories.data) return <LoadingRows />;

  const eligible = employees.data.filter(
    (e) => e.id !== me.data?.employee?.id && e.employment_status === "active",
  );
  const activeCategories = categories.data.filter((c) => c.active);
  const MIN_MESSAGE = 20;

  const doSubmit = async () => {
    setBusy(true);
    try {
      unwrap(
        await submit({
          data: {
            recipient_id: form.recipient_id,
            category_id: form.category_id,
            message: form.message,
            supporting_info: form.supporting_info || undefined,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      );
      toast.success("Nomination submitted for review");
      setForm({ recipient_id: "", category_id: "", message: "", supporting_info: "" });
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit the nomination");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Field
        label="Colleague"
        htmlFor="nom-recipient"
        required
        hint="You cannot nominate yourself."
      >
        <NativeSelect
          id="nom-recipient"
          value={form.recipient_id}
          onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}
        >
          <option value="">Choose…</option>
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>
              {empName(e)} ({e.employee_code})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Category" htmlFor="nom-category" required>
        <NativeSelect
          id="nom-category"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Choose…</option>
          {activeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="Message"
        htmlFor="nom-message"
        required
        hint={`At least ${MIN_MESSAGE} characters. ${form.message.length}/${MIN_MESSAGE}`}
      >
        <Textarea
          id="nom-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          maxLength={4000}
        />
      </Field>
      <Field label="Supporting information" htmlFor="nom-support">
        <Textarea
          id="nom-support"
          value={form.supporting_info}
          onChange={(e) => setForm({ ...form, supporting_info: e.target.value })}
          rows={2}
          maxLength={4000}
        />
      </Field>
      <div>
        <Button
          onClick={doSubmit}
          disabled={
            busy ||
            !form.recipient_id ||
            !form.category_id ||
            form.message.trim().length < MIN_MESSAGE
          }
        >
          Submit for review
        </Button>
      </div>
    </div>
  );
}

function Page() {
  return (
    <div>
      <PageHeader
        title="Nominate a colleague"
        description="Nominations are validated and reviewed before they are published to the feed."
      />
      <DefaultNote>
        Nomination limits and the approval route are defaults that require organizational
        validation.
      </DefaultNote>
      <Panel className="mt-4 max-w-2xl">
        <NominationForm />
      </Panel>
    </div>
  );
}
