import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/kit";
import { BrandLogo } from "@/components/app/brand-logo";

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
  ["Super Admin", "victor.superadmin+priority@gmail.com"],
  ["Admin", "nina.admin+priority@gmail.com"],
  ["HR Administrator", "liza.hradmin+priority@gmail.com"],
  ["Department Head", "maria.depthead+priority@gmail.com"],
  ["Supervisor", "jose.supervisor+priority@gmail.com"],
  ["Employee", "ana.employee+priority@gmail.com"],
  ["Operations Manager", "carlo.opsmanager+priority@gmail.com"],
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
    <main className="flex min-h-screen min-h-svh items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[342px] flex-col items-center">
        <BrandLogo className="size-8 rounded-none p-0 shadow-none" decorative />
        <p className="mt-3 text-center text-sm font-bold leading-5 text-foreground">
          Priority Handling Logistics, Inc.
        </p>

        <section className="surface mt-5 w-full p-4">
          <h1 className="text-sm font-bold leading-5 text-foreground">Sign in</h1>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            Use your work email and password.
          </p>

          <form
            method="post"
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-4 space-y-3 [&_label]:text-xs [&_label]:leading-4"
            noValidate
          >
            <Field
              label="Email"
              htmlFor="email"
              error={form.formState.errors.email?.message}
              required
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-7 rounded-md bg-background text-sm"
                {...form.register("email")}
              />
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
                className="h-7 rounded-md bg-background text-sm"
                {...form.register("password")}
              />
            </Field>
            {err && (
              <p role="alert" className="rounded-md bg-danger-soft p-2 text-sm text-destructive">
                {err}
              </p>
            )}
            <Button
              type="submit"
              className="min-h-7 h-7 w-full rounded-md text-xs"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </form>
        </section>

        {import.meta.env.DEV && (
          <details className="surface mt-4 w-full p-3 text-sm">
            <summary className="min-h-8 cursor-pointer content-center font-bold">
              Demo accounts
            </summary>
            <p className="mt-2 text-muted-foreground">
              Development demo data only. Password for all:{" "}
              <code className="font-data">Test1234!</code>
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO.map(([role, email]) => (
                <li key={email}>
                  <button
                    type="button"
                    className="min-h-8 w-full rounded px-2 py-1 text-left hover:bg-accent"
                    onClick={() => {
                      form.setValue("email", email);
                      form.setValue("password", "Test1234!");
                    }}
                  >
                    <span className="font-bold">{role}</span>{" "}
                    <span className="font-data text-muted-foreground">{email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
