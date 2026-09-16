"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Contact, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteContact,
  getContacts,
  type ContactSummaryRow,
} from "@/lib/actions/crm-contacts";
import { formatCurrency, formatLeadDate } from "./crm-meta";
import { ContactDialog } from "./contact-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ContactsTabProps {
  initialContacts: ContactSummaryRow[];
  canManage: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Contacts directory tab: searchable table of every CRM contact with
 * per-row aggregates (open deals, billed total) and quick actions —
 * View profile (link), Edit, Delete. Add/Edit/Delete are only offered
 * to `crm.manage` holders.
 */
export function ContactsTab({
  initialContacts,
  canManage,
  platform,
  locale,
}: ContactsTabProps) {
  const t = platform.crm;
  const [contacts, setContacts] = useState<ContactSummaryRow[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<ContactSummaryRow | null>(null);
  const [deletingContact, setDeletingContact] =
    useState<ContactSummaryRow | null>(null);
  const [isDeleting, startDelete] = useTransition();

  async function refreshContacts() {
    const rows = await getContacts();
    if (rows) setContacts(rows);
  }

  const query = search.trim().toLowerCase();
  const visibleContacts = query
    ? contacts.filter((contact) =>
        [
          contact.name,
          contact.email,
          contact.company ?? "",
          contact.phone ?? "",
          contact.title ?? "",
          ...contact.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : contacts;

  function handleDialogSaved() {
    setDialogOpen(false);
    setEditingContact(null);
    void refreshContacts();
  }

  function handleDeleteConfirm() {
    if (!deletingContact) return;
    setActionError(null);
    startDelete(async () => {
      const result = await deleteContact(deletingContact.id);
      if (result.status === "error") {
        setActionError(result.error ?? t.errors.contactDeleteFailed);
        return;
      }
      setDeletingContact(null);
      void refreshContacts();
    });
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {/* Toolbar: search + add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.contacts.searchPlaceholder}
            className="ps-9"
          />
        </div>
        {canManage && (
          <Button type="button" onClick={() => { setActionError(null); setEditingContact(null); setDialogOpen(true); }}>
            <Plus className="size-4" />
            {t.newContact}
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Contact className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t.contacts.noContactsYet}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage ? t.contacts.noContactsYetHintManage : t.contacts.noContactsYetHintView}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.contacts.colName}</TableHead>
                <TableHead>{t.contacts.colEmail}</TableHead>
                <TableHead>{t.contacts.colPhone}</TableHead>
                <TableHead>{t.contacts.colTags}</TableHead>
                <TableHead className="text-end">{t.contacts.colDeals}</TableHead>
                <TableHead className="text-end">{t.contacts.colInvoiced}</TableHead>
                <TableHead>{t.contacts.colUpdated}</TableHead>
                <TableHead className="text-end">{platform.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[contact.title, contact.company].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {contact.tags.length === 0
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : contact.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">{tag}</Badge>
                          ))}
                      {contact.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{contact.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>

  <TableCell className="text-end tabular-nums">{contact.activeDeals}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {contact.totalInvoiced === null
                      ? "—"
                      : formatCurrency(contact.totalInvoiced, "USD", locale)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatLeadDate(contact.updatedAt, locale)}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/crm/contacts/${contact.id}`}>
                          <Eye className="size-3.5" />
                          {t.contacts.viewProfile}
                        </Link>
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t.contactDialog.editTitle}
                            onClick={() => { setActionError(null); setEditingContact(contact); setDialogOpen(true); }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t.deleteContactDialog.title}
                            onClick={() => { setActionError(null); setDeletingContact(contact); }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visibleContacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t.contacts.noContactsYet}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ContactDialog
        key={`${editingContact?.id ?? "create"}-${dialogOpen ? "open" : "closed"}`}
        open={dialogOpen}
        onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingContact(null); } }}
        contact={editingContact}
        onSaved={handleDialogSaved}
        platform={platform}
      />

      {deletingContact && (
        <DeleteContactDialog
          contact={deletingContact}
          error={actionError}
          isPending={isDeleting}
          onCancel={() => setDeletingContact(null)}
          onConfirm={handleDeleteConfirm}
          platform={platform}
        />
      )}
    </div>
  );
}