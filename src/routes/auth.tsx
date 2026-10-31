import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/kit";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — Priority Handling Logistics, Inc." },
      {
        name: "description",
        content: "Sign in to Priority Handling Logistics, Inc. performance and development.",
      },
      { property: "og:title", content: "Sign in — Priority Handling Logistics, Inc." },
      {
        property: "og:description",
        content: "Sign in to Priority Handling Logistics, Inc. performance and development.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const DEMO = [
  ["Super Admin", "superadmin@priorityhandling.demo"],
  ["Admin", "admin@priorityhandling.demo"],
  ["HR Administrator", "hr@priorityhandling.demo"],
  ["Department Head", "depthead@priorityhandling.demo"],
  ["Supervisor", "supervisor@priorityhandling.demo"],
  ["Employee", "employee@priorityhandling.demo"],
  ["Operations Manager", "ops@priorityhandling.demo"],
] as const;

function safeRedirect(r?: string) {
  if (!r) return "/dashboard";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin || u.pathname.startsWith("/auth")) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(v: z.infer<typeof schema>) {
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword(v);
    if (error) {
      setErr("Email or password is incorrect, or the account is inactive.");
      return;
    }
    navigate({ to: safeRedirect(redirect), replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="brand-band hidden flex-col justify-between p-10 lg:flex">
        <div className="flex items-center gap-2 text-xl font-bold">
          <Truck className="size-6 shrink-0" aria-hidden />
          <span>Priority Handling Logistics, Inc.</span>
        </div>
        <div>
          <h1 className="text-display font-bold">Performance and development, end to end.</h1>
          <p className="mt-3 max-w-md opacity-85">
            Evaluate against position profiles, assess competencies with evidence, and close gaps
            that matter on the road and in the warehouse.
          </p>
        </div>
        <p className="font-data text-sm opacity-70">Freight & logistics HR</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-title font-bold">Sign in</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Accounts are created by your administrator.
          </p>
          <form
            method="post"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <Field
              label="Email"
              htmlFor="email"
              error={form.formState.errors.email?.message}
              required
            >
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              error={form.formState.errors.password?.message}
              required
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
            </Field>
            {err && (
              <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-destructive">
                {err}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </form>
          <details className="mt-8 rounded-md border bg-card p-3 text-sm">
            <summary className="cursor-pointer font-bold">Demo accounts</summary>
            <p className="mt-2 text-muted-foreground">
              Demo data only. Password for all:{" "}
              <code className="font-data">Priority-Demo-2026!</code>
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO.map(([role, email]) => (
                <li key={email}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                    onClick={() => {
                      form.setValue("email", email);
                      form.setValue("password", "Priority-Demo-2026!");
                    }}
                  >
                    <span className="font-bold">{role}</span>{" "}
                    <span className="font-data text-muted-foreground">{email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
