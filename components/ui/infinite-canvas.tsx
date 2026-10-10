"use client";

import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

interface CanvasState {
  x: number;
  y: number;
  zoom: number;
}

const CanvasContext = createContext<CanvasState>({ x: 0, y: 0, zoom: 1 });

export function useInfiniteCanvas() {
  return useContext(CanvasContext);
}

interface InfiniteCanvasProps {
  children: React.ReactNode;
  className?: string;
}

export function InfiniteCanvas({ children, className }: InfiniteCanvasProps) {
  const [state, setState] = useState<CanvasState>({ x: 0, y: 0, zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Pan on middle-click or right-click or space + left
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setState((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const zoomSpeed = 0.001;
    const zoomDelta = -e.deltaY * zoomSpeed;
    setState((s) => {
      const newZoom = Math.min(Math.max(s.zoom + zoomDelta, 0.25), 2);
      return { ...s, zoom: newZoom };
    });
  }, []);

  return (
    <CanvasContext.Provider value={state}>
      <div
        ref={containerRef}
        className={cn("relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing", className)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Background Grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
            backgroundSize: `${20 * state.zoom}px ${20 * state.zoom}px`,
            backgroundPosition: `${state.x}px ${state.y}px`,
          }}
        />
        
        {/* Transform Layer */}
        <div
          style={{
            transform: `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`,
            transformOrigin: "0 0",
            transition: isDragging.current ? "none" : "transform 0.1s ease-out",
          }}
        >
          {children}
        </div>
      </div>
    </CanvasContext.Provider>
  );
}
