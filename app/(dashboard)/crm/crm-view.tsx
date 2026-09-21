"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Contact,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getDeals,
  getMarketingLeads,
  updateDealStage,
  type DealRow,
  type MarketingLeadRow,
} from "@/lib/actions/crm";
import type { CrmStage } from "@/types/database";
import {
  CRM_STAGES,
  CRM_STAGE_DOT_CLASSES,
  LEAD_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatLeadDate,
} from "./crm-meta";
import { DealDialog, type CrmMemberOption } from "./deal-dialog";
import { DealDetailDialog } from "./deal-detail-dialog";
import { ContactsTab } from "./contacts-tab";
import type { ContactSummaryRow } from "@/lib/actions/crm-contacts";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface DealCardProps {
  deal: DealRow;
  onMove: (dealId: string, stage: CrmStage) => void;
  onSelect: (deal: DealRow) => void;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** Single pipeline card: identity, value, and chevron stage moves. */
function DealCard({ deal, onMove, onSelect, platform, locale }: DealCardProps) {
  const t = platform.crm;
  const stageIndex = CRM_STAGES.indexOf(deal.stage);
  const hasPrev = stageIndex > 0;
  const hasNext = stageIndex < CRM_STAGES.length - 1;

  return (
    <div
      onClick={() => onSelect(deal)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(deal);
        }
      }}
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-sm font-semibold leading-snug">{deal.title}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {deal.contact && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {deal.contact.company || deal.contact.name}
            </span>
          </span>
        )}
        {deal.assignee && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {deal.assignee.fullName ?? deal.assignee.email ?? t.member}
            </span>
          </span>
        )}
      </div>

      <p className="mt-2 text-sm font-semibold tracking-tight tabular-nums">
        {formatCurrency(deal.value, deal.currency, locale)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/60 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={!hasPrev}
          onClick={(e) => {
            e.stopPropagation();
            onMove(deal.id, CRM_STAGES[stageIndex - 1]);
          }}
          aria-label={t.movePrevious}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              CRM_STAGE_DOT_CLASSES[deal.stage]
            )}
          />
          <span className="truncate">{t.stages[deal.stage]}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={!hasNext}
          onClick={(e) => {
            e.stopPropagation();
            onMove(deal.id, CRM_STAGES[stageIndex + 1]);
          }}
          aria-label={t.moveNext}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

interface CrmViewProps {
  initialDeals: DealRow[];
  initialLeads: MarketingLeadRow[];
  members: CrmMemberOption[];
  initialContacts: ContactSummaryRow[];
  canManage: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
  /** Localized package-of-interest labels from the contact form dict. */
  packageLabels: Record<string, string>;
  initialTab?: string;
}

/**
 * CRM orchestrator: Pipeline (kanban board) and Inbound Leads (table of
 * website inquiries). Stage moves are available to any `crm.view` holder;
 * creating deals and converting leads require `crm.manage` (the Inbound
 * Leads tab is hidden for view-only members because RLS restricts lead
 * reads to managers).
 */
