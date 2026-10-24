import { AmbienceWindow } from '../core/ambienceWindow';
import { settingsStore } from './settings';

/**
 * Sons du jeu, entièrement générés par le code (Web Audio) : aucun fichier à télécharger, comme
 * les graphismes. Volume discret, coupables dans les réglages.
 * - `playSound('message' | 'mention')` : arrivée d'un message (décidé par SoundGate) ;
 * - `setSpotSound(source, niveau)` : son d'une source proche (crépitement du feu de camp, eau de
 *   la fontaine), d'autant plus fort qu'on s'en approche ;
 * - `setAmbience(lieu)` : ambiance selon la zone (oiseaux et vent dehors, grillons la nuit
 *   avec `setNightSounds`, clavier au
 *   coworking, « ding » de l'ascenseur dans le hall, petites mélodies d'arcade de temps en temps
 *   dans la salle de jeux, cheminée et tasses au salon). Pas de fond sonore continu là où l'on
 *   passe le plus de temps : seulement des sons ponctuels, espacés. Ces bruitages ne jouent que
 *   les 10 premières secondes dans une pièce, puis s'éteignent doucement ; ils reviennent dans une
 *   autre pièce ou après 30 secondes d'absence (src/core/ambienceWindow.ts). Les sons de
 *   proximité (feu de camp, fontaine) et la musique de la ronde ne sont pas concernés.
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
/** Bruitages de la pièce : volume à part, pour les éteindre en douceur au bout de 10 s. */
let zoneGain: GainNode | null = null;
const roomWindow = new AmbienceWindow<Exclude<Ambience, null>>();
let windowTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
/** Le navigateur a-t-il déjà autorisé le son une première fois ? */
let unlocked = false;
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
  zoneGain = ctx.createGain();
  zoneGain.connect(ambienceGain);
  // Le son est autorisé un peu après le clic : on lance alors les bruitages de la pièce.
  ctx.addEventListener('statechange', () => refreshAmbience());
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
  if (!unlocked && c) {
    // Premier son autorisé : la pièce actuelle n'a encore rien fait entendre.
    unlocked = true;
    roomWindow.restart(Date.now());
  }
  refreshAmbience();
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
  else refreshAmbience();
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

/** La nuit (lot C) : les oiseaux dorment, on entend les grillons. */
let night = false;

/** Jour ou nuit à l'heure de Paris : change les sons du dehors au prochain cri. */
export function setNightSounds(on: boolean): void {
  night = on;
}

/** Grillons : quelques séries de petites stridulations aiguës, très douces. */
function cricketChirp(c: AudioContext): void {
  const t0 = c.currentTime + 0.05;
  const f = 4300 + Math.random() * 500;
  const series = 2 + Math.floor(Math.random() * 3);
  for (let s = 0; s < series; s++)
    for (let i = 0; i < 4; i++)
      tone(f, t0 + s * 0.42 + i * 0.045, 0.025, { gain: 0.012, out: zoneGain! });
}

function birdLoop(): void {
  const c = ctx;
  if (!c || current !== 'outdoor') return;
  if (night) {
    cricketChirp(c);
    later(1800 + Math.random() * 3500, birdLoop);
    return;
  }
  const t = c.currentTime + 0.05;
  const base = 2400 + Math.random() * 1600;
  const notes = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const f = base * (0.9 + Math.random() * 0.25);
    tone(f, t + i * 0.13, 0.09, { to: f * 1.25, gain: 0.025, out: zoneGain! });
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
    src.connect(hp).connect(g).connect(zoneGain!);
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
  src.connect(f).connect(g).connect(zoneGain!);
  src.start();
  bed.push(src);
}

/** Hall : « ding » discret de l'ascenseur de temps en temps. */
function elevatorLoop(): void {
  const c = ctx;
  if (!c || current !== 'hall') return;
  const t = c.currentTime + 0.05;
  tone(1046, t, 0.9, { type: 'sine', gain: 0.03, out: zoneGain! });
  tone(784, t + 0.35, 1.1, { type: 'sine', gain: 0.025, out: zoneGain! });
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
    tone(f, t + i * 0.11, 0.1, { type: 'square', gain: 0.008, out: zoneGain! });
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
    src.connect(bp).connect(g).connect(zoneGain!);
    src.start(t0 + Math.random() * 1.5);
  }
  if (Math.random() < 0.12) {
    const f = 2600 + Math.random() * 600;
    tone(f, t0 + 0.4, 0.25, { type: 'triangle', gain: 0.02, out: zoneGain! });
    tone(f * 1.5, t0 + 0.42, 0.2, { type: 'sine', gain: 0.012, out: zoneGain! });
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
  if (zoneGain) {
    zoneGain.gain.cancelScheduledValues(c.currentTime);
    zoneGain.gain.setValueAtTime(1, c.currentTime);
  }
  if (kind === 'outdoor') {
    startBed(c, 'lowpass', 380, 0.05); // vent
    later(800, birdLoop);
  } else if (kind === 'coworking') {
    later(600, keyboardLoop);
  } else if (kind === 'hall') {
    // Plus de brouhaha continu (jugé pénible) : seulement l'ascenseur, de temps en temps.
    later(1500, elevatorLoop);
  } else if (kind === 'games') {
    later(1200, arcadeLoop);
  } else {
    startBed(c, 'lowpass', 160, 0.02); // souffle chaud de la cheminée, très bas
    later(500, loungeLoop);
  }
}

/**
 * Joue ou éteint les bruitages selon la fenêtre de la pièce : au bout des 10 secondes, ils
 * baissent doucement puis s'arrêtent.
 */
