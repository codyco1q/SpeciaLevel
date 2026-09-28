"use client";

import React from "react";
import { Phone, Delete, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialerKeypad } from "./dialer-keypad";
import type { PhoneNumber } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface DialerIdleViewProps {
  phoneNumbers: PhoneNumber[];
  selectedCallerIdNumber: string;
  destinationNumber: string;
  isCallingPending: boolean;
  onSelectCallerId: (num: string) => void;
  onChangeDestination: (num: string) => void;
  onAppendDigit: (digit: string) => void;
  onBackspace: () => void;
  onStartCall: () => void;
  platform: Dictionary["platform"];
}

export function DialerIdleView({
  phoneNumbers,
  selectedCallerIdNumber,
  destinationNumber,
  isCallingPending,
  onSelectCallerId,
  onChangeDestination,
  onAppendDigit,
  onBackspace,
  onStartCall,
  platform,
}: DialerIdleViewProps) {
  const t = platform.dialer;

  return (
    <div className="flex flex-col gap-3 p-3.5">
      {phoneNumbers.length > 0 ? (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>{t.callerId}</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Volume2 className="size-3" />
              {t.audioFeedback}
            </span>
          </label>
          <Select
            value={selectedCallerIdNumber}
            onValueChange={onSelectCallerId}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue placeholder={t.selectCallerId} />
            </SelectTrigger>
            <SelectContent>
              {phoneNumbers.map((num) => (
                <SelectItem
                  key={num.id}
                  value={num.phone_number}
                  className="text-xs font-mono"
                >
                  {num.friendly_name
                    ? `${num.friendly_name} (${num.phone_number})`
                    : num.phone_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/80 italic">
          {t.noActiveNumber}
        </p>
      )}

      <div className="relative">
        <Input
          type="tel"
          value={destinationNumber}
          onChange={(e) => onChangeDestination(e.target.value)}
          placeholder={t.destinationPlaceholder}
          className="h-10 pe-10 ps-3 font-mono text-base font-semibold tracking-wider text-center"
        />
        {destinationNumber.length > 0 && (
          <div className="absolute inset-y-0 end-1.5 flex items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onBackspace}
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <Delete className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>

      <DialerKeypad onDigitPress={onAppendDigit} />

      <Button
        type="button"
        disabled={!destinationNumber.trim() || isCallingPending}
        onClick={onStartCall}
        className="h-11 w-full gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-98 transition-all"
      >
        <Phone className="size-4 fill-current" />
        {t.call}
      </Button>
    </div>
  );
}
