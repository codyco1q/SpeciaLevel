"use client";

import { useState } from "react";
import { Check, EyeOff, Pipette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface WhiteboardColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presets?: { name: string; value: string }[] | string[];
  allowTransparent?: boolean;
  title?: string;
  size?: "sm" | "md";
}

export function WhiteboardColorPicker({
  color,
  onChange,
  presets = [
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
  ],
  allowTransparent = false,
  title = "Choose Color",
  size = "md",
}: WhiteboardColorPickerProps) {
  const [customHex, setCustomHex] = useState(color === "transparent" ? "#3b82f6" : color);
  const isTransparent = color === "transparent" || color === "none";

  const normalizedPresets: { name?: string; value: string }[] = presets.map((p) =>
    typeof p === "string" ? { value: p } : p
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={title}
          className={cn(
            "group relative flex items-center justify-center rounded-md border border-border/80 shadow-xs transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-1 focus:ring-primary",
            size === "sm" ? "h-6 w-6" : "h-7 w-7"
          )}
          style={{
            backgroundColor: isTransparent ? "transparent" : color,
            backgroundImage: isTransparent
              ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
              : undefined,
            backgroundSize: isTransparent ? "6px 6px" : undefined,
          }}
        >
          {isTransparent && <EyeOff className="h-3 w-3 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-56 p-2.5 space-y-2.5 z-50 bg-popover/95 backdrop-blur shadow-xl border-border">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-0.5">
          <span>{title}</span>
          {allowTransparent && (
            <button
              type="button"
              onClick={() => onChange("transparent")}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] font-medium border transition",
                isTransparent
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground border-border"
              )}
            >
              Transparent
            </button>
          )}
        </div>

        {/* Swatches Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {normalizedPresets.map((preset) => {
            const isSelected = !isTransparent && color.toLowerCase() === preset.value.toLowerCase();
            return (
              <button
                key={preset.value}
                type="button"
                title={preset.name || preset.value}
                onClick={() => {
                  onChange(preset.value);
                  setCustomHex(preset.value);
                }}
                className={cn(
                  "h-6 w-6 rounded-md border border-black/10 flex items-center justify-center transition-transform hover:scale-110",
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105"
                )}
                style={{ backgroundColor: preset.value }}
              >
                {isSelected && (
                  <Check className={cn("h-3 w-3", preset.value === "#ffffff" ? "text-slate-900" : "text-white")} />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Color Input & Native Color Picker */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
          <div className="relative flex items-center justify-center shrink-0">
            <input
              type="color"
              value={customHex.startsWith("#") ? customHex : "#3b82f6"}
              onChange={(e) => {
                const hex = e.target.value;
                setCustomHex(hex);
                onChange(hex);
              }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
            <div className="h-7 w-7 rounded-md border border-border flex items-center justify-center bg-muted hover:bg-muted/80 transition cursor-pointer">
              <Pipette className="h-3.5 w-3.5 text-foreground" />
            </div>
          </div>

          <Input
            value={customHex}
            onChange={(e) => {
              const val = e.target.value;
              setCustomHex(val);
              if (/^#([0-9A-F]{3}){1,2}$/i.test(val) || val.startsWith("rgba")) {
                onChange(val);
              }
            }}
            placeholder="#3b82f6"
            className="h-7 text-xs font-mono uppercase px-2 bg-background/50"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
