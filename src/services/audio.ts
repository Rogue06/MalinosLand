import { settingsStore } from './settings';

/**
 * Sons du jeu, entièrement générés par le code (Web Audio) : aucun fichier à télécharger, comme
 * les graphismes. Volume discret, coupables dans les réglages.
 * - `playSound('message' | 'mention')` : arrivée d'un message (décidé par SoundGate) ;
 * - `setAmbience(lieu)` : ambiance selon la zone (oiseaux et vent dehors, clavier au coworking).
 * Les navigateurs n'autorisent le son qu'après une action du joueur : `unlockAudio` est appelé
 * au premier clic ou à la première touche.
 */

export type Ambience = 'outdoor' | 'coworking' | null;

/** Zones extérieures et zones avec une ambiance particulière (carte du Hub). */
export function ambienceForZone(zoneId: string | null): Ambience {
  if (zoneId === 'garden' || zoneId === 'terrace' || zoneId === 'site') return 'outdoor';
  if (zoneId === 'coworking') return 'coworking';
  return null;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let current: Ambience = null;
let wanted: Ambience = null;
let paused = false;
let timers: ReturnType<typeof setTimeout>[] = [];
let wind: AudioBufferSourceNode | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.connect(ctx.destination);
  ambienceGain = ctx.createGain();
  ambienceGain.connect(master);
  applyVolume();
  return ctx;
}

function applyVolume(): void {
  const s = settingsStore.get();
  if (master) master.gain.value = s.volume;
  if (ambienceGain) ambienceGain.gain.value = s.ambience ? 0.5 : 0;
}

/** À appeler lors d'une action du joueur (clic, touche) : autorise le son. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
  if (wanted !== current) startAmbience(wanted);
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

settingsStore.subscribe(() => {
  applyVolume();
  if (!settingsStore.get().ambience) stopAmbience();
  else if (wanted !== current) startAmbience(wanted);
});

function tone(
  freq: number,
  start: number,
  duration: number,
  opts: { type?: OscillatorType; gain?: number; to?: number; out?: AudioNode } = {},
): void {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + duration);
  const peak = opts.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(opts.out ?? master!);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Son court : « pop » pour un message, petite cloche pour une mention. */
export function playSound(kind: 'message' | 'mention'): void {
  if (!settingsStore.get().sounds) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  if (kind === 'message') {
    tone(620, t, 0.09, { to: 820, gain: 0.08 });
  } else {
    tone(880, t, 0.22, { type: 'triangle', gain: 0.12 });
    tone(1320, t + 0.11, 0.35, { type: 'triangle', gain: 0.1 });
  }
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function later(ms: number, fn: () => void): void {
  timers.push(setTimeout(fn, ms));
}

function birdLoop(): void {
  const c = ctx;
  if (!c || current !== 'outdoor') return;
  const t = c.currentTime + 0.05;
  const base = 2400 + Math.random() * 1600;
  const notes = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const f = base * (0.9 + Math.random() * 0.25);
    tone(f, t + i * 0.13, 0.09, { to: f * 1.25, gain: 0.025, out: ambienceGain! });
  }
  later(2500 + Math.random() * 6000, birdLoop);
}

function keyboardLoop(): void {
  const c = ctx;
  if (!c || current !== 'coworking') return;
  const buf = noiseBuffer(c, 0.03);
  const t0 = c.currentTime + 0.05;
  const keys = 3 + Math.floor(Math.random() * 10);
  let t = t0;
  for (let i = 0; i < keys; i++) {
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800 + Math.random() * 1500;
    const g = c.createGain();
    g.gain.value = 0.035;
    src.connect(hp).connect(g).connect(ambienceGain!);
    src.start(t);
    t += 0.08 + Math.random() * 0.12;
  }
  later(3000 + Math.random() * 7000, keyboardLoop);
}

function stopAmbience(): void {
  for (const id of timers) clearTimeout(id);
  timers = [];
  try {
    wind?.stop();
  } catch {
    /* déjà arrêté */
  }
  wind = null;
  current = null;
}

function startAmbience(kind: Ambience): void {
  stopAmbience();
  const c = ctx;
  if (!kind || paused || !c || c.state !== 'running' || !settingsStore.get().ambience) return;
  current = kind;
  if (kind === 'outdoor') {
    // Vent : bruit filtré très doux.
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 4);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = c.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(ambienceGain!);
    src.start();
    wind = src;
    later(800, birdLoop);
  } else {
    later(1500, keyboardLoop);
  }
}

/** Ambiance du lieu où se trouve le joueur. */
export function setAmbience(kind: Ambience): void {
  wanted = kind;
  if (kind !== current) startAmbience(kind);
}

/** Onglet caché : on coupe l'ambiance (et on la reprend au retour). */
export function setAudioPaused(hidden: boolean): void {
  paused = hidden;
  if (hidden) stopAmbience();
  else if (wanted !== current) startAmbience(wanted);
}
