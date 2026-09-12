"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes provider wrapper so the root server layout can hydrate the
 * whole app with class-based dark mode:
 *  - `attribute="class"`  → toggles the `.dark` class on <html> (shadcn tokens)
 *  - `defaultTheme="system"` + `enableSystem` → follow the OS until the user
 *    picks a specific theme via the ThemeToggle
 *  - `disableTransitionOnChange` → instant swap, no color transition flash
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}