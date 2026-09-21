"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Contact,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Download,
  Users,
  Briefcase,
  DollarSign,
  MoreHorizontal,
  X,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContactDialog } from "./contact-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";
import { ImportContactsDialog } from "./import-contacts-dialog";
import { getContacts, type ContactSummaryRow } from "@/lib/actions/contacts";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface ContactsViewProps {
  initialContacts: ContactSummaryRow[];
  initialTags: string[];
  canManage: boolean;
  platform: Dictionary["platform"];
  lang: Locale;
}

export function ContactsView({
  initialContacts,
  initialTags,
  canManage,
  platform,
  lang,
}: ContactsViewProps) {
  const router = useRouter();
  const t = platform.contacts!;

  const [contacts, setContacts] = useState<ContactSummaryRow[]>(initialContacts);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactSummaryRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactSummaryRow | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const searchParams = useSearchParams();
  const urlNew = searchParams.get("new");

  useEffect(() => {
    if (urlNew === "true" || urlNew === "1") {
      setSelectedContact(null);
      setContactDialogOpen(true);
    }
  }, [urlNew]);

  const refreshContacts = () => {
    startTransition(async () => {
      const data = (await getContacts()) ?? [];
      setContacts(data);
      const uniqueTags = Array.from(new Set(data.flatMap((c) => c.tags))).sort();
      setTags(uniqueTags);
      router.refresh();
    });
  };

  const handleOpenCreate = () => {
    setSelectedContact(null);
    setContactDialogOpen(true);
  };

  const handleOpenEdit = (c: ContactSummaryRow) => {
    setSelectedContact(c);
    setContactDialogOpen(true);
  };

  const handleOpenDelete = (c: ContactSummaryRow) => {
    setContactToDelete(c);
    setDeleteDialogOpen(true);
  };

  const handleExportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Company", "Title", "Address", "Tags", "Notes"];
    const rows = filteredContacts.map((c) => [
      c.name,
      c.email,
      c.phone || "",
      c.company || "",
      c.title || "",
      c.address || "",
      c.tags.join("; "),
      c.notes || "",
    ]);
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csvContent = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredContacts = contacts.filter((c) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.company && c.company.toLowerCase().includes(query)) ||
      (c.title && c.title.toLowerCase().includes(query)) ||
      c.tags.some((tg) => tg.toLowerCase().includes(query));

    const matchesTag = !selectedTag || c.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const totalContactsCount = contacts.length;
  const totalDealsCount = contacts.reduce((sum, c) => sum + (c.activeDeals || 0), 0);
  const totalInvoicedSum = contacts.reduce((sum, c) => sum + (c.totalInvoiced || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="me-1.5 size-4" />
                {t.importCsv}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredContacts.length === 0}
              >
                <Download className="me-1.5 size-4" />
                {t.exportCsv}
              </Button>
              <Button type="button" size="sm" onClick={handleOpenCreate}>
                <Plus className="me-1.5 size-4" />
                {t.addContact}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.totalContacts}</p>
            <p className="text-xl font-bold text-foreground">{totalContactsCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Briefcase className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.activeDeals}</p>
            <p className="text-xl font-bold text-foreground">{totalDealsCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.billedTotal}</p>
            <p className="text-xl font-bold text-foreground">
              {new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(totalInvoicedSum)}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Tag Filtering Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="ps-9"
          />
        </div>

        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <Tag className="size-3.5 text-muted-foreground shrink-0 ms-1" />
            <Button
              type="button"
              variant={selectedTag === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="text-xs h-7 px-2.5"
            >
              {t.allTags}
            </Button>
            {tags.map((tg) => {
              const isSelected = selectedTag === tg;
              const count = contacts.filter((c) => c.tags.includes(tg)).length;
              return (
                <Button
                  key={tg}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTag(isSelected ? null : tg)}
                  className="text-xs h-7 px-2.5 shrink-0 gap-1"
                >
                  <span>{tg}</span>
                  <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    ({count})
                  </span>
                </Button>
              );
            })}
            {selectedTag && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTag(null)}
                className="text-xs h-7 px-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <Contact className="size-6" />
            </div>
            {contacts.length === 0 ? (
              <>
                <h3 className="text-base font-semibold text-foreground">{t.noContactsYet}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {canManage ? t.noContactsYetHintManage : t.noContactsYetHintView}
                </p>
                {canManage && (
                  <div className="flex items-center gap-2 mt-4">
                    <Button size="sm" onClick={handleOpenCreate}>
                      <Plus className="me-1.5 size-4" />
                      {t.addContact}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                      <Upload className="me-1.5 size-4" />
                      {t.importCsv}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground">{t.noContactsFound}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">{t.noContactsFoundHint}</p>
                {(search || selectedTag) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearch("");
                      setSelectedTag(null);
                    }}
                  >
                    {t.clearFilter}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-3 text-start font-medium">{t.table.name}</th>
                  <th className="p-3 text-start font-medium">{t.table.email}</th>
                  <th className="p-3 text-start font-medium">{t.table.phone}</th>
                  <th className="p-3 text-start font-medium">{t.table.company}</th>
                  <th className="p-3 text-start font-medium">{t.table.tags}</th>
                  <th className="p-3 text-start font-medium">{t.table.deals}</th>
                  <th className="p-3 text-start font-medium">{t.table.invoiced}</th>
                  <th className="p-3 text-start font-medium">{t.table.updated}</th>
                  <th className="p-3 text-end font-medium">{t.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/contacts/${c.id}`}
                            className="font-semibold text-foreground hover:underline truncate block text-sm"
                          >
                            {c.name}
                          </Link>
                          {c.title && <span className="text-[11px] text-muted-foreground block truncate">{c.title}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground truncate max-w-[180px]">
                      <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                    </td>
                    <td className="p-3 text-muted-foreground truncate">
                      {c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground truncate max-w-[150px]">{c.company || "—"}</td>
                    <td className="p-3">
                      {c.tags.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {c.tags.slice(0, 2).map((tg) => (
                            <Badge key={tg} variant="outline" className="px-1.5 py-0 text-[10px]">
                              {tg}
                            </Badge>
                          ))}
                          {c.tags.length > 2 && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              +{c.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {c.activeDeals > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">{c.activeDeals}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(c.totalInvoiced ?? 0)}
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px] whitespace-nowrap">
                      {new Date(c.updatedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/contacts/${c.id}`} className="flex items-center gap-2">
                              <Eye className="size-4" />
                              <span>{t.viewProfile}</span>
                            </Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem onClick={() => handleOpenEdit(c)} className="flex items-center gap-2">
                                <Pencil className="size-4" />
                                <span>{t.editContact}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenDelete(c)} className="text-destructive flex items-center gap-2">
                                <Trash2 className="size-4" />
                                <span>{t.deleteContact}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={selectedContact}
        onSaved={() => {
          setContactDialogOpen(false);
          refreshContacts();
        }}
        platform={platform}
      />

      <DeleteContactDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        contact={contactToDelete}
        onDeleted={() => {
          setDeleteDialogOpen(false);
          refreshContacts();
        }}
        platform={platform}
      />

      <ImportContactsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportCompleted={() => {
          refreshContacts();
        }}
        platform={platform}
      />
    </div>
  );
}
