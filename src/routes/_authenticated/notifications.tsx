import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { check } from "@/lib/data";
import { markNotificationsRead } from "@/lib/api/actions.functions";
import { useAction } from "@/hooks/use-action";
import { qk } from "@/lib/query-keys";
import { PageHeader, EmptyState, ErrorState, LoadingRows, fmtDateTime } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Priority Handling Logistics, Inc." },
      { name: "description", content: "Your notifications." },
    ],
  }),
  component: Page,
});

type N = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

function Page() {
  const q = useQuery({
    queryKey: qk.shared.notifications(),
    queryFn: async () =>
      check(
        await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ) as N[],
  });
  const mark = useAction(useServerFn(markNotificationsRead), {
    invalidate: [qk.shared.notifications()],
  });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        actions={
          <Button
            variant="outline"
            disabled={!unread || mark.isPending}
            onClick={() => mark.mutate({ ids: null })}
          >
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingRows />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Assignments, approvals and decisions will appear here."
        />
      ) : (
        <ul className="surface divide-y">
          {q.data.map((n) => (
            <li
              key={n.id}
              className={cn("flex items-start gap-3 p-4", !n.read_at && "bg-secondary/60")}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  n.read_at ? "bg-transparent" : "bg-primary",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {!n.read_at && <span className="sr-only">Unread: </span>}
                  {n.link ? (
                    <Link
                      to={n.link}
                      className="hover:underline"
                      onClick={() => !n.read_at && mark.mutate({ ids: [n.id] })}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="font-data text-xs text-muted-foreground">
                  {fmtDateTime(n.created_at)}
                </p>
              </div>
              {!n.read_at && (
                <Button size="sm" variant="ghost" onClick={() => mark.mutate({ ids: [n.id] })}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
