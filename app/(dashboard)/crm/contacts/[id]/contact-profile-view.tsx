"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getContactById,
  addContactNote,
  type ContactProfile,
} from "@/lib/actions/crm-contacts";
import {
  CRM_STAGE_DOT_CLASSES,
  formatCurrency,
  formatLeadDate,
} from "../../crm-meta";
import { INVOICE_STATUS_BADGE_CLASSES } from "../../../invoicing/invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ContactProfileViewProps {
  contact: ContactProfile | null;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Client-side profile view for /crm/contacts/[id]. The data arrives
 * server-side via `getContactById()` (RLS-enforced) and is held in
 * local state so note additions update the view without a full-page
 * navigation.
 */
export function ContactProfileView({
  contact: initialContact,
  canManage,
  platform,
  locale,
}: ContactProfileViewProps) {
  const t = platform.crm;
  const router = useRouter();
  const [profile, setProfile] = useState<ContactProfile | null>(initialContact);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAddNote() {
    if (!profile || !noteText.trim()) return;
    setActionError(null);
    startTransition(async () => {
      const result = await addContactNote(profile.id, noteText.trim());
      if (result.status === "error") {
        setActionError(result.error ?? null);
        return;
      }
      setNoteText("");
      const updated = await getContactById(profile.id);
      if (updated) setProfile(updated);
      router.refresh();
    });
  }

  /* ── Not found / no access ────────────────────────────────────── */
  if (!profile) {
    return (
      <div className="p-8">
        <div className="mb-6 flex">
          <Button type="button" asChild variant="ghost" size="sm">
            <Link href="/crm?tab=contacts">
              <ChevronLeft className="size-4 rtl:rotate-180" />
              {t.profile.back}
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium">{t.contacts.notFoundTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.contacts.notFoundBody}
          </p>
        </div>
      </div>
    );
  }

  /* ── Breadcrumbs + header ────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {t.title}
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/40" />
        <Link
          href="/crm?tab=contacts"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.profile.contactsCrumb}
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/40" />
        <span className="text-foreground">{profile.name}</span>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        {/* ── Left column: contact card + note composer ──────── */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6">
            {/* Avatar + name + title */}
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(profile.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-snug">
                  {profile.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[profile.title, profile.company].filter(Boolean).join(" at ")}
                </p>
              </div>
            </div>

            {/* Meta grid */}
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  {platform.invoicing.tableClient}
                </dt>
                <dd className="text-end">
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {profile.email}
                  </a>
                </dd>
              </div>
              {profile.phone && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {t.contactDialog.phoneLabel}
                  </dt>
                  <dd className="text-end">
                    <a
                      href={`tel:${profile.phone}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {profile.phone}
                    </a>
                  </dd>
                </div>
              )}
              {profile.address && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {t.contactDialog.addressLabel}
                  </dt>
                  <dd className="text-end">{profile.address}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t.profile.added}</dt>
                <dd>{formatLeadDate(profile.createdAt, locale)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t.profile.updated}</dt>
                <dd>{formatLeadDate(profile.updatedAt, locale)}</dd>
              </div>
            </dl>

            {profile.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Add Note composer */}
          {canManage && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-medium">{t.profile.addNote}</h3>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t.profile.notePlaceholder}
                rows={3}
              />
              {actionError && (
                <p
                  role="alert"
                  className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
                >
                  {actionError}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={isPending || !noteText.trim()}
                onClick={handleAddNote}
              >
                {isPending && <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />}
                {t.profile.noteSubmit}
              </Button>
            </div>
          )}
        </div>

        {/* ── Right column: tabs ──────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">{t.profile.tabs.overview}</TabsTrigger>
              <TabsTrigger value="deals">{t.profile.tabs.deals}</TabsTrigger>
              <TabsTrigger value="invoices">{t.profile.tabs.invoices}</TabsTrigger>
              <TabsTrigger value="communications">{t.profile.tabs.communications}</TabsTrigger>
            </TabsList>

            {/* ── Overview & Notes ──────────────────────────────────── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">
                    {profile.deals.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.profile.stats.openDeals}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(
                      profile.invoices.reduce((sum, inv) => sum + inv.total, 0),
                      "USD",
                      locale
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.profile.stats.totalBilled}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">
                    {profile.notes.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.profile.stats.notesCount.replace("{count}", String(profile.notes.length))}
                  </p>
                </div>
              </div>

              {/* Notes timeline */}
              {profile.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.profile.noNotesYet}</p>
              ) : (
                <div className="space-y-3">
                  {profile.notes.map((note) => (
                    <div key={note.id} className="flex gap-3 rounded-lg border border-border p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {note.author?.fullName ? getInitials(note.author.fullName) : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLeadDate(note.createdAt, locale)} · {note.author?.fullName ?? note.author?.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Deals ────────────────────────────────────────────── */}
            <TabsContent value="deals" className="mt-4">
              {profile.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.profile.emptyDeals}</p>
              ) : (
                <div className="space-y-2">
                  {profile.deals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{deal.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full", CRM_STAGE_DOT_CLASSES[deal.stage])} />
                          <span className="text-xs text-muted-foreground">
                            {t.stages[deal.stage]}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(deal.value, deal.currency, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

              {/* ── Invoices ──────────────────────────────────────────── */}
            <TabsContent value="invoices" className="mt-4">
              {profile.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.profile.emptyInvoices}</p>
              ) : (
                <div className="space-y-2">
                  {profile.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", INVOICE_STATUS_BADGE_CLASSES[invoice.status])}>
                            {platform.invoicing.statuses[invoice.status]}
                          </Badge>
                          {invoice.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              Due {formatLeadDate(invoice.dueDate, locale)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-end">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(invoice.total, invoice.currency, locale)}
                        </p>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={`/invoicing/${invoice.id}`}>
                            {t.profile.viewInvoice}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Communications ───────────────────────────────────── */}
            <TabsContent value="communications" className="mt-4 space-y-6">
              {profile.communications.calls.length === 0 && profile.communications.sms.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.profile.emptyCommunications}</p>
              ) : (
                <>
                  {profile.communications.calls.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">{t.profile.communicationsCalls}</h4>
                      <div className="space-y-2">
                        {profile.communications.calls.map((call) => (
                          <div key={call.id} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {platform.telecom.directions[call.direction as keyof typeof platform.telecom.directions]}
                              </Badge>
                              <span className="text-muted-foreground">
                                {call.fromNumber} → {call.toNumber}
                              </span>
                              <span className="text-muted-foreground">
                                {platform.telecom.callStatuses[call.status as keyof typeof platform.telecom.callStatuses]}
                              </span>
                              <span className="ms-auto text-xs text-muted-foreground">
                                {call.durationSeconds}s
                              </span>
                            </div>
                            {call.summary && (
                              <p className="mt-1 text-xs text-muted-foreground">{call.summary}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.communications.sms.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">{t.profile.communicationsSms}</h4>
                      <div className="space-y-2">
                        {profile.communications.sms.map((sms) => (
                          <div key={sms.id} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {platform.telecom.directions[sms.direction as keyof typeof platform.telecom.directions]}
                              </Badge>
                              <span className="text-muted-foreground">
                                {sms.fromNumber} → {sms.toNumber}
                              </span>
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {platform.telecom.smsStatuses[sms.status as keyof typeof platform.telecom.smsStatuses]}
                              </Badge>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{sms.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}