import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Target, TrendingDown, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Priority Handling Logistics, Inc. — Performance & Development" },
      {
        name: "description",
        content:
          "Position-specific evaluations, evidence-based competency assessments and gap tracking for freight and logistics teams.",
      },
      {
        property: "og:title",
        content: "Priority Handling Logistics, Inc. — Performance & Development",
      },
      {
        property: "og:description",
        content:
          "Position-specific evaluations, evidence-based competency assessments and gap tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <section className="brand-band">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Truck className="size-6 shrink-0" aria-hidden />
            <span>Priority Handling Logistics, Inc.</span>
          </div>
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Develop the people who keep freight moving.
            </h1>
            <p className="mt-4 text-lg opacity-85">
              Evaluate against the profile for each position, assess competencies with evidence, and
              see exactly which safety-critical gaps remain open.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
        {[
          {
            icon: ClipboardCheck,
            t: "Versioned evaluation profiles",
            d: "Criteria, KPIs and weights per position. Completed evaluations keep the version they used.",
          },
          {
            icon: Target,
            t: "Evidence-based assessments",
            d: "Five configurable proficiency levels, assessed and approved with evidence.",
          },
          {
            icon: TrendingDown,
            t: "Honest gap tracking",
            d: "Not Assessed is never treated as level 0. Gaps close only through approved reassessment.",
          },
        ].map(({ icon: I, t, d }) => (
          <div key={t} className="surface p-5">
            <I className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 text-heading font-bold">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
