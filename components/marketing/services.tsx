import { Bot, Cable, Check, Filter, LayoutDashboard } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Icons are matched to dict.services.items by index. */
const SERVICE_ICONS = [Bot, Cable, LayoutDashboard, Filter];

export function Services({ dict }: { dict: Dictionary["services"] }) {
  return (
    <section id="services" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            {dict.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {dict.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{dict.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dict.items.map((service, index) => {
            const Icon = SERVICE_ICONS[index] ?? Bot;
            return (
              <Card
                key={service.title}
                className="border-white/10 bg-white/5 shadow-none"
              >
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20">
                    <Icon className="size-5 text-indigo-300" />
                  </div>
                  <CardTitle className="pt-2 text-base">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {service.deliverables.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <Check className="size-3 text-indigo-300" />
                      {item}
                    </span>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}