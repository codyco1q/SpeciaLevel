import { cn } from "@/lib/utils";

/**
 * The SpeciaLevel "SL" monogram mark — a clean, geometric gradient badge
 * used across the marketing site (navbar, footer) as the brand logo.
 */
export function Monogram({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 select-none items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-sm font-bold tracking-tight text-white shadow-lg shadow-indigo-500/30",
        className
      )}
    >
      SL
    </span>
  );
}