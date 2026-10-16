"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ShieldAlert, LogOut, Loader2, UserCheck } from "lucide-react";
import { Monogram } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/lib/actions/admin-auth";

interface AdminNavbarProps {
  username: string;
}

export function AdminNavbar({ username }: AdminNavbarProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await adminLogoutAction();
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <Monogram className="size-8 rounded-lg text-xs" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  SpeciaLevel Admin
                </span>
                <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-600 bg-amber-500/10 px-1.5 py-0">
                  PLATFORM CORE
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                Multi-Tenant Governance Console
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs text-muted-foreground border border-border/60">
            <UserCheck className="size-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono text-[11px] text-foreground font-medium">
              {username}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isPending}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 gap-1.5 shadow-2xs"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
