"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberStepperInputProps {
  id?: string;
  name?: string;
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  "aria-label"?: string;
}

export function NumberStepperInput({
  id,
  name,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  placeholder,
  disabled = false,
  className,
  inputClassName,
  prefix,
  suffix,
  "aria-label": ariaLabel,
}: NumberStepperInputProps) {
  const strVal = value === undefined || value === null ? "" : String(value);

  const handleStep = (direction: 1 | -1) => {
    if (disabled) return;
    const currentNum = parseFloat(strVal);
    const base = isNaN(currentNum) ? 0 : currentNum;
    let nextNum = base + direction * step;
    if (min !== undefined && nextNum < min) nextNum = min;
    if (max !== undefined && nextNum > max) nextNum = max;
    const cleanNum = Math.round(nextNum * 10000) / 10000;
    onChange(String(cleanNum));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
  };

  const currentNum = parseFloat(strVal);
  const canDecrement = !disabled && (isNaN(currentNum) || min === undefined || currentNum > min);
  const canIncrement = !disabled && (isNaN(currentNum) || max === undefined || currentNum < max);

  return (
    <div
      className={cn(
        "group inline-flex w-full items-center rounded-md border border-input bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        disabled={!canDecrement}
        onClick={() => handleStep(-1)}
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-l-md border-e border-input/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        aria-label="Decrease value"
        tabIndex={-1}
      >
        <Minus className="size-3.5" />
      </button>

      {prefix && (
        <span className="ps-2 text-xs text-muted-foreground shrink-0 select-none">
          {prefix}
        </span>
      )}

      <input
        type="number"
        step="any"
        id={id}
        name={name}
        min={min}
        max={max}
        value={strVal}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{ MozAppearance: "textfield" }}
        className={cn(
          "w-full min-w-0 bg-transparent py-1 text-center text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
          inputClassName
        )}
      />

      {suffix && (
        <span className="pe-2 text-xs text-muted-foreground shrink-0 select-none">
          {suffix}
        </span>
      )}

      <button
        type="button"
        disabled={!canIncrement}
        onClick={() => handleStep(1)}
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-r-md border-s border-input/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        aria-label="Increase value"
        tabIndex={-1}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
