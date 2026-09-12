import { Gauge, Map, Rocket, Search } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Discovery & Audit",
    description:
      "We map your workflows, tools, and bottlenecks to pinpoint exactly where time and money leak.",
  },
  {
    number: "02",
    icon: Map,
    title: "Architecture & Blueprint",
    description:
      "You get a clear technical spec — what we build, how it connects, and what it takes.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Rapid Build & Integration",
    description:
      "We build, integrate, and test in tight sprints, keeping you in the loop at every milestone.",
  },
  {
    number: "04",
    icon: Gauge,
    title: "Hand-off & Scaling",
    description:
      "Documented systems, trained teams, and a foundation built to grow with your operations.",
  },
];

export function Process() {
  return (
    <section id="process" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            How we work
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            From bottleneck to blueprint to build
          </h2>
          <p className="mt-4 text-muted-foreground">
            A proven four-step sequence that gets you from &ldquo;where do we
            start?&rdquo; to a shipped, scalable system — without the software
            project sprawl.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="relative rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-sm font-bold text-indigo-300">
                {step.number}
              </span>
              <step.icon className="mt-5 size-5 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}