"use client";

import React from "react";
import { Maximize2, PhoneOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCallDuration } from "@/app/(dashboard)/telecom/telecom-meta";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { DialerState } from "@/lib/stores/dialer-store";

interface MinimizedDialerPillProps {
  dialer: DialerState & {
    toggleMinimize: () => void;
    endCall: () => void;
    closeDialer: () => void;
  };
  platform: Dictionary["platform"];
}

export function MinimizedDialerPill({ dialer, platform }: MinimizedDialerPillProps) {
  const t = platform.dialer;

  return (
    <aside
      aria-label={t.title}
      className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "size-2.5 rounded-full shrink-0",
            dialer.callStatus === "connected"
              ? "bg-emerald-500 animate-pulse"
              : dialer.callStatus === "calling"
              ? "bg-amber-500 animate-ping"
              : "bg-primary"
          )}
        />
        <div className="flex flex-col min-w-0">
          <span className="truncate text-xs font-semibold text-foreground max-w-[130px]">
            {dialer.contactName || dialer.destinationNumber || t.title}
          </span>
          {dialer.callStatus === "connected" && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatCallDuration(dialer.duration)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 ps-1 border-s border-border/60">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={dialer.toggleMinimize}
          className="size-7 rounded-full text-muted-foreground hover:text-foreground"
          title={t.maximize}
        >
          <Maximize2 className="size-3.5" />
        </Button>
        {dialer.callStatus === "connected" || dialer.callStatus === "calling" ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={dialer.endCall}
            className="size-7 rounded-full bg-rose-600 hover:bg-rose-700"
            title={t.endCall}
          >
            <PhoneOff className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={dialer.closeDialer}
            className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            title={t.close}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </aside>
  );
}
