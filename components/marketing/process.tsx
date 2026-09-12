import { Gauge, Map, Rocket, Search } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Icons are matched to dict.process.steps by index. */
const STEP_ICONS = [Search, Map, Rocket, Gauge];

export function Process({ dict }: { dict: Dictionary["process"] }) {
  return (
    <section id="process" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-300">
            {dict.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {dict.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{dict.subtitle}</p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dict.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Search;
            return (
              <li
                key={step.title}
                className="relative rounded-xl border border-border bg-card/60 p-6"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-sm font-bold text-indigo-500 dark:text-indigo-300">
                  {step.number}
                </span>
                <Icon className="mt-5 size-5 text-muted-foreground" />
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}