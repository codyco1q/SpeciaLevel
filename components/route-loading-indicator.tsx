"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Monogram } from "@/components/brand";
import { cn } from "@/lib/utils";

export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [render, setRender] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTransition = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRender(true);
    requestAnimationFrame(() => {
      setIsLoading(true);
    });

    // Safeguard: auto-hide after 8s if navigation hangs
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => setRender(false), 250);
    }, 8000);
  };

  const stopTransition = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsLoading(false);
    timeoutRef.current = setTimeout(() => {
      setRender(false);
    }, 250);
  };

  // When route change completes
  useEffect(() => {
    stopTransition();
  }, [pathname, searchParams]);

  // Intercept clicks on internal links
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
      ) {
        return;
      }

      try {
        const url = new URL(anchor.href, window.location.href);
        if (
          url.origin === window.location.origin &&
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash !== ""
        ) {
          return;
        }

        if (url.origin === window.location.origin) {
          startTransition();
        }
      } catch {
        // Ignore URL parse errors
      }
    }

    function handlePopState() {
      startTransition();
    }

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!render) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none backdrop-blur-[2px] bg-background/40 transition-opacity duration-200 ease-out",
        isLoading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient Glow */}
        <div className="absolute -inset-6 rounded-full bg-primary/25 blur-2xl animate-pulse" />

        {/* High-Tech Dual-Ring Spinner */}
        <div className="relative flex items-center justify-center size-20">
          {/* Outer Ring */}
          <div className="size-20 rounded-full border-2 border-primary/20 border-t-primary border-r-primary/80 animate-spin" />

          {/* Inner Reverse Ring */}
          <div
            className="absolute size-14 rounded-full border-2 border-primary/10 border-b-primary border-l-primary/60"
            style={{
              animation: "spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse",
            }}
          />

          {/* Center Logo / Monogram */}
          <div className="absolute flex items-center justify-center">
            <Monogram className="size-8 text-xs shadow-md shadow-primary/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
