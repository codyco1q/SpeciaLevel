"use client";

import type { WhiteboardElement } from "@/types/database";

export const STICKY_COLOR_PRESETS = [
  { name: "Yellow", value: "#fef08a", text: "#713f12" },
  { name: "Blue", value: "#bae6fd", text: "#0369a1" },
  { name: "Green", value: "#bbf7d0", text: "#15803d" },
  { name: "Pink", value: "#fbcfe8", text: "#be185d" },
  { name: "Purple", value: "#e9d5ff", text: "#6b21a8" },
  { name: "Orange", value: "#fed7aa", text: "#9a3412" },
  { name: "Coral", value: "#fecdd3", text: "#9f1239" },
  { name: "Mint", value: "#a7f3d0", text: "#065f46" },
  { name: "White", value: "#ffffff", text: "#1e293b" },
];

export const SHAPE_FILL_PRESETS = [
  { name: "Transparent", value: "transparent" },
  { name: "Light Blue", value: "rgba(59, 130, 246, 0.15)" },
  { name: "Light Green", value: "rgba(16, 185, 129, 0.15)" },
  { name: "Light Yellow", value: "rgba(234, 179, 8, 0.18)" },
  { name: "Light Red", value: "rgba(239, 68, 68, 0.15)" },
  { name: "Light Purple", value: "rgba(139, 92, 246, 0.15)" },
  { name: "Light Orange", value: "rgba(249, 115, 22, 0.15)" },
  { name: "Blue Solid", value: "#3b82f6" },
  { name: "Green Solid", value: "#10b981" },
  { name: "Red Solid", value: "#ef4444" },
  { name: "Dark Solid", value: "#0f172a" },
  { name: "White Solid", value: "#ffffff" },
];

export const STROKE_COLOR_PRESETS = [
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#0f172a",
  "#64748b",
  "#ffffff",
];

export const FOLDER_COLOR_PRESETS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export const STICKY_SIZES = {
  sm: { width: 160, height: 120, label: "Small" },
  md: { width: 220, height: 180, label: "Medium" },
  lg: { width: 300, height: 240, label: "Large" },
  wide: { width: 360, height: 180, label: "Wide" },
};

export function getElementAnchorPoint(
  el: WhiteboardElement,
  anchor: "top" | "right" | "bottom" | "left" | "center" | "auto" = "center",
  targetPoint?: { x: number; y: number }
): { x: number; y: number } {
  const w = el.width || (el.type === "sticky" ? 220 : 120);
  const h = el.height || (el.type === "sticky" ? 180 : 80);
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;

  if (anchor === "auto" && targetPoint) {
    const anchors = [
      { anchor: "top" as const, x: cx, y: el.y },
      { anchor: "right" as const, x: el.x + w, y: cy },
      { anchor: "bottom" as const, x: cx, y: el.y + h },
      { anchor: "left" as const, x: el.x, y: cy },
    ];
    let closest = anchors[0];
    let minDist = Infinity;
    for (const a of anchors) {
      const dist = Math.hypot(a.x - targetPoint.x, a.y - targetPoint.y);
      if (dist < minDist) {
        minDist = dist;
        closest = a;
      }
    }
    return { x: closest.x, y: closest.y };
  }

  switch (anchor) {
    case "top":
      return { x: cx, y: el.y };
    case "right":
      return { x: el.x + w, y: cy };
    case "bottom":
      return { x: cx, y: el.y + h };
    case "left":
      return { x: el.x, y: cy };
    case "center":
    default:
      return { x: cx, y: cy };
  }
}

