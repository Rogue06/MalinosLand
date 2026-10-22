import { settingsStore } from './settings';

/**
 * Sons du jeu, entièrement générés par le code (Web Audio) : aucun fichier à télécharger, comme
 * les graphismes. Volume discret, coupables dans les réglages.
 * - `playSound('message' | 'mention')` : arrivée d'un message (décidé par SoundGate) ;
 * - `setSpotSound(source, niveau)` : son d'une source proche (crépitement du feu de camp, eau de
 *   la fontaine), d'autant plus fort qu'on s'en approche ;
 * - `setAmbience(lieu)` : ambiance selon la zone (oiseaux et vent dehors, clavier au
 *   coworking, « ding » de l'ascenseur dans le hall, petites mélodies d'arcade de temps en temps
 *   dans la salle de jeux, cheminée et tasses au salon). Pas de fond sonore continu là où l'on
 *   passe le plus de temps : seulement des sons ponctuels, espacés.
 * Les navigateurs n'autorisent le son qu'après une action du joueur : `unlockAudio` est appelé
 * au premier clic ou à la première touche.
 */

export type Ambience = 'outdoor' | 'coworking' | 'hall' | 'games' | 'lounge' | null;

/** Zones extérieures et zones avec une ambiance particulière (carte du Hub). */
export function ambienceForZone(zoneId: string | null): Ambience {
  if (['garden', 'terrace', 'site', 'park', 'orchard', 'forest'].includes(zoneId ?? ''))
    return 'outdoor';
  if (zoneId === 'games') return 'games';
  if (zoneId === 'coworking') return 'coworking';
  if (zoneId === 'hall') return 'hall';
  // Salon du Hub et studios : ambiance douce (cheminée, tasses).
  if (zoneId === 'lounge' || zoneId === 'studio') return 'lounge';
  return null;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let current: Ambience = null;
let wanted: Ambience = null;
let paused = false;
let timers: ReturnType<typeof setTimeout>[] = [];
/** Fond sonore continu (vent, cheminée). */
let bed: AudioScheduledSourceNode[] = [];

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

/** Fond continu : bruit filtré en boucle, très doux. */
function startBed(c: AudioContext, filter: BiquadFilterType, freq: number, gain: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ambienceGain!);
  src.start();
  bed.push(src);
}

/** Hall : « ding » discret de l'ascenseur de temps en temps. */
function elevatorLoop(): void {
  const c = ctx;
  if (!c || current !== 'hall') return;
  const t = c.currentTime + 0.05;
  tone(1046, t, 0.9, { type: 'sine', gain: 0.03, out: ambienceGain! });
  tone(784, t + 0.35, 1.1, { type: 'sine', gain: 0.025, out: ambienceGain! });
  later(40000 + Math.random() * 40000, elevatorLoop);
}

/** Salle de jeux : une petite mélodie de borne d'arcade, de temps en temps, au loin. */
function arcadeLoop(): void {
  const c = ctx;
  if (!c || current !== 'games') return;
  const t = c.currentTime + 0.05;
  const scale = [523, 587, 659, 784, 880, 1046];
  const notes = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const f = scale[Math.floor(Math.random() * scale.length)]!;
    tone(f, t + i * 0.11, 0.1, { type: 'square', gain: 0.008, out: ambienceGain! });
  }
  later(20000 + Math.random() * 25000, arcadeLoop);
}

/** Salon : crépitements de cheminée et tintement de tasse. */
function loungeLoop(): void {
  const c = ctx;
  if (!c || current !== 'lounge') return;
  const buf = noiseBuffer(c, 0.012);
  const t0 = c.currentTime + 0.05;
  const pops = 2 + Math.floor(Math.random() * 6);
  for (let i = 0; i < pops; i++) {
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 2200;
    const g = c.createGain();
    g.gain.value = 0.02 + Math.random() * 0.03;
    src.connect(bp).connect(g).connect(ambienceGain!);
    src.start(t0 + Math.random() * 1.5);
  }
  if (Math.random() < 0.12) {
    const f = 2600 + Math.random() * 600;
    tone(f, t0 + 0.4, 0.25, { type: 'triangle', gain: 0.02, out: ambienceGain! });
    tone(f * 1.5, t0 + 0.42, 0.2, { type: 'sine', gain: 0.012, out: ambienceGain! });
  }
  later(900 + Math.random() * 2200, loungeLoop);
}

