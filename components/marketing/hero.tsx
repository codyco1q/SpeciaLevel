import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  "AI Workflow Automation",
  "Systems & API Integration",
  "Bespoke Internal Portals",
  "Funnel & Lead Engines",
];

export function Hero() {
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
          className="mb-6 rounded-full border-white/15 bg-white/5 px-3 py-1 font-medium text-muted-foreground"
        >
          <Sparkles className="text-indigo-300" />
          Custom AI workflow automation for modern operations
        </Badge>

        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          Your operations run on manual work.{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Let&apos;s change that.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          SpeciaLevel designs and builds custom AI workflows, systems
          integrations, and internal portals that eliminate manual tasks,
          connect your disconnected tools, and scale with your operations.
        </p>

        <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="#packages">
              Explore Packages
              <ArrowRight />
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
              Book a Consultation
            </a>
          </Button>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {CAPABILITIES.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}