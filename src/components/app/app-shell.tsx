import * as React from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
  Truck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleNavigation, ROLE_LABELS, canSee } from "@/lib/policy";
import { usePermissions } from "@/hooks/use-me";
import { qk } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";
import { useTheme } from "@/hooks/use-theme";

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { set, me, role } = usePermissions();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hasEmployee = !!me?.employee;
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      {(role ? getRoleNavigation(role) : []).map((g) => {
        const items = g.items.filter((i) => canSee(i, set, hasEmployee));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            {!collapsed && (
              <p className="px-2 pb-1 font-data text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {g.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active =
                  path === i.to ||
                  (i.to !== "/dashboard" && i.to.split("/").length > 2 && path.startsWith(i.to));
                const Icon = i.icon;
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      onClick={onNavigate}
                      title={collapsed ? i.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active &&
                          "bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--color-sidebar-primary)]",
                        collapsed && "justify-center",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                      {collapsed && <span className="sr-only">{i.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NotificationBell() {
  const { me } = usePermissions();
  const { data } = useQuery({
    queryKey: [...qk.shared.notifications(), "unread"],
    enabled: !!me,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
  });
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label={`Notifications${data ? `, ${data} unread` : ""}`}
    >
      <Link to="/notifications" className="relative">
        <Bell />
        {!!data && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 font-data text-[10px] font-bold text-destructive-foreground">
            {data > 99 ? "99+" : data}
          </span>
        )}
      </Link>
    </Button>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { me, role } = usePermissions();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <span
            className="grid size-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
            aria-hidden
          >
            <Truck className="size-4" />
          </span>
          {!collapsed && (
            <span className="text-xs font-bold leading-tight tracking-tight text-sidebar-accent-foreground">
              Priority Handling
              <br />
              Logistics, Inc.
            </span>
          )}
        </div>
        <Sidebar collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 border-t border-sidebar-border px-4 py-3 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="absolute inset-0 bg-navy/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-sm font-bold leading-tight text-sidebar-accent-foreground">
                Priority Handling Logistics, Inc.
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="text-sidebar-foreground"
              >
                <X />
              </Button>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <NotificationBell />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Help">
                <HelpCircle />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm">
              <p className="font-bold">Help</p>
              <p className="mt-1 text-muted-foreground">
                Your menu shows only what your role ({role ? ROLE_LABELS[role] : "no role"}) can
                use. Press <kbd className="rounded border px-1 font-data">/</kbd> to search.
                Policies marked "Default - requires organizational validation" are placeholders
                until your organization confirms them.
              </p>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
                <span className="grid size-8 place-items-center rounded-full bg-primary font-bold text-primary-foreground">
                  {(me?.employee?.name ?? me?.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-sm font-bold">{me?.employee?.name ?? me?.email}</span>
                  <span className="block font-data text-xs text-muted-foreground">
                    {role ? ROLE_LABELS[role] : "No role assigned"}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{me?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {me?.employee && (
                <DropdownMenuItem asChild>
                  <Link to="/people/employees/$id" params={{ id: me.employee.id }}>
                    My profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={toggle}>
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {me && !me.role ? (
            <div className="surface p-6">
              <h1 className="text-title font-bold">No role assigned</h1>
              <p className="mt-1 text-muted-foreground">
                Your account has no role yet. Ask an administrator to assign one.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

export { Search };
