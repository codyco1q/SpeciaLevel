"use client";

import * as React from "react";
import { Cpu, Server, Sparkles, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiModelProviderType } from "@/lib/validations/ai-providers";

interface AiProviderIconProps {
  provider: AiModelProviderType | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AiProviderIcon({
  provider,
  className,
  size = "md",
}: AiProviderIconProps) {
  const sizeClasses = {
    sm: "size-8 text-xs p-1.5",
    md: "size-10 text-sm p-2",
    lg: "size-12 text-base p-2.5",
  }[size];

  switch (provider) {
    case "openai":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold shadow-sm",
            sizeClasses,
            className
          )}
        >
          <svg className="size-full fill-current" viewBox="0 0 24 24">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 13.682l-2.02-1.163a.08.08 0 0 1-.038-.057V6.879a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.698 6.265a.79.79 0 0 0-.391.681zm1.107-2.385l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
          </svg>
        </div>
      );

    case "anthropic":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-[#D97706]/10 text-[#D97706] dark:text-[#FBBF24] border border-[#D97706]/20 font-black",
            sizeClasses,
            className
          )}
        >
          <span className="font-serif text-lg tracking-tight">A</span>
        </div>
      );

    case "gemini":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <Sparkles className="size-full" />
        </div>
      );

    case "openrouter":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <Cpu className="size-full" />
        </div>
      );

    case "custom_openai":
    default:
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 font-bold",
            sizeClasses,
            className
          )}
        >
          <Terminal className="size-full" />
        </div>
      );
  }
}
