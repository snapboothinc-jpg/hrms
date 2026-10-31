import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMe } from "@/hooks/use-me";
import { fetchEmployee } from "@/lib/data";
import { updateMyContact } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import { ErrorState, Field, LoadingRows, PageHeader, Panel } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — Priority Handling Logistics, Inc." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data, isLoading, error } = useMe();
  const employee = useQuery({
    queryKey: qk.org.employee(data?.employee?.id ?? ""),
    queryFn: () => fetchEmployee(data!.employee!.id),
    enabled: !!data?.employee,
  });
  const [phone, setPhone] = useState<string | null>(null);
  const contact = useAction(useServerFn(updateMyContact), {
    invalidate: [qk.org.all, qk.me],
    success: "Contact updated",
    onSuccess: () => setPhone(null),
  });
  if (isLoading) return <LoadingRows />;
  if (error) throw error;
  if (data?.employee && employee.isLoading) return <LoadingRows />;
  if (employee.error)
    return <ErrorState error={employee.error} onRetry={() => employee.refetch()} />;

  return (
    <div>
      <PageHeader title="My profile" description="Your account and linked employee record." />
      <Panel title={data?.employee?.name ?? "Account details"}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-muted-foreground">Email</dt>
            <dd>{data?.email ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground">Role</dt>
            <dd>{data?.role ?? "No role assigned"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground">Employee record</dt>
            <dd>{data?.employee ? "Linked" : "Not linked"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground">Department</dt>
            <dd>{data?.employee?.department_id ?? "Not available"}</dd>
          </div>
          {data?.employee && (
            <div className="sm:col-span-2">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  contact.mutate({
                    phone: phone ?? employee.data!.phone ?? "",
                    version: employee.data!.version,
                  });
                }}
              >
                <Field label="Phone" htmlFor="profile-phone">
                  <Input
                    id="profile-phone"
                    value={phone ?? employee.data?.phone ?? ""}
                    maxLength={40}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  disabled={
                    contact.isPending ||
                    (phone ?? employee.data?.phone ?? "") === (employee.data?.phone ?? "")
                  }
                >
                  Save contact
                </Button>
              </form>
            </div>
          )}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          You may update your contact phone number. Employment and organization details remain
          managed by HR.
        </p>
      </Panel>
    </div>
  );
}
