import type { Facing } from '../../core/iso';
import { facesCamera, rotateFacing, rotationForFacing } from '../../core/rotation';
import {
  BOTTOM_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  TOP_COLORS,
  type AvatarAppearance,
} from '../../content/avatars';
import { darken, lighten } from './color';
import { IsoBuilder, type Decal } from './iso3d';
import { PALETTE as P } from './palette';

export type AvatarPose = 'idle' | 'walkA' | 'walkB' | 'sit';
export const AVATAR_POSES: readonly AvatarPose[] = ['idle', 'walkA', 'walkB', 'sit'];
export const AVATAR_FACINGS: readonly Facing[] = ['py', 'px', 'ny', 'nx'];

/** Échelle globale des personnages (1 = gabarit de base). */
const K = 1.32;
/** Hauteur monde (z) de l'assise prévue dans la pose « sit ». */
export const SIT_HEIGHT = 0.42;

interface Dims {
  tw: number;
  td: number;
}

const BODY: Dims[] = [
  { tw: 0.15, td: 0.085 },
  { tw: 0.13, td: 0.08 },
  { tw: 0.175, td: 0.1 },
];

/**
 * Construit un avatar en boîtes, orientation canonique +y puis rotation.
 * Les dimensions sont exprimées avant l'échelle K.
 */
function buildAvatar(a: AvatarAppearance, facing: Facing, pose: AvatarPose): IsoBuilder {
  const b = new IsoBuilder(rotationForFacing(facing), 0, 0);
  const skin = SKIN_TONES[a.skin]!;
  const hairC = HAIR_COLORS[a.hairColor]!;
  const top = TOP_COLORS[a.top]!;
  const bottom = BOTTOM_COLORS[a.bottom]!;
  const { tw, td } = BODY[a.body] ?? BODY[0]!;

  const B = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    decals?: Decal[],
  ) =>
    b.box({
      x: x * K,
      y: y * K,
      z: z * K,
      w: w * K,
      d: d * K,
      h: h * K,
      color,
      ...(decals ? { decals } : {}),
    });

  const swing = pose === 'walkA' ? 1 : pose === 'walkB' ? -1 : 0;
  const bob = swing !== 0 ? 0.012 : 0;
  const sitting = pose === 'sit';
  // Hauteur des hanches : l'assise d'une chaise en pose assise.
  const hip = sitting ? SIT_HEIGHT / K : 0.4;
  const legW = 0.1;
  const legD = 0.11;
  const shoe = darken(bottom, 0.45);

  // Jambes
  for (const side of [-1, 1]) {
    const lx = side < 0 ? -0.115 : 0.015;
    if (sitting) {
      B(lx, -0.06, hip - 0.1, legW, 0.32, 0.1, bottom);
      B(lx, 0.17, 0.05, legW, legD, hip - 0.15, bottom);
      B(lx, 0.16, 0, legW, legD + 0.04, 0.06, shoe);
    } else {
      const dy = swing * side * 0.06;
      B(lx, -legD / 2 + dy, 0.05, legW, legD, hip - 0.05 + bob, bottom);
      B(lx, -legD / 2 + dy + 0.01, 0, legW, legD + 0.02, 0.06, shoe);
    }
  }

  const z0 = hip + bob;
  // Torse avec col et ceinture
  B(-tw, -td, z0, tw * 2, td * 2, 0.4, top, [
    { face: 'py', u0: 0.38, v0: 0.86, u1: 0.62, v1: 1, color: lighten(top, 0.25) },
    { face: 'py', u0: 0, v0: 0, u1: 1, v1: 0.08, color: darken(bottom, 0.2) },
    { face: 'px', u0: 0, v0: 0, u1: 1, v1: 0.08, color: darken(bottom, 0.2) },
  ]);
  // Bras
  for (const side of [-1, 1]) {
    const ax = side < 0 ? -tw - 0.075 : tw;
    const dy = sitting ? 0.04 : -swing * side * 0.05;
    B(ax, -0.05 + dy, z0 + 0.1, 0.075, 0.1, 0.28, top);
    B(ax, -0.05 + dy, z0 + 0.04, 0.075, 0.1, 0.06, skin);
  }
  // Tête et visage
  const hz = z0 + 0.42;
  const face: Decal[] = [
    { face: 'py', u0: 0.22, v0: 0.4, u1: 0.36, v1: 0.6, color: '#1d1f2b' },
    { face: 'py', u0: 0.64, v0: 0.4, u1: 0.78, v1: 0.6, color: '#1d1f2b' },
    { face: 'py', u0: 0.42, v0: 0.2, u1: 0.58, v1: 0.25, color: darken(skin, 0.3) },
    { face: 'py', u0: 0.12, v0: 0.26, u1: 0.24, v1: 0.34, color: lighten('#f08a8a', 0.3) },
    { face: 'py', u0: 0.76, v0: 0.26, u1: 0.88, v1: 0.34, color: lighten('#f08a8a', 0.3) },
  ];
  if (a.accessory === 1) {
    face.push(
      { face: 'py', u0: 0.16, v0: 0.36, u1: 0.42, v1: 0.42, color: P.ink },
      { face: 'py', u0: 0.58, v0: 0.36, u1: 0.84, v1: 0.42, color: P.ink },
      { face: 'py', u0: 0.42, v0: 0.52, u1: 0.58, v1: 0.56, color: P.ink },
      { face: 'py', u0: 0.16, v0: 0.6, u1: 0.42, v1: 0.64, color: P.ink },
      { face: 'py', u0: 0.58, v0: 0.6, u1: 0.84, v1: 0.64, color: P.ink },
    );
  }
  B(-0.135, -0.125, hz, 0.27, 0.25, 0.28, skin, face);
  drawHair(B, a.hair, hairC, hz);
  if (a.accessory === 2) drawHeadphones(B, a.hair, hz, facing);
  return b;
}

