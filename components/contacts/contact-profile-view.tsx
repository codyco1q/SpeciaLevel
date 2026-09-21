"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MessageSquare,
  FileText,
  PhoneCall,
  Send,
} from "lucide-react";
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
} from "@/lib/actions/contacts";
import { CRM_STAGE_DOT_CLASSES, formatCurrency, formatLeadDate } from "@/app/(dashboard)/crm/crm-meta";
import { INVOICE_STATUS_BADGE_CLASSES } from "@/app/(dashboard)/invoicing/invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { ContactDialog } from "./contact-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";

interface ContactProfileViewProps {
  contact: ContactProfile | null;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ContactProfileView({
  contact: initialContact,
  canManage,
  platform,
  locale,
}: ContactProfileViewProps) {
  const t = platform.crm;
  const contactsT = platform.contacts!;
  const router = useRouter();
  const [profile, setProfile] = useState<ContactProfile | null>(initialContact);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  if (!profile) {
    return (
      <div className="p-8">
        <div className="mb-6 flex">
          <Button type="button" asChild variant="ghost" size="sm">
            <Link href="/contacts">
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

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link
            href="/contacts"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            {contactsT.title}
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/40 rtl:rotate-180" />
          <span className="text-foreground font-medium">{profile.name}</span>
        </nav>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="me-1.5 size-3.5" />
              {contactsT.editContact}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="me-1.5 size-3.5" />
              {contactsT.deleteContact}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        {/* Left Column: Contact Card & Notes */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(profile.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-snug text-foreground">
                  {profile.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[profile.title, profile.company].filter(Boolean).join(" • ")}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  <span>{platform.invoicing.tableClient}</span>
                </dt>
                <dd className="text-end font-medium">
                  <a href={`mailto:${profile.email}`} className="text-foreground hover:underline">
                    {profile.email}
                  </a>
                </dd>
              </div>

              {profile.phone && (
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    <span>{t.contactDialog.phoneLabel}</span>
                  </dt>
                  <dd className="text-end font-medium">
                    <a href={`tel:${profile.phone}`} className="text-foreground hover:underline">
                      {profile.phone}
                    </a>
                  </dd>
                </div>
              )}

              {profile.address && (
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    <span>{t.contactDialog.addressLabel}</span>
                  </dt>
                  <dd className="text-end font-medium text-foreground">{profile.address}</dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  <span>{t.profile.added}</span>
                </dt>
                <dd className="font-medium">{formatLeadDate(profile.createdAt, locale)}</dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  <span>{t.profile.updated}</span>
                </dt>
                <dd className="font-medium">{formatLeadDate(profile.updatedAt, locale)}</dd>
              </div>
            </dl>

            {profile.tags.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Add Note */}
          {canManage && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <span>{t.profile.addNote}</span>
              </h3>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t.profile.notePlaceholder}
                rows={3}
                className="text-xs"
              />
              {actionError && (
                <p role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  {actionError}
                </p>
              )}
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || !noteText.trim()}
                  onClick={handleAddNote}
                >
                  {isPending ? (
                    <LoaderCircle className="me-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Send className="me-1.5 size-3.5" />
                  )}
                  {t.profile.noteSubmit}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: 360 Tabs */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="overview">{t.profile.tabs.overview}</TabsTrigger>
              <TabsTrigger value="deals">{t.profile.tabs.deals}</TabsTrigger>
              <TabsTrigger value="invoices">{t.profile.tabs.invoices}</TabsTrigger>
              <TabsTrigger value="communications">{t.profile.tabs.communications}</TabsTrigger>
            </TabsList>

            {/* Overview & Timeline */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {profile.deals.length}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.profile.stats.openDeals}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {formatCurrency(
                      profile.invoices.reduce((sum, inv) => sum + inv.total, 0),
                      "USD",
                      locale
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.profile.stats.totalBilled}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {profile.notes.length}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.profile.stats.notesCount.replace("{count}", String(profile.notes.length))}
                  </p>
                </div>
              </div>

              {/* Notes timeline */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t.profile.stats.notesCount.replace("{count}", "")}
                </h4>
                {profile.notes.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs font-medium text-foreground">{t.profile.noNotesYet}</p>
                    <p className="text-[11px] text-muted-foreground">{t.profile.noNotesYetHint}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-border bg-muted/20 p-3.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-muted-foreground text-[11px]">
                          <span className="font-semibold text-foreground">
                            {note.author?.fullName ?? "Team Member"}
                          </span>
                          <span>{formatLeadDate(note.createdAt, locale)}</span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Deals */}
            <TabsContent value="deals" className="mt-6 space-y-3">
              {profile.deals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {t.profile.emptyDeals}
                </p>
              ) : (
                profile.deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/10 p-3 text-xs hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-foreground text-sm">{deal.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", CRM_STAGE_DOT_CLASSES[deal.stage])} />
                        <span className="text-muted-foreground">
                          {t.stages[deal.stage]}
                        </span>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-foreground text-sm">
                        {formatCurrency(deal.value, deal.currency, locale)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatLeadDate(deal.updatedAt, locale)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Invoices */}
            <TabsContent value="invoices" className="mt-6 space-y-3">
              {profile.invoices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {t.profile.emptyInvoices}
                </p>
              ) : (
                profile.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/10 p-3 text-xs hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <span>{inv.invoiceNumber}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] uppercase", INVOICE_STATUS_BADGE_CLASSES[inv.status])}
                        >
                          {inv.status}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {inv.dueDate ? formatLeadDate(inv.dueDate, locale) : "—"}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-foreground text-sm">
                        {formatCurrency(inv.total, inv.currency || "USD", locale)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Communications */}
            <TabsContent value="communications" className="mt-6 space-y-3">
              {profile.communications.calls.length === 0 && profile.communications.sms.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {t.profile.emptyCommunications}
                </p>
              ) : (
                <div className="space-y-3">
                  {profile.communications.calls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/10 p-3 text-xs"
                    >
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <PhoneCall className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground capitalize">
                            {call.direction} Call ({call.status})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatLeadDate(call.createdAt, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{call.summary || `${call.durationSeconds}s duration`}</p>
                      </div>
                    </div>
                  ))}
                  {profile.communications.sms.map((sms) => (
                    <div
                      key={sms.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/10 p-3 text-xs"
                    >
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground capitalize">
                            {sms.direction} SMS ({sms.status})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatLeadDate(sms.createdAt, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{sms.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <ContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone ?? "",
          company: profile.company ?? "",
          title: profile.title ?? "",
          address: profile.address ?? "",
          notes: "",
          tags: profile.tags,
          activeDeals: profile.deals.length,
          totalInvoiced: profile.invoices.reduce((sum, inv) => sum + inv.total, 0),
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }}
        onSaved={async () => {
          setEditOpen(false);
          const updated = await getContactById(profile.id);
          if (updated) setProfile(updated);
          router.refresh();
        }}
        platform={platform}
      />

      <DeleteContactDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        contact={profile}
        onDeleted={() => {
          setDeleteOpen(false);
          router.push("/contacts");
        }}
        platform={platform}
      />
    </div>
  );
}
