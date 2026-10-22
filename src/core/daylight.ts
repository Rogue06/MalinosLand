/**
 * Jour et nuit à l'heure de Paris (lot C, DEC-028), calculés dans le navigateur.
 *
 * Le lever et le coucher du soleil suivent la saison (calcul astronomique simplifié pour la
 * latitude de Paris, précis à une dizaine de minutes près), et l'heure d'été est prise en compte
 * grâce au fuseau `Europe/Paris`. Logique pure : aucun accès au DOM ni à Phaser.
 */

/** Latitude et longitude de Paris (degrés). */
const LAT = 48.857;
const LON = 2.352;

/** Heure de Paris (heures décimales), jour de l'année et décalage avec l'heure universelle. */
export interface ParisClock {
  hours: number;
  dayOfYear: number;
  utcOffset: number;
}

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

export function parisClock(date: Date): ParisClock {
  const parts = Object.fromEntries(FORMAT.formatToParts(date).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hours = Number(parts.hour) + Number(parts.minute) / 60;
  const local = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.round((local - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const utcOffset = Math.round((((hours - utcHours) % 24) + 24) % 24);
  return { hours, dayOfYear, utcOffset };
}

/** Lever et coucher du soleil à Paris (heures décimales, heure locale) pour un jour donné. */
export function sunTimes(dayOfYear: number, utcOffset: number): { rise: number; set: number } {
  const rad = Math.PI / 180;
  // Déclinaison du soleil, et angle horaire au lever (réfraction comprise : -0,83°).
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear + 284));
  const cosH =
    (Math.sin(-0.83 * rad) - Math.sin(LAT * rad) * Math.sin(decl * rad)) /
    (Math.cos(LAT * rad) * Math.cos(decl * rad));
  const halfDay = Math.acos(Math.min(1, Math.max(-1, cosH))) / rad / 15;
  // Équation du temps (minutes), pour un midi solaire juste à quelques minutes près.
  const b = ((2 * Math.PI) / 364) * (dayOfYear - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const noon = 12 - LON / 15 - eot / 60 + utcOffset;
  return { rise: noon - halfDay, set: noon + halfDay };
}

export type SkyPhase = 'nuit' | 'aube' | 'jour' | 'crepuscule';

/** Ce que le jeu affiche à un instant donné. */
export interface Sky {
  phase: SkyPhase;
  /**
   * Couleur par laquelle on multiplie l'image (blanc = rien ne change) : rosée à l'aube, orangée
   * au coucher, bleu nuit la nuit.
   */
  tint: number;
  /** Lampes, réverbères et feu : 0 éteints (jour) à 1 pleinement allumés (nuit). */
  lights: number;
  /** 0 en plein jour, 1 en pleine nuit (étoiles, lucioles, grillons). */
  night: number;
}

/** Repères de la journée, relatifs au lever (R) et au coucher (S) du soleil. */
interface Key {
  at: number;
  tint: number;
  lights: number;
  night: number;
}

const NIGHT = 0x5d6db0;
const DAWN = 0xffcfd8;
const DAY = 0xffffff;
const DUSK = 0xffb27a;

function keys(rise: number, set: number): Key[] {
  return [
    { at: rise - 1.25, tint: NIGHT, lights: 1, night: 1 },
    { at: rise - 0.25, tint: DAWN, lights: 0.6, night: 0.3 },
    { at: rise + 1, tint: DAY, lights: 0, night: 0 },
    { at: set - 1, tint: DAY, lights: 0, night: 0 },
    { at: set, tint: DUSK, lights: 0.5, night: 0.15 },
    { at: set + 1.25, tint: NIGHT, lights: 1, night: 1 },
  ];
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/** Ciel pour une heure locale donnée (heures décimales) et les heures du soleil de ce jour. */
export function skyAt(hours: number, sun: { rise: number; set: number }): Sky {
  const list = keys(sun.rise, sun.set);
  const first = list[0]!;
  const last = list[list.length - 1]!;
  const h = ((hours % 24) + 24) % 24;
  let value: Omit<Key, 'at'> = first;
  if (h >= first.at && h <= last.at) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i]!;
      const b = list[i + 1]!;
      if (h < a.at || h > b.at) continue;
      const t = b.at === a.at ? 0 : (h - a.at) / (b.at - a.at);
      value = {
        tint: mixColor(a.tint, b.tint, t),
        lights: a.lights + (b.lights - a.lights) * t,
        night: a.night + (b.night - a.night) * t,
      };
      break;
    }
  }
  let phase: SkyPhase = 'nuit';
  if (h >= sun.rise - 1.25 && h < sun.rise + 1) phase = 'aube';
  else if (h >= sun.rise + 1 && h < sun.set - 1) phase = 'jour';
  else if (h >= sun.set - 1 && h < sun.set + 1.25) phase = 'crepuscule';
  return { phase, ...value };
}

/** Ciel à Paris à cet instant (ou toujours de jour si le joueur l'a choisi). */
export function parisSky(date: Date, alwaysDay = false): Sky & { clock: ParisClock } {
  const clock = parisClock(date);
  if (alwaysDay) return { clock, phase: 'jour', tint: DAY, lights: 0, night: 0 };
  return { clock, ...skyAt(clock.hours, sunTimes(clock.dayOfYear, clock.utcOffset)) };
}

/** Atténue une teinte vers le blanc (intérieurs : nuit plus douce, lampes allumées). */
export function softenTint(tint: number, amount: number): number {
  return mixColor(tint, DAY, amount);
}
