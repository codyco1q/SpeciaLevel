"use client";

import * as React from "react";
import {
  CreditCard,
  MessageSquare,
  PhoneCall,
  Zap,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderIconProps {
  provider: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProviderIcon({
  provider,
  className,
  size = "md",
}: ProviderIconProps) {
  const sizeClasses = {
    sm: "size-8 text-xs p-1.5",
    md: "size-11 text-sm p-2.5",
    lg: "size-14 text-base p-3.5",
  }[size];

  switch (provider) {
    case "stripe":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#635BFF]/10 text-[#635BFF] border border-[#635BFF]/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <span className="font-extrabold tracking-tight">S</span>
        </div>
      );

    case "paypal":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#003087]/10 text-[#0079C1] border border-[#0079C1]/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <span className="font-black italic tracking-tighter">P</span>
        </div>
      );

    case "paymob":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#283891]/10 text-[#283891] dark:text-[#5B71E6] border border-[#283891]/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <span className="font-black tracking-wider">PM</span>
        </div>
      );

    case "paytabs":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#009FD6]/10 text-[#009FD6] border border-[#009FD6]/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <span className="font-bold tracking-tight">PT</span>
        </div>
      );

    case "fawry":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#FDB913]/15 text-[#D97706] border border-[#FDB913]/30 font-bold",
            sizeClasses,
            className
          )}
        >
          <span className="font-black">F</span>
        </div>
      );

    case "whatsapp":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/25",
            sizeClasses,
            className
          )}
        >
          <MessageSquare className="size-full fill-current/20" />
        </div>
      );

    case "meta_messenger":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#0084FF]/10 text-[#0084FF] border border-[#0084FF]/25",
            sizeClasses,
            className
          )}
        >
          <Zap className="size-full fill-current" />
        </div>
      );

    case "instagram":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#E1306C]/10 text-[#E1306C] border border-[#E1306C]/25",
            sizeClasses,
            className
          )}
        >
          <svg
            className="size-full"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        </div>
      );

    default:
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20",
            sizeClasses,
            className
          )}
        >
          <CreditCard className="size-full" />
        </div>
      );
  }
}
