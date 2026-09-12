import { ChevronDown } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function Faq({ dict }: { dict: Dictionary["faq"] }) {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            {dict.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {dict.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{dict.subtitle}</p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {dict.items.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-white/10 bg-white/5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium sm:text-base [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}