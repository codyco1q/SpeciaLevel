"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  Inbox,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Share2,
  LoaderCircle,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBuilderDialog } from "./form-builder-dialog";
import { SubmissionsDialog } from "./submissions-drawer";
import { deleteForm, toggleFormPublished } from "@/lib/actions/forms";
import type { FormRow } from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import Link from "next/link";

interface FormsViewProps {
  initialForms: FormRow[];
  canManage: boolean;
  dictionary: Dictionary["platform"]["forms"];
  locale: Locale;
}

export function FormsView({
  initialForms,
  canManage,
  dictionary,
  locale,
}: FormsViewProps) {
  const [forms, setForms] = useState<FormRow[]>(initialForms);
  const [searchQuery, setSearchQuery] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormRow | null>(null);
  const [builderTab, setBuilderTab] = useState<"fields" | "settings" | "share">("fields");
  const [submissionsForm, setSubmissionsForm] = useState<FormRow | null>(null);
  const [deletingForm, setDeletingForm] = useState<FormRow | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = dictionary;

  const filteredForms = forms.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalForms = forms.length;
  const activeForms = forms.filter((f) => f.isPublished).length;
  const totalSubmissions = forms.reduce((acc, f) => acc + f.submissionsCount, 0);

  const handleCreateNew = () => {
    setEditingForm(null);
    setBuilderTab("fields");
    setBuilderOpen(true);
  };

  const handleEdit = (form: FormRow, tab: "fields" | "settings" | "share" = "fields") => {
    setEditingForm(form);
    setBuilderTab(tab);
    setBuilderOpen(true);
  };

  const handleTogglePublished = (form: FormRow, isPublished: boolean) => {
    startTransition(async () => {
      const res = await toggleFormPublished(form.id, isPublished, locale);
      if (res.status === "success") {
        setForms((prev) =>
          prev.map((f) => (f.id === form.id ? { ...f, isPublished } : f))
        );
      }
    });
  };

  const handleDelete = () => {
    if (!deletingForm) return;
    const targetId = deletingForm.id;
    startTransition(async () => {
      const res = await deleteForm(targetId, locale);
      if (res.status === "success") {
        setForms((prev) => prev.filter((f) => f.id !== targetId));
        setDeletingForm(null);
      }
    });
  };

  const handleCopyLink = (slug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/f/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <Button onClick={handleCreateNew} className="gap-1.5">
            <Plus className="size-4" />
            {t.newForm}
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.metrics.totalForms}
            </p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalForms}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t.metrics.totalFormsHint.replace("{count}", String(totalForms))}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.metrics.activeForms}
            </p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{activeForms}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t.metrics.activeFormsHint.replace("{count}", String(activeForms))}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.metrics.totalSubmissions}
            </p>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalSubmissions}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t.metrics.totalSubmissionsHint}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>
      </div>

      {/* Forms Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <FileSpreadsheet className="size-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold">{t.table.noFormsYet}</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {canManage ? t.table.noFormsYetHintManage : t.table.noFormsYetHintView}
            </p>
            {canManage && (
              <Button size="sm" onClick={handleCreateNew}>
                <Plus className="size-4 mr-1 rtl:mr-0 rtl:ml-1" />
                {t.newForm}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">{t.table.title}</TableHead>
                  <TableHead className="min-w-[180px]">{t.table.slug}</TableHead>
                  <TableHead className="text-center">{t.table.submissions}</TableHead>
                  <TableHead className="text-center">{t.table.status}</TableHead>
                  <TableHead>{t.table.created}</TableHead>
                  <TableHead className="text-end">{t.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>

                {filteredForms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {form.title}
                        </p>
                        {form.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {form.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          /f/{form.slug}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => handleCopyLink(form.slug)}
                          title="Copy Link"
                        >
                          {copiedSlug === form.slug ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          asChild
                          title="Open public form"
                        >
                          <Link href={`/f/${form.slug}`} target="_blank">
                            <ExternalLink className="size-3 text-muted-foreground" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSubmissionsForm(form)}
                        className="h-7 gap-1 font-semibold text-xs"
                      >
                        <Inbox className="size-3.5" />
                        <span>{form.submissionsCount}</span>
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      {canManage ? (
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={form.isPublished}
                            onCheckedChange={(checked) =>
                              handleTogglePublished(form, checked)
                            }
                            disabled={isPending}
                          />
                          <span className="text-xs text-muted-foreground">
                            {form.isPublished ? t.table.published : t.table.draft}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant={form.isPublished ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {form.isPublished ? t.table.published : t.table.draft}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(form.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-SA" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(form, "share")}
                          className="h-8 gap-1 text-xs"
                          title={t.table.share}
                        >
                          <Share2 className="size-3.5" />
                          <span className="hidden sm:inline">{t.table.share}</span>
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleEdit(form, "fields")}
                              title={t.table.edit}
                            >
                              <Edit2 className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingForm(form)}
                              title={t.table.delete}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Builder Dialog */}
      <FormBuilderDialog
        form={editingForm}
        open={builderOpen}
        initialTab={builderTab}
        onOpenChange={setBuilderOpen}
        onSaved={(saved: FormRow) => {
          setForms((prev) => {
            const index = prev.findIndex((f) => f.id === saved.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = saved;
              return updated;
            }
            return [saved, ...prev];
          });
        }}
        dictionary={t}
        locale={locale}
      />

      {/* Submissions Dialog */}
      <SubmissionsDialog
        form={submissionsForm}
        open={!!submissionsForm}
        onOpenChange={(open: boolean) => !open && setSubmissionsForm(null)}
        dictionary={t}
        locale={locale}
      />

      {/* Delete Confirmation Alert */}
      <Dialog
        open={!!deletingForm}
        onOpenChange={(open: boolean) => !open && setDeletingForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.builder.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.builder.deleteConfirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingForm(null)}
              disabled={isPending}
            >
              {t.builder.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin mr-1 rtl:mr-0 rtl:ml-1" />
              ) : null}
              {t.builder.confirmDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

