/* Tiny 8-bit sound engine — square/triangle blips via Web Audio. */

let ctx = null;
let muted = false;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(v) {
  muted = !!v;
}

function beep({ freq = 440, dur = 0.12, type = 'square', gain = 0.05, slideTo = null, delay = 0 }) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const sfx = {
  blip() {
    beep({ freq: 720, dur: 0.05, type: 'square', gain: 0.028 });
  },
  chirp() {
    beep({ freq: 620, dur: 0.07, gain: 0.04 });
    beep({ freq: 900, dur: 0.09, gain: 0.04, delay: 0.07 });
  },
  chomp() {
    beep({ freq: 220, slideTo: 90, dur: 0.09, gain: 0.05 });
    beep({ freq: 200, slideTo: 80, dur: 0.09, gain: 0.05, delay: 0.13 });
    beep({ freq: 260, slideTo: 120, dur: 0.1, gain: 0.04, delay: 0.26 });
  },
  sparkle() {
    [880, 1175, 1320, 1760].forEach((f, i) => beep({ freq: f, dur: 0.09, type: 'triangle', gain: 0.05, delay: i * 0.06 }));
  },
  water() {
    [700, 560, 440].forEach((f, i) => beep({ freq: f, slideTo: f * 0.7, dur: 0.12, type: 'sine', gain: 0.06, delay: i * 0.08 }));
  },
  buy() {
    [523, 659, 784, 1046].forEach((f, i) => beep({ freq: f, dur: 0.12, gain: 0.045, delay: i * 0.07 }));
  },
  evolve() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => beep({ freq: f, dur: 0.16, gain: 0.05, delay: i * 0.1 }));
  },
  error() {
    beep({ freq: 200, slideTo: 110, dur: 0.16, type: 'sawtooth', gain: 0.04 });
  },
};
