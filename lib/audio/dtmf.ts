"use client";

// Standard DTMF frequency pairs (Row Hz, Col Hz)
const DTMF_FREQS: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playDtmfTone(digit: string, durationMs = 120) {
  const freqs = DTMF_FREQS[digit];
  if (!freqs) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const [freq1, freq2] = freqs;
    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.value = freq1;

    osc2.type = "sine";
    osc2.frequency.value = freq2;

    // Smooth envelope to avoid clicks
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gainNode.gain.setValueAtTime(0.08, now + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  } catch {
    // Ignore audio playback errors if audio context blocked by browser autoplay policy
  }
}
