// Pure Web Audio API chime helper - no external audio files required
let audioCtx: AudioContext | null = null;
let soundEnabled = false;

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (enabled) {
    initAudio();
  }
}

export function initAudio(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return Boolean(audioCtx && audioCtx.state === "running");
  } catch {
    return false;
  }
}

export function playNewOrderChime(): void {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx || audioCtx.state !== "running") return;

    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.12); // A5

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now); // G5
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6

    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch {
    // Ignore browser audio restrictions
  }
}
