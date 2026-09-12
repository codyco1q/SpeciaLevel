"use client";

import { useLayoutEffect } from "react";

/**
 * Scopes the shadcn dark theme to the public SpeciaLevel site.
 *
 * The marketing site is dark-mode-first, while the authenticated app
 * (/login, /signup, /dashboard, ...) uses the light theme. We toggle the
 * `.dark` class on <html> only while this component is mounted so that
 * portaled UI (e.g. the Select popover in the contact form) also inherits
 * the dark tokens, and remove it on unmount so the rest of the app stays
 * light. useLayoutEffect runs before paint, so there's no light flash.
 */
export function MarketingDarkMode() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => root.classList.remove("dark");
  }, []);

  return null;
}