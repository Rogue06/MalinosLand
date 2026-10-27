/**
 * Petits bruitages du « Chantier des mondes », fabriqués à la volée (Web Audio) : aucun fichier
 * son. Coups de pioche selon la matière, cube cassé, cube posé, objet fabriqué. Le contexte
 * audio ne démarre qu'après un geste du joueur (règle des navigateurs).
 */
export type Material = 'soft' | 'wood' | 'stone' | 'glass';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function soundEnabled(): boolean {
  return enabled;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const TONE: Record<Material, { freq: number; q: number; len: number }> = {
  soft: { freq: 500, q: 0.8, len: 0.07 },
  wood: { freq: 900, q: 3, len: 0.06 },
  stone: { freq: 2200, q: 2, len: 0.05 },
  glass: { freq: 3600, q: 6, len: 0.08 },
};

/** Bruit filtré bref : un coup sur une matière. */
function knock(m: Material, volume: number, lenFactor = 1): void {
  const a = audio();
  if (!a) return;
  const t = TONE[m];
  const len = t.len * lenFactor;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = t.freq * (0.9 + Math.random() * 0.2);
  filter.Q.value = t.q;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

/** Bruit de l'eau quand on nage : un souffle grave et doux qui ondule, en boucle. */
let water: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

function waterLoop(on: boolean): void {
  const a = audio();
  if (!a) return;
  if (on && !water) {
    const len = a.sampleRate * 2;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    // Bruit « brun » (grave), bouclé sans à-coup.
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    // Ondulation lente du volume, comme des vagues.
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = 0.35;
    depth.gain.value = 0.06;
    const gain = a.createGain();
    gain.gain.setValueAtTime(0.0001, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, a.currentTime + 0.4);
    lfo.connect(depth).connect(gain.gain);
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
    lfo.start();
    src.onended = () => lfo.stop();
    water = { src, gain };
  } else if (!on && water) {
    const w = water;
    water = null;
    w.gain.gain.cancelScheduledValues(a.currentTime);
    w.gain.gain.setValueAtTime(Math.max(0.0001, w.gain.gain.value), a.currentTime);
    w.gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5);
    w.src.stop(a.currentTime + 0.55);
  }
}

export const sfx = {
  /** On entre dans l'eau : « plouf » ; puis le bruit de l'eau tant qu'on nage. */
  splash: () => knock('soft', 0.7, 6),
  water: waterLoop,
  /** La lave brûle : un grésillement. */
  sizzle: () => knock('glass', 0.5, 5),
  hit: (m: Material) => knock(m, 0.35),
  broken: (m: Material) => knock(m, 0.6, 2.4),
  placed: (m: Material) => knock(m === 'glass' ? 'glass' : 'soft', 0.45, 1.6),
  /** « Pop » : un objet ramassé arrive dans le sac (petit son qui monte, hauteur variable). */
  pop(): void {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    const at = a.currentTime;
    const base = 520 + Math.random() * 260;
    o.type = 'sine';
    o.frequency.setValueAtTime(base, at);
    o.frequency.exponentialRampToValueAtTime(base * 2.1, at + 0.07);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 0.14);
  },
  crafted(): void {
    const a = audio();
    if (!a) return;
    [660, 990].forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const at = a.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      o.connect(g).connect(a.destination);
      o.start(at);
      o.stop(at + 0.3);
    });
  },
};