function refreshAmbience(): void {
  if (windowTimer) clearTimeout(windowTimer);
  windowTimer = null;
  const now = Date.now();
  if (!roomWindow.playing(now)) {
    fadeOutAmbience();
    return;
  }
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = null;
  if (wanted !== current) startAmbience(wanted);
  windowTimer = setTimeout(refreshAmbience, roomWindow.end - now);
}

function fadeOutAmbience(): void {
  const c = ctx;
  if (!current || !c || !zoneGain || fadeTimer) return;
  zoneGain.gain.setTargetAtTime(0, c.currentTime, 0.5);
  fadeTimer = setTimeout(() => {
    fadeTimer = null;
    if (!roomWindow.playing(Date.now())) stopAmbience();
  }, 2500);
}

/** Ambiance du lieu où se trouve le joueur (appelée à chaque changement de zone). */
export function setAmbience(kind: Ambience): void {
  if (kind === wanted) return;
  wanted = kind;
  roomWindow.enter(kind, Date.now());
  // Nouvelle pièce : ses bruitages repartent de zéro (pas de fondu de l'ancienne).
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = null;
  if (current && current !== kind) stopAmbience();
  refreshAmbience();
}

/** Onglet caché : on coupe l'ambiance (et on la reprend au retour, si sa fenêtre dure encore). */
export function setAudioPaused(hidden: boolean): void {
  paused = hidden;
  if (hidden) {
    stopAmbience();
    stopSpot();
  } else refreshAmbience();
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

// ---------------------------------------------------------------- Musique de la ronde

/**
 * Petite boucle disco-house fabriquée par le jeu (aucun fichier) : grosse caisse à chaque temps,
 * claps sur 2 et 4, charleston entre les temps, basse qui saute d'octave et accords en la
 * mineur. Jouée près de la ronde des Malinos quand quelqu'un y danse, plus fort si l'on danse.
 */
const BPM = 122;
const STEP = 60 / BPM / 4; // une double croche
/** Basse sur 16 pas (fréquences, 0 = silence). */
const BASS = [55, 0, 110, 0, 55, 0, 110, 0, 65.4, 0, 130.8, 0, 49, 0, 98, 98];
/** Accords (4 mesures) : Lam7, Fa maj7, Do, Sol. */
const CHORDS = [
  [220, 261.6, 329.6, 392],
  [174.6, 220, 261.6, 329.6],
  [261.6, 329.6, 392, 493.9],
  [196, 246.9, 293.7, 392],
];

let discoGain: GainNode | null = null;
let discoTimer: ReturnType<typeof setInterval> | null = null;
let discoNext = 0;
let discoStep = 0;
let discoLevel = 0;
let discoIdleSince = 0;
let noiseShort: AudioBuffer | null = null;

function discoVoice(
  c: AudioContext,
  t: number,
  kind: 'kick' | 'clap' | 'hat' | 'bass' | 'stab',
  f = 0,
): void {
  const out = discoGain!;
  if (kind === 'kick') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.3);
    return;
  }
  if (kind === 'clap' || kind === 'hat') {
    noiseShort ??= noiseBuffer(c, 0.25);
    const src = c.createBufferSource();
    src.buffer = noiseShort;
    const f2 = c.createBiquadFilter();
    f2.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f2.frequency.value = kind === 'hat' ? 7000 : 1500;
    const g = c.createGain();
    const len = kind === 'hat' ? 0.05 : 0.16;
    g.gain.setValueAtTime(kind === 'hat' ? 0.09 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f2).connect(g).connect(out);
    src.start(t);
    src.stop(t + len + 0.02);
    return;
  }
  // Basse (dent de scie filtrée) ou accord (triangle doux).
  const o = c.createOscillator();
  o.type = kind === 'bass' ? 'sawtooth' : 'triangle';
  o.frequency.value = f;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = kind === 'bass' ? 700 : 2200;
  const g = c.createGain();
  const len = kind === 'bass' ? STEP * 0.9 : STEP * 3;
  const peak = kind === 'bass' ? 0.12 : 0.035;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
}

function discoTick(): void {
  const c = ctx;
  if (!c || !discoGain) return;
  // Silence depuis un moment : on arrête l'horloge (rien ne tourne pour rien).
  if (discoLevel <= 0 && c.currentTime - discoIdleSince > 3) {
    if (discoTimer) clearInterval(discoTimer);
    discoTimer = null;
    return;
  }
  while (discoNext < c.currentTime + 0.12) {
    const t = Math.max(discoNext, c.currentTime + 0.01);
    const i = discoStep % 16;
    const bar = Math.floor(discoStep / 16) % 4;
    if (i % 4 === 0) discoVoice(c, t, 'kick');
    if (i === 4 || i === 12) discoVoice(c, t, 'clap');
    if (i % 4 === 2) discoVoice(c, t, 'hat');
    const b = BASS[i]!;
    if (b) discoVoice(c, t, 'bass', b);
    if (i === 2 || i === 10) for (const f of CHORDS[bar]!) discoVoice(c, t, 'stab', f);
    discoNext += STEP;
    discoStep++;
  }
}

/** Volume de la musique de la ronde : 0 (coupée) à 1 (on danse au milieu). */
export function setDiscoLevel(level: number): void {
  const c = ctx;
  if (!c || !master) return;
  const want = paused || !settingsStore.get().ambience ? 0 : Math.min(1, Math.max(0, level));
  if (!discoGain) {
    discoGain = c.createGain();
    discoGain.gain.value = 0;
    discoGain.connect(master);
  }
  if (want > 0 && !discoTimer && c.state === 'running') {
    discoNext = c.currentTime + 0.05;
    discoTimer = setInterval(discoTick, 25);
  }
  if (want <= 0 && discoLevel > 0) discoIdleSince = c.currentTime;
  discoLevel = want;
  discoGain.gain.setTargetAtTime(want * 0.55, c.currentTime, 0.3);
}
