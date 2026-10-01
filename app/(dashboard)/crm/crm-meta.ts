import type { CrmStage, MarketingLeadStatus } from "@/types/database";

/**
 * Shared copy/display metadata for the CRM module. Client-safe.
 */

export const CRM_STAGES: CrmStage[] = [
  "lead",
  "contacted",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export const PRESET_STAGE_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#0ea5e9", // Sky
  "#06b6d4", // Cyan
  "#14b8a6", // Teal
  "#10b981", // Emerald / Won
  "#84cc16", // Lime
  "#eab308", // Yellow
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red / Lost
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#64748b", // Slate
] as const;

export interface PipelineTemplate {
  id: string;
  name: string;
  color: string;
  description: string;
  stages: Array<{
    name: string;
    color: string;
    stageType: "open" | "won" | "lost";
    probability: number;
    staleDays: number;
  }>;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "standard",
    name: "Standard B2B Sales",
    color: "#6366f1",
    description: "Ideal for direct sales workflows from inbound lead to closed deal.",
    stages: [
      { name: "Lead", color: "#6366f1", stageType: "open", probability: 10, staleDays: 14 },
      { name: "Qualified", color: "#0ea5e9", stageType: "open", probability: 30, staleDays: 14 },
      { name: "Proposal", color: "#8b5cf6", stageType: "open", probability: 60, staleDays: 14 },
      { name: "Negotiation", color: "#f59e0b", stageType: "open", probability: 80, staleDays: 14 },
      { name: "Won", color: "#10b981", stageType: "won", probability: 100, staleDays: 30 },
      { name: "Lost", color: "#ef4444", stageType: "lost", probability: 0, staleDays: 30 },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise High-Touch",
    color: "#8b5cf6",
    description: "Designed for enterprise deals with technical and legal review.",
    stages: [
      { name: "Discovery", color: "#6366f1", stageType: "open", probability: 15, staleDays: 21 },
      { name: "Demo & Pitch", color: "#0ea5e9", stageType: "open", probability: 35, staleDays: 21 },
      { name: "Legal Review", color: "#8b5cf6", stageType: "open", probability: 60, staleDays: 30 },
      { name: "Executive Approval", color: "#f59e0b", stageType: "open", probability: 85, staleDays: 21 },
      { name: "Closed Won", color: "#10b981", stageType: "won", probability: 100, staleDays: 45 },
      { name: "Closed Lost", color: "#ef4444", stageType: "lost", probability: 0, staleDays: 45 },
    ],
  },
  {
    id: "partnerships",
    name: "Partnerships & BD",
    color: "#0ea5e9",
    description: "Track partner outreach, co-marketing, and signed agreements.",
    stages: [
      { name: "Prospect Partner", color: "#64748b", stageType: "open", probability: 10, staleDays: 21 },
      { name: "Exploratory Call", color: "#0ea5e9", stageType: "open", probability: 30, staleDays: 14 },
      { name: "Agreement Draft", color: "#f59e0b", stageType: "open", probability: 70, staleDays: 21 },
      { name: "Active Partner", color: "#10b981", stageType: "won", probability: 100, staleDays: 60 },
      { name: "Declined", color: "#ef4444", stageType: "lost", probability: 0, staleDays: 60 },
    ],
  },
  {
    id: "renewals",
    name: "Renewals & Retention",
    color: "#10b981",
    description: "Proactively manage subscription renewals and health checks.",
    stages: [
      { name: "Upcoming Renewal", color: "#0ea5e9", stageType: "open", probability: 50, staleDays: 30 },
      { name: "Health Check", color: "#8b5cf6", stageType: "open", probability: 70, staleDays: 21 },
      { name: "Proposal Sent", color: "#f59e0b", stageType: "open", probability: 90, staleDays: 14 },
      { name: "Renewed", color: "#10b981", stageType: "won", probability: 100, staleDays: 60 },
      { name: "Churned", color: "#ef4444", stageType: "lost", probability: 0, staleDays: 60 },
    ],
  },
];

/** Semantic column dots: open → neutral, warm, amber, green, red. */
export const CRM_STAGE_DOT_CLASSES: Record<string, string> = {
  lead: "bg-muted-foreground",
  contacted: "bg-blue-500",
  qualified: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-indigo-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
};

export function getStageColor(stageName: string, customColor?: string | null, probability?: number): string {
  if (customColor && customColor.trim().startsWith("#")) {
    return customColor.trim();
  }
  const normalized = stageName.toLowerCase().trim();
  if (normalized.includes("won") || normalized.includes("signed") || probability === 100) return "#10b981";
  if (normalized.includes("lost") || normalized.includes("churn") || probability === 0) return "#ef4444";
  if (normalized.includes("negotiat") || normalized.includes("contract") || normalized.includes("review")) return "#f59e0b";
  if (normalized.includes("proposal") || normalized.includes("demo") || normalized.includes("pitch")) return "#8b5cf6";
  if (normalized.includes("contact") || normalized.includes("qualif") || normalized.includes("discover")) return "#0ea5e9";
  if (normalized.includes("lead") || normalized.includes("inbound")) return "#6366f1";
  return "#3b82f6";
}

export function getStageBadgeStyle(color?: string | null) {
  const safeColor = color || "#3b82f6";
  return {
    backgroundColor: `${safeColor}18`,
    borderColor: `${safeColor}45`,
    color: safeColor,
  };
}

export function getStageDotClass(stage: string, probability?: number): string {
  const normalized = stage.toLowerCase().trim();
  if (CRM_STAGE_DOT_CLASSES[normalized]) {
    return CRM_STAGE_DOT_CLASSES[normalized];
  }
  if (probability !== undefined) {
    if (probability === 100) return "bg-emerald-500";
    if (probability === 0) return "bg-red-500";
    if (probability >= 70) return "bg-indigo-500";
    if (probability >= 40) return "bg-amber-500";
    if (probability >= 20) return "bg-blue-500";
    return "bg-slate-400";
  }
  return "bg-primary";
}

export function getStageName(stage: string, dictionaryStages?: Record<string, string>): string {
  const normalized = stage.toLowerCase().trim();
  if (dictionaryStages && dictionaryStages[normalized]) {
    return dictionaryStages[normalized];
  }
  return stage;
}

export const LEAD_STATUSES: MarketingLeadStatus[] = [
  "new",
  "contacted",
  "converted",
  "archived",
];

export const LEAD_STATUS_BADGE_CLASSES: Record<MarketingLeadStatus, string> = {
  new: "border-blue-300 bg-blue-50 text-blue-700",
  contacted: "border-amber-300 bg-amber-50 text-amber-700",
  converted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  archived: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

/** ISO 4217 codes offered in the deal dialog (any 3-letter code is accepted). */
export const CRM_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR"] as const;

/**
 * Formats a deal value with the correct currency symbol placement for the
 * active locale. Falls back to USD for codes outside the known set so an
 * unexpected stored currency never crashes the board.
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale = "en-US"
): string {
  const code = (currency || "USD").toUpperCase();
  const safe = (CRM_CURRENCIES as readonly string[]).includes(code)
    ? code
    : "USD";
  return new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    style: "currency",
    currency: safe,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/** "Sep 12, 2026" for inbound lead timestamps. */
export function formatLeadDate(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
