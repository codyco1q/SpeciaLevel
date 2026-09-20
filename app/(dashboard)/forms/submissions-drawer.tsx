"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  LoaderCircle,
  Inbox,
  User,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { getFormSubmissions } from "@/lib/actions/forms";
import type { FormRow, FormSubmissionRow } from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface SubmissionsDialogProps {
  form: FormRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary["platform"]["forms"];
  locale: Locale;
}

export function SubmissionsDialog({
  form,
  open,
  onOpenChange,
  dictionary,
  locale,
}: SubmissionsDialogProps) {
  const [submissions, setSubmissions] = useState<FormSubmissionRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const t = dictionary.submissions;

  useEffect(() => {
    if (open && form) {
      startTransition(async () => {
        const data = await getFormSubmissions(form.id);
        setSubmissions(data ?? []);
      });
    }
  }, [open, form]);

  const handleExportCsv = () => {
    if (!form || submissions.length === 0) return;

    const fieldHeaders = form.fields.map((f) => f.label);
    const headers = [
      "Submitted At",
      ...fieldHeaders,
      "Contact Name",
      "Contact Email",
      "Deal Title",
      "Deal Value",
    ];

    const rows = submissions.map((sub) => {
      const fieldValues = form.fields.map((f) => {
        const val = sub.data[f.id] ?? sub.data[f.label] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });

      return [
        `"${new Date(sub.createdAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}"`,
        ...fieldValues,
        `"${sub.contact?.name ?? ""}"`,
        `"${sub.contact?.email ?? ""}"`,
        `"${sub.deal?.title ?? ""}"`,
        `"${sub.deal?.value ?? ""}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${form.slug}-submissions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6 rtl:pr-0 rtl:pl-6">
            <div>
              <DialogTitle className="text-xl font-bold">
                {t.title.replace("{title}", form?.title ?? "")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {t.subtitle.replace("{count}", String(submissions.length))}
              </DialogDescription>
            </div>
            {submissions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
              >
                <Download className="size-4" />
                {t.exportCsv}
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {isPending ? (
            <div className="flex h-48 items-center justify-center">
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
              <Inbox className="size-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-semibold">{t.noSubmissions}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {t.noSubmissionsHint}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">{t.submittedAt}</TableHead>
                    <TableHead>{t.submissionData}</TableHead>
                    <TableHead className="w-[180px]">{t.contactLinked}</TableHead>
                    <TableHead className="w-[180px]">{t.dealLinked}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {new Date(sub.createdAt).toLocaleString(
                          locale === "ar" ? "ar-SA" : "en-US",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1.5 text-xs">
                          {Object.entries(sub.data).map(([key, val]) => {
                            const field = form?.fields.find(
                              (f) => f.id === key || f.label === key
                            );
                            const label = field?.label || key;
                            return (
                              <div key={key} className="flex items-baseline gap-2">
                                <span className="font-medium text-muted-foreground min-w-[80px]">
                                  {label}:
                                </span>
                                <span className="font-medium text-foreground">
                                  {String(val || "—")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {sub.contact ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <User className="size-3 text-muted-foreground" />
                              <span>{sub.contact.name}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {sub.contact.email}
                            </p>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-[11px]"
                              asChild
                            >
                              <Link href="/crm">
                                {t.viewContact}
                                <ExternalLink className="size-2.5 ml-1 rtl:rotate-180" />
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {sub.deal ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <Briefcase className="size-3 text-muted-foreground" />
                              <span>{sub.deal.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {sub.deal.stage}
                              </Badge>
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                ${sub.deal.value.toLocaleString()}
                              </span>
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-[11px]"
                              asChild
                            >
                              <Link href="/crm">
                                {t.viewDeal}
                                <ExternalLink className="size-2.5 ml-1 rtl:rotate-180" />
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

