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
  return {
    resume,
    fire(kind: WeaponKind) { if (ctx && fire[kind]) fire[kind](); },
    hit() { tone('square', 300, 120, 0.05, 0.08); },
    kill() { tone('triangle', 520, 880, 0.08, 0.12); },
    boom() { burst(0.35, 0.5, 'lowpass', 1800, 80); tone('sine', 80, 30, 0.3, 0.4); },
    merge(level: number) { const f = 330 * Math.pow(1.0595, level * 2); tone('triangle', f, f * 2, 0.18, 0.3); tone('sine', f * 1.5, f * 3, 0.25, 0.2); },
    ui() { tone('sine', 600, 800, 0.06, 0.15); },
    fanfare() { [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone('square', 262 * Math.pow(1.0595, s), 262 * Math.pow(1.0595, s), 0.25, 0.15), i * 110)); },
    toggleMute() { muted = !muted; try { localStorage.setItem('ig_mute', muted ? '1' : '0'); } catch { /* storage unavailable */ } if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
})();