export function CrmView({
  initialDeals,
  initialLeads,
  members,
  initialContacts,
  canManage,
  platform,
  locale,
  packageLabels,
  initialTab,
}: CrmViewProps) {
  const t = platform.crm;
  const common = platform.common;
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");

  const resolvedInitialTab =
    urlTab === "contacts" || initialTab === "contacts"
      ? "contacts"
      : (urlTab === "leads" || initialTab === "leads") && canManage
        ? "leads"
        : "pipeline";

  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [leads, setLeads] = useState<MarketingLeadRow[]>(initialLeads);
  const [tab, setTab] = useState<string>(resolvedInitialTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [convertingLead, setConvertingLead] =
    useState<MarketingLeadRow | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const urlDealId = searchParams.get("dealId");
  const urlNew = searchParams.get("new");

  useEffect(() => {
    if (urlTab === "contacts") {
      setTab("contacts");
    } else if (urlTab === "leads" && canManage) {
      setTab("leads");
    } else if (urlTab === "pipeline") {
      setTab("pipeline");
    }
  }, [urlTab, canManage]);

  useEffect(() => {
    if (urlDealId && deals.length > 0) {
      const match = deals.find((d) => d.id === urlDealId);
      if (match) {
        setSelectedDeal(match);
      }
    }
  }, [urlDealId, deals]);

  useEffect(() => {
    if (urlNew === "true" || urlNew === "1") {
      setCreateOpen(true);
    }
  }, [urlNew]);

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "pipeline") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const query = params.toString();
    router.replace(query ? `/crm?${query}` : "/crm", { scroll: false });
  };

  /** Refetch deals (and leads when permitted). */
  async function refreshAll() {
    const rows = await getDeals();
    if (rows) {
      setDeals(rows);
      if (selectedDeal) {
        const refreshed = rows.find((d) => d.id === selectedDeal.id);
        if (refreshed) setSelectedDeal(refreshed);
      }
    }
    if (canManage) {
      const leadRows = await getMarketingLeads();
      if (leadRows) setLeads(leadRows);
    }
  }

  async function handleStageMove(dealId: string, stage: CrmStage) {
    if (actionError) setActionError(null);
    const result = await updateDealStage(dealId, stage);
    if (result.status === "error") {
      setActionError(result.error ?? t.errors.updateFailed);
      return;
    }
    setDeals((current) =>
      current.map((deal) => (deal.id === dealId ? { ...deal, stage } : deal))
    );
    setSelectedDeal((prev) =>
      prev && prev.id === dealId ? { ...prev, stage } : prev
    );
    await refreshAll();
  }

  function handleDealSaved() {
    setCreateOpen(false);
    setConvertingLead(null);
    setEditingDeal(null);
    void refreshAll();
  }

  function handleDealDeleted() {
    if (selectedDeal) {
      setDeals((prev) => prev.filter((d) => d.id !== selectedDeal.id));
    }
    setSelectedDeal(null);
    void refreshAll();
  }

  const dealsByStage = (stage: CrmStage) =>
    deals.filter((deal) => deal.stage === stage);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t.newDeal}
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="pipeline">{t.tabs.pipeline}</TabsTrigger>
          <TabsTrigger value="contacts">{t.tabs.contacts}</TabsTrigger>
          {canManage && (
            <TabsTrigger value="leads">{t.tabs.inboundLeads}</TabsTrigger>
          )}
        </TabsList>

        {/* ── Pipeline board ─────────────────────────────────── */}
        <TabsContent value="pipeline" className="mt-4">
          {deals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium">{t.noDealsYet}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {canManage
                  ? t.noDealsYetHintManage
                  : t.noDealsYetHintView}
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {CRM_STAGES.map((stage) => (
                <div key={stage} className="w-72 shrink-0">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        CRM_STAGE_DOT_CLASSES[stage]
                      )}
                    />
                    <p className="text-sm font-semibold">{t.stages[stage]}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                      {dealsByStage(stage).length}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-lg bg-muted/40 p-2">
                    {dealsByStage(stage).length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                        {t.noDealsInColumn}
                      </p>
                    ) : (
                      dealsByStage(stage).map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onMove={handleStageMove}
                          onSelect={setSelectedDeal}
                          platform={platform}
                          locale={locale}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Inbound leads table ─────────────────────────────── */}
        {canManage && (
          <TabsContent value="leads" className="mt-4">
            {leads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <Contact className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium">{t.noLeadsYet}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.noLeadsYetHint}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.leadName}</TableHead>
                      <TableHead>{t.leadCompany}</TableHead>
                      <TableHead>{t.leadEmail}</TableHead>
                      <TableHead>{t.packageOfInterest}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.received}</TableHead>
                      <TableHead className="text-end">
                        {common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.company || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.packageOfInterest
                            ? packageLabels[lead.packageOfInterest] ??
                              lead.packageOfInterest
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 text-[10px]",
                              LEAD_STATUS_BADGE_CLASSES[lead.status]
                            )}
                          >
                            {t.statuses[lead.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLeadDate(lead.createdAt, locale)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActionError(null);
                              setConvertingLead(lead);
                            }}
                          >
                            {t.convertToDeal}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Contacts directory ─────────────────────────────── */}
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab
            initialContacts={initialContacts}
            canManage={canManage}
            platform={platform}
            locale={locale}
          />
        </TabsContent>
      </Tabs>

      {/* Deal Detail Dialog */}
      <DealDetailDialog
        deal={selectedDeal}
        open={selectedDeal !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
        canManage={canManage}
        members={members}
        platform={platform}
        locale={locale}
        onStageChange={handleStageMove}
        onEdit={(deal) => {
          setEditingDeal(deal);
        }}
        onDeleted={handleDealDeleted}
      />

      {/* Dialogs */}
      <DealDialog
        open={createOpen || convertingLead !== null || editingDeal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setConvertingLead(null);
            setEditingDeal(null);
          }
        }}
        lead={convertingLead}
        deal={editingDeal}
        members={members}
        onSaved={handleDealSaved}
        platform={platform}
      />
    </div>
  );
}