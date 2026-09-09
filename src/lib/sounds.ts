// Tiny cute SFX using Web Audio. No assets needed.
// Each is a short envelope-shaped tone or chord.
let _ctx: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _ctx = new AudioContextClass();
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

function blip(freqs: number[], dur = 0.15, type: OscillatorType = "sine", gain = 0.06) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0 + i * 0.06);
    g.gain.setValueAtTime(0, t0 + i * 0.06);
    g.gain.linearRampToValueAtTime(gain, t0 + i * 0.06 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0 + i * 0.06);
    o.stop(t0 + i * 0.06 + dur + 0.02);
  });
}

let muted = typeof localStorage !== "undefined" && localStorage.getItem("centi-muted") === "1";
export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem("centi-muted", muted ? "1" : "0");
  } catch (e) {
    // Ignore storage errors
  }
  return muted;
}
export function isMuted() {
  return muted;
}

const guard = (fn: () => void) => () => {
  if (!muted)
    try {
      fn();
    } catch (e) {
      // Ignore audio errors
    }
};

export const sfx = {
  tap: guard(() => blip([660], 0.08, "triangle", 0.04)),
  pop: guard(() => blip([440, 880], 0.12, "triangle", 0.06)),
  success: guard(() => blip([523, 659, 784, 1046], 0.18, "sine", 0.05)),
  coin: guard(() => blip([988, 1318], 0.2, "square", 0.04)),
  error: guard(() => blip([220, 180], 0.2, "sawtooth", 0.05)),
  swoosh: guard(() => blip([1200, 600], 0.2, "sine", 0.03)),
};
