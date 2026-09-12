import { ArrowRight, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

export function Packages({ dict }: { dict: Dictionary["packages"] }) {
  return (
    <section id="packages" className="scroll-mt-24">
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

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {dict.tiers.map((pkg) => (
            <Card
              key={pkg.name}
              className={cn(
                "relative border-white/10 bg-white/5 shadow-none",
                pkg.highlight &&
                  "border-indigo-400/60 bg-indigo-500/10 shadow-xl shadow-indigo-500/10"
              )}
            >
              {pkg.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white shadow-md">
                  {dict.mostPopular}
                </Badge>
              )}
              <CardHeader className={cn(pkg.highlight && "pt-8")}>
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {pkg.tagline}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <ul className="space-y-3">
                  {pkg.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                  {pkg.ideal}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full"
                  variant={pkg.highlight ? "default" : "outline"}
                >
                  <a href="#contact">
                    {pkg.cta}
                    <ArrowRight className="rtl:rotate-180" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}