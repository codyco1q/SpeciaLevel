"use client";

import * as React from "react";
import Link from "next/link";
import { Search, PhoneCall, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsPopover } from "@/components/notifications-popover";
import { openGlobalDialer } from "@/lib/stores/dialer-store";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  platform: Dictionary["platform"];
  locale: Locale;
  permissions?: string[];
  organizationName?: string;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  userFullName?: string;
  userEmail?: string;
}

export function DashboardHeader({
  platform,
  locale,
  permissions,
  organizationName,
  logoUrl,
  avatarUrl,
  userFullName,
  userEmail,
}: DashboardHeaderProps) {
  const [isMac, setIsMac] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

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

  const handleOpenDialer = () => {
    openGlobalDialer();
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      // 1. Terminate server session, auto-clockout, and clear cookies
      await fetch("/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Server signout error:", err);
    }

    try {
      // 2. Clear browser supabase auth session
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Browser client signout error:", err);
    }

    // 3. Clear session storage and hard redirect to /login
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const t = platform.commandPalette;
  const tSidebar = platform.sidebar;
  const shortcutLabel = isMac ? t.shortcutMac : t.shortcutWin;
  const initial = (userFullName || userEmail || "U").charAt(0).toUpperCase();

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

      {/* ── Header Right: Phone Dialer, Notifications & Profile Avatar ── */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleOpenDialer}
          className="relative size-9 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={platform.dialer.openDialer}
          aria-label={platform.dialer.openDialer}
        >
          <PhoneCall className="size-4" />
        </Button>

        <NotificationsPopover platform={platform} locale={locale} />

        {/* ── Profile Dropdown ────────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-8 rounded-full border border-border/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={userFullName || userEmail || "User profile"}
            >
              {avatarUrl ? (
                <div className="relative flex size-8 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={userFullName || "Avatar"}
                    className="size-full aspect-square object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                  {initial}
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">
                  {userFullName || tSidebar.user || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/settings?tab=profile"
                className="flex w-full items-center gap-2 cursor-pointer"
              >
                <User className="size-4" />
                <span>
                  {locale === "ar"
                    ? "إعدادات الملف الشخصي"
                    : "Profile Settings"}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              disabled={isSigningOut}
              onSelect={(e) => {
                e.preventDefault();
                handleSignOut();
              }}
            >
              <LogOut className="size-4 rtl:rotate-180" />
              <span>
                {isSigningOut
                  ? locale === "ar"
                    ? "جارٍ تسجيل الخروج…"
                    : "Signing out…"
                  : tSidebar.logout || "Sign out"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}


