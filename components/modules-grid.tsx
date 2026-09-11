import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Users,
  Building2,
  ShieldCheck,
  Contact,
  Megaphone,
  Phone,
  Zap,
  Brain,
  MessageSquare,
  CheckSquare,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ActiveModuleRow {
  module_key: string;
  module_name: string;
  is_enabled?: boolean;
}

interface ModulesGridProps {
  /** Modules enabled for the current organization (from organization_modules). */
  activeModules: ActiveModuleRow[];
  /** Compact layout for embedding in the dashboard. */
  compact?: boolean;
}

interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  link?: string;
  isFuture?: boolean;
}

/**
 * Currently shipped MVP modules. A module only renders as active when its
 * `module_key` is present in `activeModules` and enabled — so disabling a
 * module in `organization_modules` gracefully downgrades it to "Coming Soon"
 * without any feature code changing.
 */
const ACTIVE_MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    description: "Your command center for daily operations.",
    icon: LayoutDashboard,
    link: "/dashboard",
  },
  {
    key: "calendar",
    name: "Calendar",
    description: "Schedule events and coordinate your team.",
    icon: CalendarDays,
    link: "/calendar",
  },
  {
    key: "time",
    name: "Time Tracking",
    description: "Clock in, clock out, and review your hours.",
    icon: Clock,
    link: "/time",
  },
  {
    key: "employees",
    name: "Employees",
    description: "Manage your team members and profiles.",
    icon: Users,
    link: "/employees",
  },
  {
    key: "departments",
    name: "Departments",
    description: "Organize your team into departments.",
    icon: Building2,
    link: "/departments",
  },
  {
    key: "roles",
    name: "Roles & Permissions",
    description: "Control access with role-based permissions.",
    icon: ShieldCheck,
    link: "/roles",
  },
];

/**
 * Future platform modules. Shown as "Coming Soon" so the product feels
 * modular and ready for expansion without implying they are usable.
 */
const FUTURE_MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "crm",
    name: "CRM",
    description: "Manage customer relationships and pipelines.",
    icon: Contact,
    isFuture: true,
  },
  {
    key: "marketing",
    name: "Marketing",
    description: "Campaigns, social planning, and content workflows.",
    icon: Megaphone,
    isFuture: true,
  },
  {
    key: "telecommunications",
    name: "Telecommunications",
    description: "Phone systems and calling features.",
    icon: Phone,
    isFuture: true,
  },
  {
    key: "automations",
    name: "Automations",
    description: "Automate repetitive workflows and sequences.",
    icon: Zap,
    isFuture: true,
  },
  {
    key: "ai",
    name: "AI",
    description: "AI-powered agents and business intelligence.",
    icon: Brain,
    isFuture: true,
  },
  {
    key: "chat",
    name: "Chat",
    description: "Internal team messaging and channels.",
    icon: MessageSquare,
    isFuture: true,
  },
  {
    key: "tasks",
    name: "Tasks",
    description: "Task management and assignment tracking.",
    icon: CheckSquare,
    isFuture: true,
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "Business insights, reports, and KPIs.",
    icon: BarChart3,
    isFuture: true,
  },
];

/** In compact mode the dashboard shows a taste of future modules. */
const FUTURE_VISIBLE_IN_COMPACT = 4;

/**
 * Module showcase grid. Active modules (enabled in organization_modules)
 * link to their routes; future modules render disabled with a "Coming Soon"
 * badge. Server component — no interactivity required.
 */
export function ModulesGrid({ activeModules, compact = false }: ModulesGridProps) {
  const enabledKeys = new Set(
    activeModules.filter((m) => m.is_enabled !== false).map((m) => m.module_key)
  );

  const recordedNames = new Map(
    activeModules.map((m) => [m.module_key, m.module_name])
  );

  // An active definition renders as a navigable card only when its module
  // is enabled for this organization.
  const activeCards = ACTIVE_MODULE_DEFINITIONS.filter((mod) =>
    enabledKeys.has(mod.key)
  ).map((mod) => ({
    ...mod,
    name: recordedNames.get(mod.key) ?? mod.name,
  }));

  const futureCards = FUTURE_MODULE_DEFINITIONS.filter(
    (mod) => !enabledKeys.has(mod.key)
  );
  const visibleFutureCards = compact
    ? futureCards.slice(0, FUTURE_VISIBLE_IN_COMPACT)
    : futureCards;
  const hiddenFutureCount = futureCards.length - visibleFutureCards.length;

  const gridClass = compact
    ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-6">
      {/* Shipped modules */}
      <section>
        {!compact && (
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available now
          </h3>
        )}
        {activeCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No modules are enabled yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className={gridClass}>
            {activeCards.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.key}
                  href={mod.link ?? "#"}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border border-border bg-card transition-colors hover:bg-accent/50 hover:border-foreground/20",
                    compact ? "p-3" : "p-4"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {mod.name}
                    </p>
                    {!compact && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Future modules */}
      {visibleFutureCards.length > 0 && (
        <section>
          {!compact && (
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Coming soon
            </h3>
          )}
          <div className={gridClass}>
            {visibleFutureCards.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.key}
                  aria-disabled="true"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 opacity-70",
                    compact ? "p-3" : "p-4"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium leading-tight">
                        {mod.name}
                      </p>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px] font-normal"
                      >
                        Coming Soon
                      </Badge>
                    </div>
                    {!compact && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {hiddenFutureCount > 0 && (
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground",
                  compact ? "p-3" : "p-4"
                )}
              >
                +{hiddenFutureCount} more coming soon
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}