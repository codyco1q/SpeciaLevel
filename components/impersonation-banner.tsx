"use client";

import { useTransition } from "react";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopTenantImpersonation } from "@/lib/actions/super-admin";

interface ImpersonationBannerProps {
  orgName?: string;
}

export function ImpersonationBanner({ orgName }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  const handleExit = () => {
    startTransition(async () => {
      await stopTenantImpersonation();
      window.location.href = "/super-admin";
    });
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 shrink-0 shadow-sm z-50 border-b border-amber-600/30">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0 fill-current" />
        <span>
          <strong>Support Mode:</strong> You are actively viewing workspace{" "}
          <strong>&quot;{orgName || "Organization"}&quot;</strong> as Super Admin.
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleExit}
        className="h-6 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white border-amber-700 gap-1.5 shrink-0"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
        <span>Exit Support Mode</span>
      </Button>
    </div>
  );
}
