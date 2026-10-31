import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Inbox,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/result";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-data text-xs font-semibold uppercase tracking-wider text-accent-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  description,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
}) {
  return (
    <section className={cn("surface p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-heading font-bold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    default: "text-primary bg-secondary",
    success: "text-success bg-success-soft",
    warning: "text-warning bg-warning-soft",
    danger: "text-destructive bg-danger-soft",
  }[tone];
  return (
    <div className="surface flex items-start gap-4 p-4 sm:p-5">
      {Icon && (
        <span
          className={cn("grid size-10 shrink-0 place-items-center rounded-md", toneCls)}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-data text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-data text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
      <span
        className="mb-3 grid size-12 place-items-center rounded-full bg-secondary text-primary"
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <h3 className="text-heading font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : "We couldn't load this information.";
  const ref = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-danger-soft p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-bold text-foreground">Something went wrong</p>
        <p className="text-sm text-foreground/80">{msg}</p>
        {ref && <p className="font-data text-xs text-muted-foreground">Reference: {ref}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

const badge = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-data text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info/30 bg-info-soft text-accent-foreground",
        success: "border-success/30 bg-success-soft text-success",
        warning: "border-warning/40 bg-warning-soft text-foreground",
        danger: "border-destructive/30 bg-danger-soft text-destructive",
        primary: "border-primary/30 bg-secondary text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type Tone = NonNullable<VariantProps<typeof badge>["tone"]>;
const STATUS: Record<string, { tone: Tone; icon: LucideIcon; label?: string }> = {
  not_started: { tone: "neutral", icon: CircleDashed, label: "Not started" },
  in_progress: { tone: "info", icon: CircleDot, label: "In progress" },
  submitted: { tone: "warning", icon: Clock },
  under_review: { tone: "warning", icon: Clock, label: "Under review" },
  approved: { tone: "success", icon: CheckCircle2 },
  reopened: { tone: "warning", icon: RotateCcw },
  draft: { tone: "neutral", icon: CircleDashed },
  active: { tone: "success", icon: CheckCircle2 },
  archived: { tone: "neutral", icon: Archive },
  retired: { tone: "neutral", icon: Archive },
  inactive: { tone: "neutral", icon: Archive },
  open: { tone: "success", icon: CircleDot },
  closed: { tone: "neutral", icon: Archive },
  pending: { tone: "warning", icon: Clock },
  rejected: { tone: "danger", icon: XCircle },
  cancelled: { tone: "neutral", icon: XCircle },
  met: { tone: "success", icon: CheckCircle2, label: "Met" },
  gap: { tone: "danger", icon: AlertTriangle, label: "Gap" },
  not_assessed: { tone: "neutral", icon: CircleDashed, label: "Not Assessed" },
  on_leave: { tone: "warning", icon: Clock, label: "On leave" },
  terminated: { tone: "neutral", icon: XCircle },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as Tone, icon: CircleDot };
  const Icon = s.icon;
  const text = label ?? s.label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (
    <span className={badge({ tone: s.tone })}>
      <Icon className="size-3" aria-hidden />
      {text}
    </span>
  );
}

export function Tag({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className={badge({ tone })}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export function SafetyTags({ mandatory, safety }: { mandatory?: boolean; safety?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {mandatory && <Tag tone="primary">Mandatory</Tag>}
      {safety && (
        <Tag tone="danger" icon={ShieldAlert}>
          Safety-critical
        </Tag>
      )}
    </span>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="font-data text-sm font-semibold">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

export function DefaultNote({
  children = "Default - requires organizational validation.",
}: {
  children?: React.ReactNode;
}) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 font-data text-xs font-semibold text-foreground">
      <AlertTriangle className="size-3.5 text-warning" aria-hidden />
      {children}
    </p>
  );
}

export function fmtDate(d?: string | null) {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(d + "T00:00:00") : new Date(d);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
export function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
