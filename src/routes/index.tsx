import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Target, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/brand-logo";

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
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-12 sm:px-8 sm:py-16 md:gap-16 md:py-24">
          <div className="flex items-center gap-3 text-lg font-bold sm:text-xl">
            <BrandLogo className="size-12 rounded-lg p-1.5" decorative />
            <span className="leading-tight">Priority Handling Logistics, Inc.</span>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Develop the people who keep freight moving.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-85 sm:text-lg">
              Evaluate against the profile for each position, assess competencies with evidence, and
              see exactly which safety-critical gaps remain open.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 sm:px-8 sm:py-14 md:grid-cols-3">
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
          <div key={t} className="surface p-5 sm:p-6">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
              <I className="size-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-heading font-bold">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
