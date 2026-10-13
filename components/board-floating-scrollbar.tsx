"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoardFloatingScrollbarProps {
  boardRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function BoardFloatingScrollbar({
  boardRef,
  className,
}: BoardFloatingScrollbarProps) {
  const [scrollInfo, setScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const updateScrollInfo = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    setScrollInfo({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }, [boardRef]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    updateScrollInfo();

    const handleScroll = () => {
      updateScrollInfo();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateScrollInfo();
      });
      ro.observe(el);
    }

    const handleResize = () => updateScrollInfo();
    window.addEventListener("resize", handleResize);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      ro?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [boardRef, updateScrollInfo]);

  const { scrollLeft, scrollWidth, clientWidth } = scrollInfo;
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

  if (maxScrollLeft <= 10) {
    return null;
  }

  const canScrollLeft = scrollLeft > 5;
  const canScrollRight = scrollLeft < maxScrollLeft - 5;
  const scrollRatio = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
  const thumbWidthPercent = Math.max(
    12,
    Math.min(80, (clientWidth / (scrollWidth || 1)) * 100)
  );
  const thumbLeftPercent = scrollRatio * (100 - thumbWidthPercent);

  const scrollByAmount = (delta: number) => {
    boardRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const board = boardRef.current;
    if (!track || !board) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const thumbWidthPx = (thumbWidthPercent / 100) * rect.width;
    const availableTrack = rect.width - thumbWidthPx;
    const targetThumbLeft = clickX - thumbWidthPx / 2;
    const ratio =
      availableTrack > 0
        ? Math.max(0, Math.min(1, targetThumbLeft / availableTrack))
        : 0;
    board.scrollTo({ left: ratio * maxScrollLeft, behavior: "smooth" });
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const board = boardRef.current;
    const track = trackRef.current;
    if (!board || !track) return;

    // Disable smooth scrolling temporarily to eliminate input lag while dragging
    const originalScrollBehavior = board.style.scrollBehavior;
    board.style.scrollBehavior = "auto";

    const startScrollLeft = board.scrollLeft;
    const trackWidth = track.clientWidth;
    const thumbWidthPx = (thumbWidthPercent / 100) * trackWidth;
    const availableTrackWidth = Math.max(1, trackWidth - thumbWidthPx);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const scrollDelta = (deltaX / availableTrackWidth) * maxScrollLeft;
      board.scrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, startScrollLeft + scrollDelta)
      );
    };

    const onMouseUp = () => {
      setIsDragging(false);
      board.style.scrollBehavior = originalScrollBehavior;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 mt-3 flex items-center justify-between gap-3 rounded-full border border-border/80 bg-card/95 px-4 py-2 shadow-lg backdrop-blur-md mx-auto max-w-md transition-all select-none",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-full shrink-0"
        onClick={() => scrollByAmount(-320)}
        disabled={!canScrollLeft}
        title="Scroll left"
        aria-label="Scroll left"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </Button>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-2.5 flex-1 rounded-full bg-muted cursor-pointer group"
      >
        <div
          className={cn(
            "absolute top-0 bottom-0 rounded-full bg-primary/70 hover:bg-primary transition-colors cursor-grab active:cursor-grabbing shadow-xs",
            isDragging && "bg-primary cursor-grabbing"
          )}
          style={{
            left: `${thumbLeftPercent}%`,
            width: `${thumbWidthPercent}%`,
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-full shrink-0"
        onClick={() => scrollByAmount(320)}
        disabled={!canScrollRight}
        title="Scroll right"
        aria-label="Scroll right"
      >
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
