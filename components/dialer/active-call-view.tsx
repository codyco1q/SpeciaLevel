"use client";

import React from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Pause,
  Play,
  Grid,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCallDuration } from "@/app/(dashboard)/telecom/telecom-meta";
import { DialerKeypad } from "./dialer-keypad";
import { CallSummaryForm } from "./call-summary-form";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type { CallStatus } from "@/lib/stores/dialer-store";

interface ActiveCallViewProps {
  status: CallStatus;
  callId: string | null;
  duration: number;
  contactName: string | null;
  contactId: string | null;
  destinationNumber: string;
  isMuted: boolean;
  isOnHold: boolean;
  showKeypad: boolean;
  notes: string;
  outcome: string;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onToggleKeypad: () => void;
  onEndCall: () => void;
  onSetNotes: (notes: string) => void;
  onSetOutcome: (outcome: string) => void;
  onReset: () => void;
  onDigitPress: (digit: string) => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function ActiveCallView({
  status,
  callId,
  duration,
  contactName,
  contactId,
  destinationNumber,
  isMuted,
  isOnHold,
  showKeypad,
  notes,
  outcome,
  onToggleMute,
  onToggleHold,
  onToggleKeypad,
  onEndCall,
  onSetNotes,
  onSetOutcome,
  onReset,
  onDigitPress,
  platform,
}: ActiveCallViewProps) {
  const t = platform.dialer;

  if (status === "ended") {
    return (
      <CallSummaryForm
        callId={callId}
        duration={duration}
        contactId={contactId}
        notes={notes}
        outcome={outcome}
        onSetNotes={onSetNotes}
        onSetOutcome={onSetOutcome}
        onReset={onReset}
        platform={platform}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 text-center">
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 shadow-inner">
          <User className="size-7" />
          {status === "calling" && (
            <span className="absolute -inset-1 rounded-full border-2 border-primary/40 animate-ping opacity-60 pointer-events-none" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {contactName || destinationNumber}
          </h3>
          {contactName && (
            <p className="font-mono text-xs text-muted-foreground">{destinationNumber}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-3 py-0.5 text-xs font-mono font-medium text-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              status === "calling"
                ? "bg-amber-500 animate-pulse"
                : isOnHold
                ? "bg-orange-500"
                : "bg-emerald-500"
            )}
          />
          <span>
            {status === "calling"
              ? t.calling
              : isOnHold
              ? t.hold
              : formatCallDuration(duration)}
          </span>
        </div>
      </div>

      {showKeypad && (
        <div className="w-full rounded-xl border border-border/70 bg-card/80 p-2 backdrop-blur-xs">
          <DialerKeypad onDigitPress={onDigitPress} compact />
        </div>
      )}

      <div className="flex items-center justify-center gap-2.5 pt-1">
        <Button
          type="button"
          size="icon"
          variant={isMuted ? "destructive" : "outline"}
          onClick={onToggleMute}
          title={isMuted ? t.unmute : t.mute}
          className="size-10 rounded-full shadow-xs"
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>

        <Button
          type="button"
          size="icon"
          variant={isOnHold ? "secondary" : "outline"}
          onClick={onToggleHold}
          title={isOnHold ? t.resume : t.hold}
          className="size-10 rounded-full shadow-xs"
        >
          {isOnHold ? <Play className="size-4 text-emerald-500" /> : <Pause className="size-4" />}
        </Button>

        <Button
          type="button"
          size="icon"
          variant={showKeypad ? "default" : "outline"}
          onClick={onToggleKeypad}
          title={t.keypad}
          className="size-10 rounded-full shadow-xs"
        >
          <Grid className="size-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={onEndCall}
          title={t.endCall}
          className="size-11 rounded-full shadow-md bg-rose-600 hover:bg-rose-700 text-white active:scale-95"
        >
          <PhoneOff className="size-5" />
        </Button>
      </div>
    </div>
  );
}