export type BoxFn = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  decals?: Decal[],
) => void;

/**
 * Volume extérieur de chaque coiffure (demi-largeur en x, sommet au-dessus de
 * la base de la tête). Les accessoires portés sur la tête s'appuient dessus
 * pour ne jamais passer « à travers » les cheveux.
 */
export const HAIR_BOUNDS: ReadonlyArray<{ halfWidth: number; top: number }> = [
  { halfWidth: 0.145, top: 0.31 }, // court
  { halfWidth: 0.15, top: 0.32 }, // long
  { halfWidth: 0.145, top: 0.31 }, // chignon (le chignon est derrière l'arceau)
  { halfWidth: 0.17, top: 0.35 }, // boucles
  { halfWidth: 0.14, top: 0.29 }, // rasé
  { halfWidth: 0.15, top: 0.32 }, // casquette
  { halfWidth: 0.145, top: 0.31 }, // queue de cheval
  { halfWidth: 0.135, top: 0.28 }, // aucun
];

/**
 * Casque audio : écouteurs et arceau posés à l'extérieur de la coiffure.
 * Seul l'écouteur du côté de la caméra est dessiné : l'autre est caché par la tête, et le
 * dessiner donnait l'impression de le voir à travers le crâne quand le personnage est de dos.
 */
function drawHeadphones(B: BoxFn, hairStyle: number, hz: number, facing: Facing): void {
  const { halfWidth: hw, top } = HAIR_BOUNDS[hairStyle] ?? HAIR_BOUNDS[0]!;
  const cup = 0.045;
  const band = 0.03;
  const bandTop = hz + top;
  const rot = rotationForFacing(facing);
  // Écouteur à hauteur de l'oreille, juste à l'extérieur des cheveux, côté caméra.
  if (facesCamera(rotateFacing('nx', rot))) B(-hw - cup, -0.05, hz + 0.07, cup, 0.12, 0.15, P.ink);
  if (facesCamera(rotateFacing('px', rot))) B(hw, -0.05, hz + 0.07, cup, 0.12, 0.15, P.ink);
  // Montants et arceau, légèrement en avant du sommet (devant un chignon).
  B(-hw - band, 0.075, hz + 0.2, band, 0.04, bandTop - (hz + 0.2), P.ink);
  B(hw, 0.075, hz + 0.2, band, 0.04, bandTop - (hz + 0.2), P.ink);
  B(-hw - band, 0.075, bandTop, (hw + band) * 2, 0.04, 0.035, P.ink);
}

