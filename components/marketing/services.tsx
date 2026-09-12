import { Bot, Cable, Check, Filter, LayoutDashboard } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SERVICES = [
  {
    icon: Bot,
    title: "AI Workflow Automation",
    description:
      "Custom agentic workflows, document processing, and webhook routing that replace repetitive manual work with reliable, always-on automation.",
    deliverables: ["Agentic workflows", "Document AI", "Webhook routing"],
  },
  {
    icon: Cable,
    title: "Systems & API Integration",
    description:
      "Connect your CRM, ERP, accounting, and communication tools into one system that actually talks to itself.",
    deliverables: ["CRM & ERP", "Accounting", "Communications"],
  },
  {
    icon: LayoutDashboard,
    title: "Bespoke Internal Portals",
    description:
      "Role-based dashboards, employee portals, and client hubs built around how your business actually operates.",
    deliverables: ["Role-based dashboards", "Employee portals", "Client hubs"],
  },
  {
    icon: Filter,
    title: "Funnel & Lead Automation",
    description:
      "Automated lead enrichment, CRM syncing, and follow-up engines that turn incoming interest into booked conversations.",
    deliverables: ["Lead enrichment", "CRM syncing", "Follow-up engines"],
  },
];

export function Services() {
  return (
    <section id="services" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
            Core services
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Everything your operations run on — built custom
          </h2>
          <p className="mt-4 text-muted-foreground">
            Four practice areas, one goal: take the manual out of your daily
            operations and put it into systems that never sleep.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <Card
              key={service.title}
              className="border-white/10 bg-white/5 shadow-none"
            >
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20">
                  <service.icon className="size-5 text-indigo-300" />
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
          ))}
        </div>
      </div>
    </section>
  );
}