"use client";

import { Badge } from "@/components/ui/badge";
import { Compass } from "lucide-react";

interface Props {
  utms: Record<string, string>;
  isArabic: boolean;
}

export function SubmissionTrackingCard({ utms, isArabic }: Props) {
  const hasUtms = Object.keys(utms).length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Compass className="size-4 text-primary" />
          <span>{isArabic ? "مصدر العميل وتتبع الروابط (UTM)" : "Lead Origin & URL Tracking"}</span>
        </div>
        {hasUtms ? (
          <Badge variant="default" className="text-[10px] bg-blue-600/90 text-white">
            {utms.utm_source ? `Source: ${utms.utm_source}` : "Tracked Campaign"}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
            {isArabic ? "زيارة مباشرة / غير متتبع" : "Direct / Organic Visit"}
          </Badge>
        )}
      </div>

      {hasUtms ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(utms).map(([k, v]) => (
            <div key={k} className="p-2 rounded-lg bg-muted/40 border border-border/60">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">{k}</p>
              <p className="font-semibold text-foreground mt-0.5 break-all">{v}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          {isArabic
            ? "لم يتم العثور على معلمات تتبع في رابط الإرسال (زيارة مباشرة)."
            : "No URL tracking parameters detected (direct lead capture)."}
        </p>
      )}
    </div>
  );
}