export function findClosestAnchor(
  point: { x: number; y: number },
  elements: WhiteboardElement[],
  excludeId?: string,
  threshold = 36
): { elementId: string; anchor: "top" | "right" | "bottom" | "left" | "center"; x: number; y: number } | null {
  let closestMatch: {
    elementId: string;
    anchor: "top" | "right" | "bottom" | "left" | "center";
    x: number;
    y: number;
    dist: number;
  } | null = null;

  for (const el of elements) {
    if (el.id === excludeId || ["arrow", "line", "pen", "pencil", "highlighter"].includes(el.type)) {
      continue;
    }
    const anchors: ("top" | "right" | "bottom" | "left" | "center")[] = ["top", "right", "bottom", "left", "center"];
    for (const anchor of anchors) {
      const anchorPos = getElementAnchorPoint(el, anchor);
      const dist = Math.hypot(point.x - anchorPos.x, point.y - anchorPos.y);
      if (dist <= threshold) {
        if (!closestMatch || dist < closestMatch.dist) {
          closestMatch = { elementId: el.id, anchor, x: anchorPos.x, y: anchorPos.y, dist };
        }
      }
    }
  }

  return closestMatch ? { elementId: closestMatch.elementId, anchor: closestMatch.anchor, x: closestMatch.x, y: closestMatch.y } : null;
}

export function resolveArrowCoordinates(
  arrow: WhiteboardElement,
  elementMap: Map<string, WhiteboardElement>
): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = arrow.x;
  let y1 = arrow.y;
  let x2 = arrow.endX ?? arrow.x + 120;
  let y2 = arrow.endY ?? arrow.y + 80;

  if (arrow.startBinding) {
    const startEl = elementMap.get(arrow.startBinding.elementId);
    if (startEl) {
      const p = getElementAnchorPoint(startEl, arrow.startBinding.anchor || "auto", { x: x2, y: y2 });
      x1 = p.x;
      y1 = p.y;
    }
  }

  if (arrow.endBinding) {
    const endEl = elementMap.get(arrow.endBinding.elementId);
    if (endEl) {
      const p = getElementAnchorPoint(endEl, arrow.endBinding.anchor || "auto", { x: x1, y: y1 });
      x2 = p.x;
      y2 = p.y;
    }
  }

  return { x1, y1, x2, y2 };
}

export function generateArrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: "straight" | "curved" | "orthogonal" = "straight"
): string {
  if (style === "straight") return `M ${x1} ${y1} L ${x2} ${y2}`;
  if (style === "curved") {
    const dx = x2 - x1;
    const cx1 = x1 + dx * 0.4;
    const cy1 = y1;
    const cx2 = x1 + dx * 0.6;
    const cy2 = y2;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }
  if (style === "orthogonal") {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getElementBoundingBox(el: WhiteboardElement): BoundingBox {
  if (el.type === "sticky") {
    const w = el.width || 220;
    const h = el.height || 180;
    return { minX: el.x, minY: el.y, maxX: el.x + w, maxY: el.y + h };
  }
  if (el.type === "rectangle" || el.type === "circle" || el.type === "diamond") {
    const w = el.width || 120;
    const h = el.height || 80;
    return { minX: el.x, minY: el.y, maxX: el.x + w, maxY: el.y + h };
  }
  if (el.type === "text") {
    const w = el.width || 160;
    const h = el.height || 40;
    return { minX: el.x, minY: el.y, maxX: el.x + w, maxY: el.y + h };
  }
  if (el.type === "arrow" || el.type === "line") {
    const x1 = el.x;
    const y1 = el.y;
    const x2 = el.endX ?? el.x;
    const y2 = el.endY ?? el.y;
    return {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    };
  }
  if (el.type === "pencil" || el.type === "highlighter" || el.type === "pen") {
    if (el.points && el.points.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of el.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, minY, maxX, maxY };
    }
  }
  return { minX: el.x, minY: el.y, maxX: el.x + 40, maxY: el.y + 40 };
}

export function isElementIntersectingBox(el: WhiteboardElement, rect: BoundingBox): boolean {
  const box = getElementBoundingBox(el);
  return !(
    box.maxX < rect.minX ||
    box.minX > rect.maxX ||
    box.maxY < rect.minY ||
    box.minY > rect.maxY
  );
}

