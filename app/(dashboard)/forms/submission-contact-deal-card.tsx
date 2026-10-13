"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Phone,
  Building,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { FormSubmissionRow } from "@/lib/validations/forms";

interface Props {
  submission: FormSubmissionRow;
  isArabic: boolean;
}

export function SubmissionContactDealCard({ submission, isArabic }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Contact Card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <User className="size-3.5 text-primary" />
            {isArabic ? "جهة الاتصال" : "Contact Information"}
          </span>
          {submission.contact?.id && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-primary" asChild>
              <Link href={`/contacts/${submission.contact.id}`}>
                <ExternalLink className="size-3 mr-1 rtl:mr-0 rtl:ml-1" />
                CRM
              </Link>
            </Button>
          )}
        </div>
        {submission.contact ? (
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground text-sm">{submission.contact.name}</p>
            {submission.contact.email && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="size-3" />
                <span>{submission.contact.email}</span>
              </div>
            )}
            {submission.contact.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3" />
                <span dir="ltr">{submission.contact.phone}</span>
              </div>
            )}
            {submission.contact.company && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building className="size-3" />
                <span>{submission.contact.company}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {isArabic ? "غير مرتبط بجهة اتصال" : "Unlinked contact"}
          </p>
        )}
      </div>

      {/* Deal Card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <DollarSign className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {isArabic ? "الصفقة المرتبطة" : "Associated Deal"}
          </span>
          {submission.deal?.id && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-primary" asChild>
              <Link href="/crm">
                <ExternalLink className="size-3 mr-1 rtl:mr-0 rtl:ml-1" />
                CRM
              </Link>
            </Button>
          )}
        </div>
        {submission.deal ? (
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground text-sm">{submission.deal.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="capitalize text-[10px]">
                {submission.deal.stage}
              </Badge>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                ${submission.deal.value.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {isArabic ? "لا توجد صفقة مرتبطة" : "No pipeline deal associated"}
          </p>
        )}
      </div>
    </div>
  );
}
