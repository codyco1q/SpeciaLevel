"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { NotificationsPopover } from "@/components/notifications-popover";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  platform: Dictionary["platform"];
  locale: Locale;
  permissions: string[];
  organizationName?: string;
  userFullName?: string;
  userEmail?: string;
}

export function DashboardHeader({
  platform,
  locale,
  organizationName,
}: DashboardHeaderProps) {
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
    }
  }, []);

  const handleOpenPalette = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-command-palette"));
    }
  };

  const t = platform.commandPalette;
  const shortcutLabel = isMac ? t.shortcutMac : t.shortcutWin;

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-card/75 px-4 backdrop-blur-md sm:px-6 print:hidden">
      {/* ── Search / Command Palette Trigger ────────────────────────── */}
      <div className="flex flex-1 items-center max-w-md">
        <button
          type="button"
          onClick={handleOpenPalette}
          className={cn(
            "group flex h-9 w-full max-w-sm sm:max-w-md items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 text-xs text-muted-foreground transition-all duration-150",
            "hover:border-primary/40 hover:bg-muted/70 hover:text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/40"
          )}
          aria-label={t.triggerPlaceholder}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="truncate">{t.triggerPlaceholder}</span>
          </div>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-2xs">
            {shortcutLabel}
          </kbd>
        </button>
      </div>

      {/* ── Header Right: Notifications & Organization Context ──────── */}
      <div className="flex items-center gap-3">
        <NotificationsPopover platform={platform} locale={locale} />

        {organizationName && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-medium border-s border-border/60 ps-3">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            <span className="truncate max-w-[200px]">{organizationName}</span>
          </div>
        )}
      </div>
    </header>
  );
}

