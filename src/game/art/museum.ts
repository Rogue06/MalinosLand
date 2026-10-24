import { darken, lighten } from './color';
import type { Decal, IsoBuilder } from './iso3d';
import { PALETTE as P } from './palette';
import { posterCanvas } from './posters';

/**
 * Mobilier du Musée des Malinos (v0.4) : cimaises et stands qui portent chacun l'affiche d'un
 * projet (plaquée en perspective sur leur face avant), borne « Toutes les créations » et panneau
 * d'entrée. Un stand libre montre une affiche d'invitation.
 */

/** Dessin d'un stand avec son affiche (`poster` : canevas de src/game/art/posters.ts). */
export type StandArt = (b: IsoBuilder, variant: number, poster: CanvasImageSource) => void;

const decal = (
  face: Decal['face'],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  color: string,
): Decal => ({ face, u0, v0, u1, v1, color });

/** Rapport largeur / hauteur des affiches (POSTER_W / POSTER_H). */
const RATIO = 120 / 168;
const EPS = 0.004;

/** Petit projecteur fixé en haut d'un panneau, braqué sur l'affiche (bras fin, tête ronde). */
function spotlight(b: IsoBuilder, x: number, y: number, z: number) {
  b.box({ x: x - 0.015, y, z, w: 0.03, d: 0.14, h: 0.02, color: P.metal, outline: false });
  b.cylinder(x, y + 0.15, z - 0.07, 0.045, 0.08, P.metalDark);
  b.disc(x, y + 0.15, z - 0.071, 0.03, '#fff2c9');
}

export const STAND_ART: Record<'museum_wall' | 'museum_stand', StandArt> = {
  /** Cimaise contre le mur : grand panneau clair, affiche, cartel et projecteur. */
  museum_wall(b, v, poster) {
    const panel = v % 2 === 0 ? '#f4f1ea' : '#ece6da';
    b.box({
      x: 0.04,
      y: 0.42,
      z: 0,
      w: 0.92,
      d: 0.12,
      h: 1.55,
      color: panel,
      decals: [
        decal('py', 0, 0, 1, 0.05, darken(panel, 0.18)),
        // Cartel sous l'affiche.
        decal('py', 0.36, 0.1, 0.64, 0.16, '#d8d2c5'),
        decal('py', 0.4, 0.125, 0.6, 0.135, P.slate),
      ],
    });
    const w = 0.74;
    const h = w / RATIO;
    b.image({ x: 0.5 - w / 2, y: 0.54 + EPS, z: 0.3 }, 'py', w, h, poster);
    spotlight(b, 0.5, 0.54, 1.53);
  },
  /** Stand sur socle : présentoir vertical portant l'affiche, cartel sur le socle. */
  museum_stand(b, v, poster) {
    // Socle blanc à plinthe sombre, liseré de couleur au bord du plateau.
    b.box({
      x: 0.2,
      y: 0.2,
      z: 0,
      w: 0.6,
      d: 0.6,
      h: 0.34,
      color: '#f7f5f0',
      decals: [
        decal('py', 0, 0, 1, 0.1, '#cfc8bb'),
        decal('px', 0, 0, 1, 0.1, '#cfc8bb'),
        decal('top', 0.03, 0.9, 0.97, 0.96, [P.teal, P.violet, P.coral][v % 3]!),
      ],
    });
    // Pied et présentoir sombre, qui fait ressortir l'affiche.
    b.box({ x: 0.465, y: 0.44, z: 0.34, w: 0.07, d: 0.06, h: 0.1, color: P.metalDark });
    const w = 0.64;
    const h = w / RATIO;
    b.box({
      x: 0.5 - w / 2 - 0.03,
      y: 0.46,
      z: 0.44,
      w: w + 0.06,
      d: 0.05,
      h: h + 0.06,
      color: P.ink,
      top: lighten(P.ink, 0.25),
    });
    b.image({ x: 0.5 - w / 2, y: 0.51 + EPS, z: 0.47 }, 'py', w, h, poster);
  },
};

let emptyPoster: HTMLCanvasElement | null = null;
/** Affiche d'invitation, partagée par tous les stands libres. */
export function emptyPosterCanvas(): HTMLCanvasElement {
  return (emptyPoster ??= posterCanvas(null, 1));
}

/** Dessins du catalogue (stands libres) et des autres meubles du musée. */
export const MUSEUM_ART: Record<string, (b: IsoBuilder, variant: number) => void> = {
  museum_wall: (b, v) => STAND_ART.museum_wall(b, v, emptyPosterCanvas()),
  museum_stand: (b, v) => STAND_ART.museum_stand(b, v, emptyPosterCanvas()),
  /** Borne « Toutes les créations » : totem à écran montrant une mosaïque d'affiches. */
  museum_kiosk(b) {
    b.box({ x: 0.22, y: 0.3, z: 0, w: 0.56, d: 0.4, h: 0.08, color: P.ink });
    const tiles = [P.coral, P.teal, P.violet, P.sun, '#2f6fd6', P.leaf];
    const screen: Decal[] = [decal('py', 0.08, 0.3, 0.92, 0.9, '#0d1630')];
    tiles.forEach((c, i) => {
      const u = 0.14 + (i % 3) * 0.255;
      const v = i < 3 ? 0.62 : 0.36;
      screen.push(decal('py', u, v, u + 0.2, v + 0.22, c));
      screen.push(decal('py', u, v, u + 0.2, v + 0.05, darken(c, 0.35)));
    });
    screen.push(decal('py', 0.08, 0.06, 0.92, 0.2, P.teal));
    b.box({
      x: 0.26,
      y: 0.36,
      z: 0.08,
      w: 0.48,
      d: 0.24,
      h: 1.5,
      color: P.slate,
      decals: screen,
    });
    b.box({
      x: 0.24,
      y: 0.34,
      z: 1.58,
      w: 0.52,
      d: 0.28,
      h: 0.05,
      color: P.tealLight,
      outline: false,
    });
    b.text({ x: 0.5, y: 0.6, z: 0.27 }, 'py', 'CRÉATIONS', {
      size: 4.6,
      color: '#ffffff',
      weight: 900,
      fit: 0.42,
    });
  },
  /** Panneau d'entrée du musée, sur pied (cadre doré, lettres sur fond nuit). */
  sign_museum(b) {
    b.box({ x: 0.3, y: 0.44, z: 0, w: 0.4, d: 0.16, h: 0.05, color: P.ink });
    b.box({ x: 0.47, y: 0.49, z: 0.05, w: 0.06, d: 0.06, h: 0.7, color: '#b08d3c' });
    b.box({
      x: 0.08,
      y: 0.46,
      z: 0.72,
      w: 0.84,
      d: 0.08,
      h: 0.62,
      color: '#d9b25a',
      decals: [
        decal('py', 0.05, 0.07, 0.95, 0.93, P.night),
        decal('py', 0.2, 0.2, 0.8, 0.23, '#d9b25a'),
      ],
    });
    b.text({ x: 0.5, y: 0.55, z: 1.17 }, 'py', 'MUSÉE', {
      size: 6.5,
      color: '#ffe3a0',
      weight: 900,
      fit: 0.7,
    });
    b.text({ x: 0.5, y: 0.55, z: 0.99 }, 'py', 'DES MALINOS', {
      size: 4,
      color: '#ffffff',
      weight: 700,
      fit: 0.7,
    });
  },
};
