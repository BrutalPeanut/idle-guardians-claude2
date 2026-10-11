// Procedural Web Audio. Master compressor + voice limiting + persisted mute.
import type { WeaponKind } from './data'
export const Audio_ = (() => {
  let ctx: AudioContext | null = null, master: GainNode | null = null, voices = 0, muted = false;
  try { muted = localStorage.getItem('ig_mute') === '1'; } catch { /* storage unavailable */ }
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5;
      master.connect(comp); comp.connect(ctx.destination);
    } catch { ctx = null; }
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function noise(dur: number) {
    if (!ctx) throw new Error('no ctx');
    const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur | 0), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function voice(dur: number, build: (g: GainNode, t: number) => void) {
    if (!ctx || !master || muted || voices > 14) return;
    voices++;
    const g = ctx.createGain(); g.connect(master);
    const t = ctx.currentTime;
    build(g, t);
    setTimeout(() => { voices--; }, dur * 1000 + 30);
  }
  function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number) {
    voice(dur, (g, t) => {
      const o = ctx!.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); o.start(t); o.stop(t + dur);
    });
  }
  function burst(dur: number, vol: number, fType: BiquadFilterType, f0: number, f1: number) {
    voice(dur, (g, t) => {
      const n = noise(dur), f = ctx!.createBiquadFilter(); f.type = fType;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.connect(f); f.connect(g); n.start(t);
    });
  }
  const fire: Record<WeaponKind, () => void> = {
    rock:    () => burst(0.12, 0.25, 'bandpass', 900, 300),
    sling:   () => tone('triangle', 700, 200, 0.09, 0.18),
    arrow:   () => { tone('triangle', 220, 140, 0.12, 0.2); burst(0.08, 0.1, 'highpass', 3000, 1500); },
    bullet:  () => { burst(0.07, 0.3, 'highpass', 2500, 800); tone('square', 180, 60, 0.05, 0.1); },
    pellet:  () => { burst(0.22, 0.45, 'lowpass', 2500, 200); tone('sine', 110, 40, 0.18, 0.3); },
    heavy:   () => { burst(0.14, 0.4, 'lowpass', 1500, 150); tone('sine', 90, 35, 0.14, 0.4); },
    grenade: () => { tone('sine', 140, 50, 0.2, 0.4); burst(0.12, 0.2, 'lowpass', 900, 200); },
  };
  // ---- per-weapon sounds: layered crack (noise) + body (sine thump) + room tail, with random pitch so repeats don't sound robotic ----
  const rv = () => 0.94 + Math.random() * 0.12
  const crack = (vol: number, dur: number, f0: number, f1 = f0 * 0.4, type: BiquadFilterType = 'highpass') => burst(dur, vol, type, f0 * rv(), f1)
  const thump = (f0: number, f1: number, dur: number, vol: number) => tone('sine', f0 * rv(), f1, dur, vol)
  const tail = (dur: number, vol: number, lp = 1200) => burst(dur, vol, 'lowpass', lp, lp * 0.15)
  const click = (vol = 0.14, f = 2400) => { burst(0.02, vol, 'bandpass', f * rv(), f * 0.6); tone('square', 900, 400, 0.015, vol * 0.4) }
  const later = (ms: number, fn: () => void) => { setTimeout(fn, ms) }
  const weapon: (() => void)[] = [
    /* 0 Thrown Rock */ () => { burst(0.14, 0.22, 'bandpass', 500 * rv(), 1400); thump(140, 70, 0.05, 0.12) },
    /* 1 Slingshot */ () => { tone('sine', 420 * rv(), 1100, 0.05, 0.14); later(40, () => { tone('triangle', 260, 90, 0.1, 0.16); burst(0.05, 0.12, 'highpass', 3500, 2000) }) },
    /* 2 Recurve Bow */ () => { tone('triangle', 170 * rv(), 120, 0.22, 0.26); tone('sawtooth', 340 * rv(), 220, 0.1, 0.07); burst(0.05, 0.2, 'bandpass', 1800, 900); later(60, () => burst(0.16, 0.1, 'bandpass', 2400, 700)) },
    /* 3 Compound Bow */ () => { click(0.1, 1800); tone('triangle', 300 * rv(), 210, 0.12, 0.22); burst(0.04, 0.22, 'highpass', 3200, 1800); later(40, () => burst(0.12, 0.09, 'bandpass', 3000, 900)) },
    /* 4 Pistol */ () => { crack(0.42, 0.06, 2600); thump(170, 55, 0.09, 0.32); tail(0.2, 0.1, 1500) },
    /* 5 Revolver */ () => { crack(0.5, 0.08, 2000); thump(120, 40, 0.16, 0.42); tail(0.36, 0.14, 1100); later(210, () => click(0.07, 1500)) },
    /* 6 Hunting Rifle */ () => { crack(0.6, 0.09, 3000, 900); thump(95, 32, 0.22, 0.5); tail(0.55, 0.18, 1400); later(240, () => click(0.12, 1800)); later(330, () => click(0.12, 1300)) },
    /* 7 Shotgun */ () => { burst(0.26, 0.55, 'lowpass', 2800 * rv(), 220); crack(0.34, 0.05, 1800); thump(85, 28, 0.24, 0.5); tail(0.5, 0.16, 900); later(330, () => click(0.14, 900)); later(430, () => click(0.18, 700)) },
    /* 8 SMG */ () => { crack(0.2, 0.035, 3400, 1500); thump(210, 90, 0.04, 0.16) },
    /* 9 Assault Rifle */ () => { crack(0.3, 0.05, 2800, 1000); thump(140, 55, 0.07, 0.26); tail(0.12, 0.05, 1400) },
    /* 10 Minigun */ () => { crack(0.14, 0.03, 2600, 1200); tone('square', 95 * rv(), 70, 0.045, 0.1) },
    /* 11 M2 Browning */ () => { crack(0.5, 0.07, 1700, 600); thump(75, 28, 0.2, 0.55); tail(0.34, 0.16, 800) },
    /* 12 Mk 19 */ () => { thump(125, 42, 0.14, 0.46); burst(0.1, 0.28, 'bandpass', 700 * rv(), 250); later(30, () => tone('sine', 300, 120, 0.07, 0.12)); tail(0.2, 0.08, 700) },
  ]
  return {
    resume,
    fire(kind: WeaponKind, w?: number) { if (!ctx) return; if (w !== undefined && weapon[w]) weapon[w](); else if (fire[kind]) fire[kind]() },
    hit() { tone('square', 300, 120, 0.05, 0.08); },
    kill() { tone('triangle', 520, 880, 0.08, 0.12); },
    boom() { burst(0.35, 0.5, 'lowpass', 1800, 80); tone('sine', 80, 30, 0.3, 0.4); },
    merge(level: number) { const f = 330 * Math.pow(1.0595, level * 2); tone('triangle', f, f * 2, 0.18, 0.3); tone('sine', f * 1.5, f * 3, 0.25, 0.2); },
    zap() { tone('sawtooth', 520, 180, 0.09, 0.09) },
    whump() { tone('sine', 220, 55, 0.3, 0.3); burst(0.12, 0.15, 'lowpass', 700, 150) },
    coins() { [0, 4, 7, 12, 16].forEach((st, i) => setTimeout(() => tone('triangle', 660 * Math.pow(1.0595, st), 660 * Math.pow(1.0595, st) * 1.5, 0.14, 0.2), i * 70)) },
    ui() { tone('sine', 600, 800, 0.06, 0.15); },
    fanfare() { [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone('square', 262 * Math.pow(1.0595, s), 262 * Math.pow(1.0595, s), 0.25, 0.15), i * 110)); },
    toggleMute() { muted = !muted; try { localStorage.setItem('ig_mute', muted ? '1' : '0'); } catch { /* storage unavailable */ } if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
})();