function stopAmbience(): void {
  for (const id of timers) clearTimeout(id);
  timers = [];
  for (const node of bed) {
    try {
      node.stop();
    } catch {
      /* déjà arrêté */
    }
  }
  bed = [];
  current = null;
}

function startAmbience(kind: Ambience): void {
  stopAmbience();
  const c = ctx;
  if (!kind || paused || !c || c.state !== 'running' || !settingsStore.get().ambience) return;
  current = kind;
  if (kind === 'outdoor') {
    startBed(c, 'lowpass', 380, 0.05); // vent
    later(800, birdLoop);
  } else if (kind === 'coworking') {
    later(1500, keyboardLoop);
  } else if (kind === 'hall') {
    // Plus de brouhaha continu (jugé pénible) : seulement l'ascenseur, de temps en temps.
    later(8000, elevatorLoop);
  } else if (kind === 'games') {
    later(4000, arcadeLoop);
  } else {
    startBed(c, 'lowpass', 160, 0.02); // souffle chaud de la cheminée, très bas
    later(500, loungeLoop);
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
  if (hidden) {
    stopAmbience();
    stopSpot();
  } else if (wanted !== current) startAmbience(wanted);
}

// ---------------------------------------------------------------- Sons de proximité

/** Source sonore proche du joueur (le jeu choisit la plus proche). */
export type SpotSound = 'fire' | 'water';

let spotGain: GainNode | null = null;
let spotKind: SpotSound | null = null;
let spotNodes: AudioScheduledSourceNode[] = [];
let spotTimers: ReturnType<typeof setTimeout>[] = [];

function stopSpot(): void {
  for (const id of spotTimers) clearTimeout(id);
  spotTimers = [];
  for (const n of spotNodes) {
    try {
      n.stop();
    } catch {
      /* déjà arrêté */
    }
  }
  spotNodes = [];
  spotKind = null;
}

/** Feu de camp : crépitements irréguliers et un souffle grave. */
function fireLoop(): void {
  const c = ctx;
  if (!c || spotKind !== 'fire' || !spotGain) return;
  const buf = noiseBuffer(c, 0.01);
  const t0 = c.currentTime + 0.03;
  const pops = 3 + Math.floor(Math.random() * 7);
  for (let i = 0; i < pops; i++) {
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 2600;
    const g = c.createGain();
    g.gain.value = 0.03 + Math.random() * 0.05;
    src.connect(bp).connect(g).connect(spotGain);
    src.start(t0 + Math.random() * 0.9);
  }
  spotTimers.push(setTimeout(fireLoop, 500 + Math.random() * 900));
}

function startSpot(kind: SpotSound): void {
  stopSpot();
  const c = ctx;
  if (!c || !spotGain || paused || c.state !== 'running' || !settingsStore.get().ambience) return;
  spotKind = kind;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 3);
  src.loop = true;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  if (kind === 'fire') {
    f.type = 'lowpass';
    f.frequency.value = 220;
    g.gain.value = 0.06;
    spotTimers.push(setTimeout(fireLoop, 100));
  } else {
    // Eau qui ruisselle : bruit aigu filtré, avec un léger va-et-vient.
    f.type = 'bandpass';
    f.frequency.value = 1700;
    f.Q.value = 0.7;
    g.gain.value = 0.03;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.5;
    const depth = c.createGain();
    depth.gain.value = 0.008;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    spotNodes.push(lfo);
  }
  src.connect(f).connect(g).connect(spotGain);
  src.start();
  spotNodes.push(src);
}

/**
 * Son de la source la plus proche (`level` de 0, loin, à 1, tout près), ou aucune. Appelé
 * régulièrement par le jeu ; coupé avec l'ambiance (réglages) ou quand l'onglet est caché.
 */
export function setSpotSound(kind: SpotSound | null, level = 0): void {
  const c = ctx;
  if (!c || !ambienceGain) return;
  if (!spotGain) {
    spotGain = c.createGain();
    spotGain.gain.value = 0;
    spotGain.connect(ambienceGain);
  }
  const want = kind && level > 0 && !paused && settingsStore.get().ambience ? kind : null;
  if (want !== spotKind) {
    if (want) startSpot(want);
    else stopSpot();
  }
  spotGain.gain.setTargetAtTime(want ? Math.min(1, Math.max(0, level)) : 0, c.currentTime, 0.4);
}
