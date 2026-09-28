"use client";

import React from "react";
import { playDtmfTone } from "@/lib/audio/dtmf";
import { cn } from "@/lib/utils";

interface DialerKeypadProps {
  onDigitPress: (digit: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const KEYS = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*", sub: "" },
  { digit: "0", sub: "+" },
  { digit: "#", sub: "" },
];

export function DialerKeypad({ onDigitPress, disabled = false, compact = false }: DialerKeypadProps) {
  const handleClick = (digit: string) => {
    if (disabled) return;
    playDtmfTone(digit);
    onDigitPress(digit);
  };

  return (
    <div className="grid grid-cols-3 gap-2 px-1">
      {KEYS.map(({ digit, sub }) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => handleClick(digit)}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card/60 font-semibold transition-all select-none shadow-2xs active:scale-95",
            "hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:bg-primary/15",
            "disabled:opacity-40 disabled:pointer-events-none",
            compact ? "h-11" : "h-13"
          )}
        >
          <span className={cn("leading-none text-foreground group-hover:text-primary", compact ? "text-base font-bold" : "text-lg font-bold")}>
            {digit}
          </span>
          {sub && (
            <span className="text-[9px] font-medium tracking-widest text-muted-foreground/80 uppercase group-hover:text-primary/80">
              {sub}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
