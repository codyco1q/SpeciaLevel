"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleLabels {
  toggle: string;
  light: string;
  dark: string;
  system: string;
}

interface ThemeToggleProps {
  /** Localized labels; falls back to English when not provided. */
  labels?: ThemeToggleLabels;
  /** Matches the surrounding chrome (marketing nav uses `ghost`). */
  variant?: "ghost" | "outline";
  className?: string;
  "aria-label"?: string;
}

/**
 * shadcn-style Light / Dark / System switcher. The button shows the sun in
 * light mode and the moon in dark mode; the dropdown exposes the three
 * next-themes options. RTL-safe out of the box — the Radix menu aligns to
 * the inline edge and the icons are non-directional.
 */
export function ThemeToggle({
  labels,
  variant = "outline",
  className,
  "aria-label": ariaLabel,
}: ThemeToggleProps) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          aria-label={ariaLabel ?? labels?.toggle ?? "Toggle theme"}
          className={cn("relative shrink-0", className)}
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun />
          {labels?.light ?? "Light"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon />
          {labels?.dark ?? "Dark"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor />
          {labels?.system ?? "System"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}