import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function Hero({ dict }: { dict: Dictionary["hero"] }) {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-24 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28">
        <Badge
          variant="outline"
          className="mb-6 rounded-full border-border bg-card/60 px-3 py-1 font-medium text-muted-foreground"
        >
          <Sparkles className="text-indigo-500 dark:text-indigo-300" />
          {dict.badge}
        </Badge>

        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          {dict.headlineTop}{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300">
            {dict.headlineHighlight}
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          {dict.subtitle}
        </p>

        <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="#packages">
              {dict.explorePackages}
              <ArrowRight className="rtl:rotate-180" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
          >
            <a href="#contact">
              <CalendarCheck />
              {dict.bookConsultation}
            </a>
          </Button>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {dict.capabilities.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}