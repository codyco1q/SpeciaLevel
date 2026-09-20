"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsVisible(true);
    setProgress(20);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        // Increment slower as progress increases
        const diff = (90 - prev) * 0.15;
        return prev + Math.max(diff, 1.5);
      });
    }, 200);
  };

  const completeLoading = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      finishTimerRef.current = setTimeout(() => {
        setProgress(0);
      }, 300);
    }, 200);
  };

  // Route change complete
  useEffect(() => {
    completeLoading();
  }, [pathname, searchParams]);

  // Intercept click on internal links
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Don't intercept modified clicks (open in new tab, etc.)
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

      // Ignore external, download, tel, mailto, target="_blank", or hash-only links
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

      // If destination URL is identical to current, skip
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
        startLoading();
      }
    }

    function handlePopState() {
      startLoading();
    }

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] h-[3px]"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 300ms ease-in-out",
      }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)),0_0_5px_hsl(var(--primary))]"
        style={{
          width: `${progress}%`,
          transition: "width 300ms ease-in-out",
        }}
      />
    </div>
  );
}