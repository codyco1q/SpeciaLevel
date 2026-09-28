"use client";

import React, { useEffect, useState, useTransition } from "react";
import { PhoneCall, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialer } from "@/lib/stores/dialer-store";
import { ActiveCallView } from "./active-call-view";
import { DialerIdleView } from "./dialer-idle-view";
import { MinimizedDialerPill } from "./minimized-dialer-pill";
import { getOrgCallerNumbers, initiateOutboundCall } from "@/lib/actions/dialer";
import type { PhoneNumber } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface FloatingDialerProps {
  platform: Dictionary["platform"];
  locale: Locale;
}

export function FloatingDialer({ platform, locale }: FloatingDialerProps) {
  const dialer = useDialer();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [isCallingPending, startCallTransition] = useTransition();
  const t = platform.dialer;

  useEffect(() => {
    if (!dialer.isOpen) return;
    let isMounted = true;

    async function loadNumbers() {
      const res = await getOrgCallerNumbers();
      if (res.status === "success" && res.numbers && isMounted) {
        setPhoneNumbers(res.numbers);
        if (res.numbers.length > 0 && !dialer.selectedCallerIdNumber) {
          dialer.setSelectedCallerIdNumber(res.numbers[0].phone_number);
        }
      }
    }

    loadNumbers();
    return () => { isMounted = false; };
  }, [dialer.isOpen, dialer.selectedCallerIdNumber, dialer.setSelectedCallerIdNumber]);

  if (!dialer.isOpen) return null;

  const handleStartCall = () => {
    if (!dialer.destinationNumber.trim()) return;

    startCallTransition(async () => {
      const selectedPhone = phoneNumbers.find(
        (p) => p.phone_number === dialer.selectedCallerIdNumber
      );

      const res = await initiateOutboundCall({
        destinationNumber: dialer.destinationNumber,
        callerIdNumber: dialer.selectedCallerIdNumber,
        contactId: dialer.contactId,
        callerPhoneNumberId: selectedPhone?.id || null,
      });

      if (res.status === "success" && res.callId) {
        dialer.startCall(res.callId);
      } else {
        dialer.startCall();
      }
    });
  };

  if (dialer.isMinimized) {
    return <MinimizedDialerPill dialer={dialer} platform={platform} />;
  }

  return (
    <aside
      aria-label={t.title}
      className="fixed bottom-5 end-5 z-50 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-border/90 bg-card/95 shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-5"
    >
      <header className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <PhoneCall className="size-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground truncate">
            {t.title}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={dialer.toggleMinimize}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            title={t.minimize}
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={dialer.closeDialer}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            title={t.close}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>

      {dialer.callStatus !== "idle" ? (
        <ActiveCallView
          status={dialer.callStatus}
          callId={dialer.callId}
          duration={dialer.duration}
          contactName={dialer.contactName}
          contactId={dialer.contactId}
          destinationNumber={dialer.destinationNumber}
          isMuted={dialer.isMuted}
          isOnHold={dialer.isOnHold}
          showKeypad={dialer.showKeypad}
          notes={dialer.notes}
          outcome={dialer.outcome}
          onToggleMute={dialer.toggleMute}
          onToggleHold={dialer.toggleHold}
          onToggleKeypad={dialer.toggleKeypad}
          onEndCall={dialer.endCall}
          onSetNotes={dialer.setNotes}
          onSetOutcome={dialer.setOutcome}
          onReset={dialer.reset}
          onDigitPress={dialer.appendDigit}
          platform={platform}
          locale={locale}
        />
      ) : (
        <DialerIdleView
          phoneNumbers={phoneNumbers}
          selectedCallerIdNumber={dialer.selectedCallerIdNumber}
          destinationNumber={dialer.destinationNumber}
          isCallingPending={isCallingPending}
          onSelectCallerId={dialer.setSelectedCallerIdNumber}
          onChangeDestination={dialer.setDestinationNumber}
          onAppendDigit={dialer.appendDigit}
          onBackspace={dialer.backspaceDigit}
          onStartCall={handleStartCall}
          platform={platform}
        />
      )}
    </aside>
  );
}