export function drawHair(B: BoxFn, style: number, c: string, hz: number): void {
  const top = hz + 0.28;
  switch (style) {
    case 0: // court
      B(-0.145, -0.135, top - 0.05, 0.29, 0.27, 0.08, c);
      B(-0.145, -0.135, hz + 0.1, 0.29, 0.08, 0.15, c);
      B(-0.145, -0.06, hz + 0.16, 0.03, 0.18, 0.09, c);
      B(0.115, -0.06, hz + 0.16, 0.03, 0.18, 0.09, c);
      break;
    case 1: // long
      B(-0.15, -0.14, top - 0.05, 0.3, 0.28, 0.09, c);
      B(-0.15, -0.14, hz - 0.12, 0.3, 0.1, 0.38, c);
      B(-0.15, -0.04, hz - 0.06, 0.035, 0.18, 0.32, c);
      B(0.115, -0.04, hz - 0.06, 0.035, 0.18, 0.32, c);
      B(-0.15, 0.1, top - 0.08, 0.3, 0.035, 0.06, c);
      break;
    case 2: // chignon
      B(-0.145, -0.135, top - 0.05, 0.29, 0.27, 0.08, c);
      B(-0.145, -0.135, hz + 0.08, 0.29, 0.08, 0.17, c);
      B(-0.07, -0.07, top + 0.03, 0.14, 0.14, 0.11, c);
      break;
    case 3: // boucles
      B(-0.17, -0.155, top - 0.07, 0.34, 0.31, 0.14, c);
      B(-0.17, -0.155, hz + 0.04, 0.34, 0.1, 0.2, c);
      B(-0.17, -0.06, hz + 0.08, 0.04, 0.2, 0.16, c);
      B(0.13, -0.06, hz + 0.08, 0.04, 0.2, 0.16, c);
      break;
    case 4: // rasé
      B(-0.14, -0.13, top - 0.02, 0.28, 0.26, 0.03, darken(c, 0.1));
      break;
    case 5: // casquette
      B(-0.15, -0.14, top - 0.06, 0.3, 0.28, 0.1, c);
      B(-0.12, 0.13, top - 0.06, 0.24, 0.1, 0.03, darken(c, 0.15));
      B(-0.145, -0.135, hz + 0.1, 0.29, 0.06, 0.12, c);
      break;
    case 6: // queue de cheval
      B(-0.145, -0.135, top - 0.05, 0.29, 0.27, 0.08, c);
      B(-0.145, -0.135, hz + 0.1, 0.29, 0.08, 0.15, c);
      B(-0.05, -0.2, hz - 0.06, 0.1, 0.07, 0.3, c);
      break;
    default: // aucun
      break;
  }
}

export interface AvatarSheet {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  /** Ancre (pieds) dans chaque cadre, en px. */
  anchorX: number;
  anchorY: number;
  scale: number;
  /** Nom du cadre → position dans la feuille. */
  frames: Array<{ name: string; x: number; y: number }>;
}

export function frameName(facing: Facing, pose: AvatarPose): string {
  return `${facing}:${pose}`;
}

/** Feuille de sprites complète d'une apparence (16 cadres). */
export function renderAvatarSheet(a: AvatarAppearance, scale: number): AvatarSheet {
  const renders = AVATAR_FACINGS.flatMap((f) =>
    AVATAR_POSES.map((p) => ({ name: frameName(f, p), r: buildAvatar(a, f, p).render(scale) })),
  );
  const anchorX = Math.max(...renders.map(({ r }) => r.anchorX));
  const anchorY = Math.max(...renders.map(({ r }) => r.anchorY));
  const frameW = anchorX + Math.max(...renders.map(({ r }) => r.canvas.width - r.anchorX));
  const frameH = anchorY + Math.max(...renders.map(({ r }) => r.canvas.height - r.anchorY));
  const cols = AVATAR_POSES.length;
  const canvas = document.createElement('canvas');
  canvas.width = frameW * cols;
  canvas.height = frameH * AVATAR_FACINGS.length;
  const ctx = canvas.getContext('2d')!;
  const frames = renders.map(({ name, r }, i) => {
    const x = (i % cols) * frameW;
    const y = Math.floor(i / cols) * frameH;
    ctx.drawImage(r.canvas, x + anchorX - r.anchorX, y + anchorY - r.anchorY);
    return { name, x, y };
  });
  return { canvas, frameW, frameH, anchorX, anchorY, scale, frames };
}

/** Aperçu d'un avatar pour l'interface (éditeur, liste des présents). */
export function renderAvatarPreview(
  a: AvatarAppearance,
  facing: Facing = 'py',
  scale = 3,
): HTMLCanvasElement {
  return buildAvatar(a, facing, 'idle').render(scale, 4).canvas;
}
