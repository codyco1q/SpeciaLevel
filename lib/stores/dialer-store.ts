"use client";

import { useSyncExternalStore } from "react";

export type CallStatus = "idle" | "calling" | "connected" | "ended";

export interface DialerState {
  isOpen: boolean;
  isMinimized: boolean;
  callStatus: CallStatus;
  callId: string | null;
  destinationNumber: string;
  contactName: string | null;
  contactId: string | null;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  showKeypad: boolean;
  selectedCallerIdNumber: string;
  notes: string;
  outcome: string;
}

const initialState: DialerState = {
  isOpen: false,
  isMinimized: false,
  callStatus: "idle",
  callId: null,
  destinationNumber: "",
  contactName: null,
  contactId: null,
  duration: 0,
  isMuted: false,
  isOnHold: false,
  showKeypad: false,
  selectedCallerIdNumber: "",
  notes: "",
  outcome: "completed",
};

let state: DialerState = { ...initialState };
const listeners = new Set<() => void>();
let timerInterval: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (state.callStatus === "connected" && !state.isOnHold) {
      state = { ...state, duration: state.duration + 1 };
      emit();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export const dialerStore = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  openDialer(p?: { destinationNumber?: string; contactName?: string | null; contactId?: string | null }) {
    state = {
      ...state,
      isOpen: true,
      isMinimized: false,
      ...(p?.destinationNumber !== undefined && { destinationNumber: p.destinationNumber }),
      ...(p?.contactName !== undefined && { contactName: p.contactName }),
      ...(p?.contactId !== undefined && { contactId: p.contactId }),
    };
    emit();
  },
  closeDialer() {
    if (state.callStatus === "calling" || state.callStatus === "connected") this.endCall();
    state = { ...state, isOpen: false, isMinimized: false };
    emit();
  },
  toggleMinimize() {
    state = { ...state, isMinimized: !state.isMinimized };
    emit();
  },
  setDestinationNumber: (destinationNumber: string) => { state = { ...state, destinationNumber }; emit(); },
  appendDigit: (d: string) => { state = { ...state, destinationNumber: state.destinationNumber + d }; emit(); },
  backspaceDigit: () => { state = { ...state, destinationNumber: state.destinationNumber.slice(0, -1) }; emit(); },
  clearNumber: () => { state = { ...state, destinationNumber: "" }; emit(); },
  setSelectedCallerIdNumber: (selectedCallerIdNumber: string) => { state = { ...state, selectedCallerIdNumber }; emit(); },
  startCall(callId?: string) {
    if (!state.destinationNumber.trim()) return;
    state = {
      ...state,
      isOpen: true,
      isMinimized: false,
      callStatus: "calling",
      callId: callId ?? null,
      duration: 0,
      isMuted: false,
      isOnHold: false,
      notes: "",
      outcome: "completed",
    };
    emit();
    setTimeout(() => {
      if (state.callStatus === "calling") {
        state = { ...state, callStatus: "connected" };
        startTimer();
        emit();
      }
    }, 2000);
  },
  setCallConnected(callId?: string) {
    state = { ...state, callStatus: "connected", ...(callId && { callId }) };
    startTimer();
    emit();
  },
  endCall() {
    stopTimer();
    state = { ...state, callStatus: "ended", isMuted: false, isOnHold: false };
    emit();
  },
  toggleMute: () => { state = { ...state, isMuted: !state.isMuted }; emit(); },
  toggleHold: () => { state = { ...state, isOnHold: !state.isOnHold }; emit(); },
  toggleKeypad: () => { state = { ...state, showKeypad: !state.showKeypad }; emit(); },
  setNotes: (notes: string) => { state = { ...state, notes }; emit(); },
  setOutcome: (outcome: string) => { state = { ...state, outcome }; emit(); },
  reset() {
    stopTimer();
    state = { ...initialState, selectedCallerIdNumber: state.selectedCallerIdNumber };
    emit();
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("dialer:open", ((e: CustomEvent<{ destinationNumber?: string; contactName?: string | null; contactId?: string | null }>) => {
    dialerStore.openDialer(e.detail);
  }) as EventListener);
}

export function openGlobalDialer(params?: { destinationNumber?: string; contactName?: string | null; contactId?: string | null }) {
  if (typeof window !== "undefined") {
    dialerStore.openDialer(params);
  }
}

export function useDialer() {
  const currentState = useSyncExternalStore(
    dialerStore.subscribe,
    dialerStore.getState,
    () => initialState
  );

  return {
    ...currentState,
    openDialer: dialerStore.openDialer.bind(dialerStore),
    closeDialer: dialerStore.closeDialer.bind(dialerStore),
    toggleMinimize: dialerStore.toggleMinimize.bind(dialerStore),
    setDestinationNumber: dialerStore.setDestinationNumber,
    appendDigit: dialerStore.appendDigit,
    backspaceDigit: dialerStore.backspaceDigit,
    clearNumber: dialerStore.clearNumber,
    setSelectedCallerIdNumber: dialerStore.setSelectedCallerIdNumber,
    startCall: dialerStore.startCall.bind(dialerStore),
    setCallConnected: dialerStore.setCallConnected,
    endCall: dialerStore.endCall.bind(dialerStore),
    toggleMute: dialerStore.toggleMute,
    toggleHold: dialerStore.toggleHold,
    toggleKeypad: dialerStore.toggleKeypad,
    setNotes: dialerStore.setNotes,
    setOutcome: dialerStore.setOutcome,
    reset: dialerStore.reset.bind(dialerStore),
  };
}
