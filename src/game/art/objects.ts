import type { Vec3 } from '../../core/iso';
import { facesCamera, rotateFacing } from '../../core/rotation';
import { darken, lighten } from './color';
import type { BoxSpec, Decal, IsoBuilder } from './iso3d';
import { PALETTE as P } from './palette';

/**
 * Dessins procéduraux des objets du catalogue, en orientation canonique
 * (l'objet regarde +y, son empreinte commence en 0,0). Chaque fonction ne
 * fait que décrire des volumes : la rotation et le rendu sont gérés par IsoBuilder.
 */
export type ObjectArt = (b: IsoBuilder, variant: number) => void;

const box = (
  b: IsoBuilder,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  extra: Partial<BoxSpec> = {},
) => b.box({ x, y, z, w, d, h, color, ...extra });

const decal = (
  face: Decal['face'],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  color: string,
): Decal => ({
  face,
  u0,
  v0,
  u1,
  v1,
  color,
});

const pick = <T>(list: readonly T[], i: number): T =>
  list[((i % list.length) + list.length) % list.length]!;

function screenDecals(variant: number): Decal[] {
  const d: Decal[] = [decal('py', 0.06, 0.1, 0.94, 0.92, '#14294a')];
  if (variant % 3 === 0) {
    // Éditeur de code
    const lines: Array<[number, number, string]> = [
      [0.12, 0.5, P.tealLight],
      [0.18, 0.62, P.violet],
      [0.18, 0.44, P.coral],
      [0.12, 0.34, P.sun],
      [0.18, 0.7, P.tealLight],
      [0.24, 0.52, '#8fa8d8'],
    ];
    lines.forEach(([u0, u1, c], i) =>
      d.push(decal('py', u0, 0.78 - i * 0.11, u1, 0.83 - i * 0.11, c)),
    );
  } else if (variant % 3 === 1) {
    // Tableau de bord
    [0.35, 0.6, 0.45, 0.75, 0.55].forEach((h, i) =>
      d.push(
        decal(
          'py',
          0.14 + i * 0.15,
          0.18,
          0.24 + i * 0.15,
          0.18 + h * 0.7,
          i % 2 ? P.teal : P.violet,
        ),
      ),
    );
  } else {
    // Discussion avec une IA
    d.push(decal('py', 0.12, 0.62, 0.62, 0.8, '#2d4a78'));
    d.push(decal('py', 0.38, 0.38, 0.88, 0.56, P.teal));
    d.push(decal('py', 0.12, 0.16, 0.56, 0.32, '#2d4a78'));
  }
  return d;
}

function books(b: IsoBuilder, z: number, seed: number, x0 = 0.16, x1 = 0.84): void {
  const colors = [P.coral, P.teal, P.sun, P.violet, '#e8e1d2', '#4c78c9', '#d4507a', P.leaf];
  let x = x0;
  let i = seed;
  while (x < x1 - 0.06) {
    const w = 0.06 + ((i * 37) % 5) * 0.012;
    const h = 0.24 + ((i * 53) % 4) * 0.025;
    if (x + w > x1) break;
    box(b, x, 0.34, z, w, 0.36, h, pick(colors, i * 7 + seed), { outline: false });
    x += w + 0.008;
    i++;
  }
}

function plantCanopy(
  b: IsoBuilder,
  cx: number,
  cy: number,
  z: number,
  s: number,
  palette: string[],
): void {
  const parts: Array<[number, number, number, number, number]> = [
    [-0.2, -0.2, 0, 0.4, 0.26],
    [-0.26, -0.08, 0.12, 0.28, 0.22],
    [-0.02, -0.26, 0.16, 0.28, 0.24],
    [-0.12, -0.12, 0.3, 0.24, 0.2],
  ];
  parts.forEach(([dx, dy, dz, w, h], i) =>
    box(b, cx + dx * s, cy + dy * s, z + dz * s, w * s, w * s, h * s, pick(palette, i)),
  );
}

const LEAVES = [P.leaf, P.leafLight, P.leafDark, P.leaf];

/**
 * Dossier d'un siège : calque « front », affiché devant un personnage assis vu de dos (le reste
 * du siège passe derrière lui). Voir WorldRenderer et DEC-018.
 */
function backrest(b: IsoBuilder, draw: () => void): void {
  b.layer = 'front';
  draw();
  b.layer = 'base';
}

/** Accoudoir : devant le personnage assis de dos seulement s'il est du côté de la caméra. */
function armrest(b: IsoBuilder, side: 'nx' | 'px', draw: () => void): void {
  if (facesCamera(rotateFacing(side, b.rot))) backrest(b, draw);
  else draw();
}

export const OBJECT_ART: Record<string, ObjectArt> = {
  desk_pc(b, v) {
    box(b, 0.1, 0.18, 0, 0.07, 0.68, 0.62, P.metalDark);
    box(b, 1.83, 0.18, 0, 0.07, 0.68, 0.62, P.metalDark);
    box(b, 0.05, 0.12, 0.62, 1.9, 0.78, 0.06, P.woodLight);
    box(b, 0.25, 0.3, 0.68, 0.32, 0.24, 0.02, P.white, { outline: false });
    box(b, 0.95, 0.22, 0.68, 0.1, 0.08, 0.14, P.ink);
    box(b, 0.55, 0.2, 0.8, 0.9, 0.06, 0.52, P.ink, { decals: screenDecals(v) });
    box(b, 0.72, 0.5, 0.68, 0.56, 0.18, 0.03, '#cfd5e2');
    box(b, 1.38, 0.55, 0.68, 0.1, 0.14, 0.02, '#cfd5e2');
    b.cylinder(1.62, 0.36, 0.68, 0.055, 0.11, pick([P.coral, P.teal, P.sun], v));
  },
  chair(b, v) {
    const c = pick([P.slate, P.teal, P.coral], v);
    box(b, 0.32, 0.36, 0, 0.36, 0.36, 0.05, P.ink);
    b.cylinder(0.5, 0.54, 0.05, 0.035, 0.3, P.metal);
    box(b, 0.2, 0.28, 0.35, 0.6, 0.54, 0.08, c);
    backrest(b, () => box(b, 0.22, 0.2, 0.43, 0.56, 0.09, 0.5, c));
  },
  conf_chair(b) {
    box(b, 0.24, 0.3, 0, 0.05, 0.05, 0.36, P.woodDark);
    box(b, 0.71, 0.3, 0, 0.05, 0.05, 0.36, P.woodDark);
    box(b, 0.24, 0.72, 0, 0.05, 0.05, 0.36, P.woodDark);
    box(b, 0.71, 0.72, 0, 0.05, 0.05, 0.36, P.woodDark);
    box(b, 0.2, 0.26, 0.36, 0.6, 0.54, 0.07, P.violet);
    backrest(b, () => box(b, 0.2, 0.2, 0.43, 0.6, 0.08, 0.46, P.violet));
  },
  armchair(b, v) {
    const c = pick([P.teal, P.coral, P.sun], v);
    box(b, 0.1, 0.12, 0, 0.8, 0.8, 0.3, c);
    backrest(b, () => box(b, 0.1, 0.1, 0.3, 0.8, 0.18, 0.44, c));
    armrest(b, 'nx', () => box(b, 0.1, 0.28, 0.3, 0.14, 0.64, 0.16, darken(c, 0.05)));
    armrest(b, 'px', () => box(b, 0.76, 0.28, 0.3, 0.14, 0.64, 0.16, darken(c, 0.05)));
    box(b, 0.24, 0.3, 0.3, 0.52, 0.6, 0.06, lighten(c, 0.12));
  },
  sofa(b, v) {
    const c = pick([P.coral, P.teal, P.violet], v);
    box(b, 0.06, 0.12, 0, 1.88, 0.8, 0.3, c);
    backrest(b, () => box(b, 0.06, 0.1, 0.3, 1.88, 0.2, 0.44, c));
    armrest(b, 'nx', () => box(b, 0.06, 0.3, 0.3, 0.16, 0.62, 0.16, darken(c, 0.05)));
    armrest(b, 'px', () => box(b, 1.78, 0.3, 0.3, 0.16, 0.62, 0.16, darken(c, 0.05)));
    box(b, 0.24, 0.32, 0.3, 0.74, 0.58, 0.06, lighten(c, 0.12));
    box(b, 1.02, 0.32, 0.3, 0.74, 0.58, 0.06, lighten(c, 0.12));
    box(b, 0.3, 0.22, 0.36, 0.3, 0.1, 0.22, P.sun);
  },
  pingpong(b) {
    for (const [x, y] of [
      [0.2, 0.25],
      [1.75, 0.25],
      [0.2, 0.7],
      [1.75, 0.7],
    ] as const)
      box(b, x, y, 0, 0.05, 0.05, 0.6, P.metalDark);
    box(b, 0.1, 0.15, 0.6, 1.8, 0.7, 0.04, '#2f6fb3', {
      decals: [decal('top', 0.49, 0, 0.51, 1, P.white), decal('top', 0, 0.48, 1, 0.52, P.white)],
    });
    box(b, 0.97, 0.12, 0.64, 0.06, 0.76, 0.1, '#e9e4dc', { outline: false });
    box(b, 0.4, 0.4, 0.64, 0.12, 0.1, 0.02, P.coral);
    b.cylinder(1.4, 0.55, 0.64, 0.03, 0.05, P.white);
  },
  foosball(b) {
    box(b, 0.2, 0.3, 0, 0.08, 0.08, 0.5, P.woodDark);
    box(b, 1.72, 0.3, 0, 0.08, 0.08, 0.5, P.woodDark);
    box(b, 0.2, 0.62, 0, 0.08, 0.08, 0.5, P.woodDark);
    box(b, 1.72, 0.62, 0, 0.08, 0.08, 0.5, P.woodDark);
    box(b, 0.12, 0.2, 0.5, 1.76, 0.6, 0.24, P.wood, { top: P.leaf });
    for (let i = 0; i < 4; i++)
      box(b, 0.35 + i * 0.4, 0.05, 0.66, 0.04, 0.9, 0.04, P.metal, { outline: false });
    for (let i = 0; i < 4; i++)
      box(b, 0.32 + i * 0.4, 0.45, 0.6, 0.1, 0.08, 0.14, i % 2 ? P.coral : '#3e6fd1', {
        outline: false,
      });
  },
  chess_table(b) {
    b.cylinder(0.5, 0.5, 0, 0.18, 0.04, P.ink);
    b.cylinder(0.5, 0.5, 0.04, 0.05, 0.5, P.woodDark);
    box(b, 0.14, 0.14, 0.54, 0.72, 0.72, 0.06, P.wood, {
      decals: Array.from({ length: 16 }, (_, i) => {
        const x = (i % 4) * 0.25;
        const y = Math.floor(i / 4) * 0.25;
        return decal(
          'top',
          x + (Math.floor(i / 4) % 2) * 0.125,
          y,
          x + 0.125 + (Math.floor(i / 4) % 2) * 0.125,
          y + 0.125,
          '#3a2a1c',
        );
      }),
    });
    box(b, 0.3, 0.3, 0.6, 0.06, 0.06, 0.12, P.white);
    box(b, 0.62, 0.6, 0.6, 0.06, 0.06, 0.14, P.ink);
  },
  beanbag(b, v) {
    const c = pick([P.coral, P.teal, P.sun, P.violet], v);
    box(b, 0.14, 0.14, 0, 0.72, 0.72, 0.2, c);
    box(b, 0.22, 0.22, 0.2, 0.56, 0.56, 0.06, lighten(c, 0.1));
    box(b, 0.18, 0.12, 0.2, 0.64, 0.18, 0.24, darken(c, 0.06));
  },
  flowers(b, v) {
    const colors = [P.coral, P.sun, '#f2a7c3', P.violet, P.white];
    for (let i = 0; i < 7; i++) {
      const x = 0.12 + ((i * 37 + v * 13) % 70) / 100;
      const y = 0.12 + ((i * 53 + v * 29) % 70) / 100;
      box(b, x + 0.03, y + 0.03, 0, 0.02, 0.02, 0.08, P.leafDark, { outline: false });
      box(b, x, y, 0.08, 0.08, 0.08, 0.04, pick(colors, i + v), { outline: false });
    }
  },
  rock(b, v) {
    const c = pick(['#9a948a', '#8b8579', '#a8a397'], v);
    box(b, 0.18, 0.22, 0, 0.62, 0.5, 0.22, c);
    box(b, 0.28, 0.3, 0.22, 0.38, 0.32, 0.14, lighten(c, 0.08));
    box(b, 0.62, 0.55, 0, 0.22, 0.22, 0.12, darken(c, 0.06));
  },
  mushrooms(b) {
    for (const [x, y, s] of [
      [0.25, 0.3, 1],
      [0.6, 0.25, 0.8],
      [0.7, 0.6, 1.1],
      [0.3, 0.65, 0.7],
      [0.48, 0.45, 0.9],
    ] as const) {
      box(b, x, y, 0, 0.05 * s, 0.05 * s, 0.1 * s, '#f1ede6', { outline: false });
      box(b, x - 0.04 * s, y - 0.04 * s, 0.1 * s, 0.13 * s, 0.13 * s, 0.05 * s, '#d9483b', {
        outline: false,
      });
    }
  },
  log(b) {
    box(b, 0.1, 0.3, 0, 1.8, 0.42, 0.3, '#7a5236', { top: '#c9a172' });
    box(b, 0.1, 0.3, 0.3, 0.16, 0.42, 0.02, '#e2c08f', { outline: false });
  },
  campfire(b) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(b, 0.44 + Math.cos(a) * 0.3, 0.44 + Math.sin(a) * 0.3, 0, 0.12, 0.12, 0.1, '#8f897d');
    }
    box(b, 0.3, 0.45, 0.04, 0.4, 0.1, 0.08, '#6b4a2f');
    box(b, 0.45, 0.3, 0.06, 0.1, 0.4, 0.08, '#7a5236');
    box(b, 0.4, 0.4, 0.12, 0.2, 0.2, 0.16, '#ff8a3d', { outline: false });
    box(b, 0.45, 0.45, 0.22, 0.1, 0.1, 0.14, '#ffd25e', { outline: false });
  },
  pond(b) {
    const stone = '#b9b2a4';
    b.poly(
      [
        { x: 0.3, y: 0.3, z: 0.12 },
        { x: 2.7, y: 0.3, z: 0.12 },
        { x: 2.7, y: 2.7, z: 0.12 },
        { x: 0.3, y: 2.7, z: 0.12 },
      ],
      P.water,
    );
    box(b, 0.15, 0.15, 0, 2.7, 0.18, 0.2, stone);
    box(b, 0.15, 0.33, 0, 0.18, 2.34, 0.2, stone);
    box(b, 2.67, 0.33, 0, 0.18, 2.34, 0.2, stone);
    box(b, 0.15, 2.67, 0, 2.7, 0.18, 0.2, stone);
    b.disc(0.9, 1.0, 0.13, 0.2, P.leaf);
    b.disc(1.9, 1.7, 0.13, 0.24, P.leafDark);
    b.disc(1.4, 2.1, 0.13, 0.16, P.leaf);
    box(b, 1.82, 1.6, 0.13, 0.08, 0.08, 0.05, '#f2a7c3', { outline: false });
    // Roseaux dans un coin et un rocher.
    for (const [x, y, h] of [
      [2.3, 0.45, 0.6],
      [2.45, 0.55, 0.75],
      [2.2, 0.6, 0.5],
    ] as const)
      box(b, x, y, 0.12, 0.05, 0.05, h, P.leafDark, { outline: false });
    box(b, 0.45, 2.15, 0.08, 0.3, 0.26, 0.18, '#8f897d');
  },
  telescope(b) {
    box(b, 0.3, 0.35, 0, 0.05, 0.05, 0.6, P.metalDark);
    box(b, 0.65, 0.35, 0, 0.05, 0.05, 0.6, P.metalDark);
    box(b, 0.48, 0.7, 0, 0.05, 0.05, 0.6, P.metalDark);
    box(b, 0.42, 0.45, 0.6, 0.18, 0.18, 0.1, P.ink);
    box(b, 0.44, 0.2, 0.68, 0.14, 0.56, 0.14, P.violet);
    box(b, 0.42, 0.14, 0.66, 0.18, 0.08, 0.18, P.metal);
  },
  cat(b) {
    // Petit coussin et chat roulé en boule, la queue autour.
    box(b, 0.15, 0.2, 0, 0.7, 0.62, 0.1, P.violet);
    box(b, 0.28, 0.32, 0.1, 0.44, 0.36, 0.17, '#e8964f');
    box(b, 0.58, 0.3, 0.12, 0.2, 0.2, 0.16, '#e8964f');
    box(b, 0.61, 0.3, 0.28, 0.05, 0.05, 0.05, '#e8964f');
    box(b, 0.72, 0.3, 0.28, 0.05, 0.05, 0.05, '#e8964f');
    box(b, 0.3, 0.6, 0.1, 0.36, 0.08, 0.06, '#c9733a');
    box(b, 0.34, 0.36, 0.27, 0.3, 0.06, 0.02, '#c9733a', { outline: false });
  },
  dirt_mound(b) {
    box(b, 0.18, 0.2, 0, 0.64, 0.6, 0.12, '#7a5233');
    box(b, 0.3, 0.3, 0.12, 0.4, 0.38, 0.08, '#8c6040');
    // Une pelle plantée dans la terre.
    box(b, 0.62, 0.42, 0.2, 0.04, 0.04, 0.42, P.woodDark);
    box(b, 0.58, 0.4, 0.06, 0.12, 0.08, 0.16, P.metal);
  },
  gnome(b) {
    box(b, 0.36, 0.38, 0, 0.28, 0.24, 0.1, P.metalDark);
    box(b, 0.38, 0.4, 0.1, 0.24, 0.2, 0.2, '#3e6fd1');
    box(b, 0.4, 0.42, 0.3, 0.2, 0.16, 0.12, '#f1c9a5');
    box(b, 0.41, 0.52, 0.22, 0.18, 0.08, 0.14, P.white);
    box(b, 0.39, 0.4, 0.42, 0.22, 0.2, 0.08, P.coral);
    box(b, 0.43, 0.44, 0.5, 0.14, 0.12, 0.08, P.coral);
    box(b, 0.47, 0.48, 0.58, 0.06, 0.05, 0.08, P.coral);
  },
  bed(b, v) {
    const cover = pick([P.teal, P.violet, P.coral], v);
    // Tête de lit contre le mur, cadre en bois, matelas, couette et deux oreillers.
    box(b, 0.06, 0.04, 0, 1.88, 0.12, 0.86, P.woodDark);
    box(b, 0.06, 0.16, 0, 1.88, 1.78, 0.26, P.wood);
    box(b, 0.12, 0.2, 0.26, 1.76, 1.68, 0.14, P.white);
    box(b, 0.1, 0.78, 0.4, 1.8, 1.12, 0.07, cover);
    box(b, 0.1, 0.78, 0.47, 1.8, 0.16, 0.03, lighten(cover, 0.18), { outline: false });
    box(b, 0.24, 0.26, 0.4, 0.66, 0.36, 0.12, '#f3efe6');
    box(b, 1.1, 0.26, 0.4, 0.66, 0.36, 0.12, '#f3efe6');
  },
  coffee_table(b) {
    for (const [x, y] of [
      [0.2, 0.25],
      [0.74, 0.25],
      [0.2, 0.69],
      [0.74, 0.69],
    ] as const)
      box(b, x, y, 0, 0.05, 0.05, 0.3, P.woodDark);
    box(b, 0.15, 0.2, 0.3, 0.7, 0.6, 0.05, P.woodLight);
    box(b, 0.25, 0.32, 0.35, 0.26, 0.2, 0.05, P.violet);
    b.cylinder(0.65, 0.55, 0.35, 0.05, 0.09, P.white);
  },
  round_table(b) {
    box(b, 0.36, 0.36, 0, 0.28, 0.28, 0.04, P.ink);
    b.cylinder(0.5, 0.5, 0.04, 0.04, 0.58, P.metal);
    b.cylinder(0.5, 0.5, 0.62, 0.42, 0.05, P.white);
    box(b, 0.34, 0.36, 0.67, 0.34, 0.24, 0.02, P.metalDark);
    box(b, 0.34, 0.34, 0.69, 0.34, 0.03, 0.2, P.metalDark, {
      decals: [decal('py', 0.08, 0.1, 0.92, 0.9, P.tealLight)],
    });
  },
  bookshelf(b, v) {
    const frame = P.woodDark;
    box(b, 0.1, 0.24, 0, 0.8, 0.08, 1.7, darken(frame, 0.1));
    box(b, 0.1, 0.24, 0, 0.06, 0.56, 1.7, frame);
    box(b, 0.84, 0.24, 0, 0.06, 0.56, 1.7, frame);
    for (const z of [0, 0.42, 0.84, 1.26]) {
      box(b, 0.16, 0.32, z, 0.68, 0.48, 0.04, P.wood);
      books(b, z + 0.04, Math.round(z * 10) + v * 3);
    }
    box(b, 0.1, 0.24, 1.66, 0.8, 0.56, 0.05, P.wood);
  },
  plant(b, v) {
    b.cylinder(0.5, 0.5, 0, 0.2, 0.28, pick([P.pot, P.white, P.slate], v));
    b.disc(0.5, 0.5, 0.281, 0.17, '#5b3a26');
    plantCanopy(b, 0.5, 0.5, 0.28, 1, LEAVES);
  },
  plant_big(b, v) {
    b.cylinder(0.5, 0.5, 0, 0.24, 0.42, pick([P.white, P.pot, P.slate], v));
    box(b, 0.47, 0.47, 0.42, 0.06, 0.06, 0.5, P.woodDark);
    plantCanopy(b, 0.5, 0.5, 0.7, 1.5, LEAVES);
    plantCanopy(b, 0.45, 0.55, 1.15, 1.1, [P.leafLight, P.leaf, P.leafDark]);
  },
  lamp_floor(b) {
    b.cylinder(0.5, 0.5, 0, 0.15, 0.04, P.ink);
    b.cylinder(0.5, 0.5, 0.04, 0.025, 1.28, P.metalDark);
    b.cylinder(0.5, 0.5, 1.3, 0.19, 0.26, '#ffe2a6');
  },
  coffee_bar(b) {
    box(b, 0.05, 0.18, 0, 1.9, 0.72, 0.82, P.woodDark, {
      decals: [0.1, 0.36, 0.62, 0.88].map((u) =>
        decal('py', u - 0.1, 0.12, u + 0.1, 0.86, darken(P.woodDark, 0.12)),
      ),
    });
    box(b, 0.02, 0.15, 0.82, 1.96, 0.78, 0.05, '#f1ede6');
    box(b, 0.22, 0.26, 0.87, 0.5, 0.36, 0.5, P.ink, {
      decals: [
        decal('py', 0.15, 0.55, 0.85, 0.85, P.metal),
        decal('py', 0.4, 0.15, 0.6, 0.3, P.tealLight),
      ],
    });
    box(b, 0.32, 0.44, 0.87, 0.3, 0.2, 0.06, P.metal);
    b.cylinder(0.98, 0.6, 0.87, 0.06, 0.1, P.white);
    b.cylinder(1.14, 0.62, 0.87, 0.06, 0.1, P.coral);
    b.cylinder(1.62, 0.5, 0.87, 0.16, 0.06, P.white);
    b.disc(1.62, 0.5, 0.94, 0.12, '#d79b5e');
  },
  reception_desk(b) {
    box(b, 0.05, 0.3, 0, 2.9, 0.55, 0.86, P.white, {
      decals: [decal('py', 0, 0.62, 1, 0.72, P.teal)],
    });
    box(b, 0, 0.24, 0.86, 3, 0.68, 0.06, P.woodLight);
    b.text({ x: 1.5, y: 0.86, z: 0.4 }, 'py', 'ACCUEIL', {
      size: 8,
      color: P.slate,
      weight: 800,
      fit: 1.4,
    });
    box(b, 1.2, 0.36, 0.92, 0.6, 0.06, 0.36, P.ink);
    box(b, 0.3, 0.36, 0.92, 0.3, 0.24, 0.03, P.coral);
    plantCanopy(b, 2.6, 0.55, 0.92, 0.55, LEAVES);
  },
  idea_box(b) {
    box(b, 0.45, 0.45, 0, 0.1, 0.1, 0.55, P.woodDark);
    box(b, 0.2, 0.3, 0.55, 0.6, 0.42, 0.4, P.wood, {
      decals: [
        decal('top', 0.2, 0.42, 0.8, 0.56, P.ink),
        decal('py', 0.08, 0.12, 0.92, 0.88, '#fbf3df'),
      ],
    });
    b.text({ x: 0.5, y: 0.72, z: 0.75 }, 'py', 'IDÉES', {
      size: 5,
      color: P.woodDark,
      weight: 900,
      fit: 0.5,
    });
    b.cylinder(0.5, 0.5, 0.95, 0.05, 0.05, P.metal);
    box(b, 0.41, 0.41, 1.0, 0.18, 0.18, 0.18, P.sun, {
      decals: [decal('py', 0.3, 0.3, 0.7, 0.7, lighten(P.sun, 0.45))],
    });
  },
  bug_kiosk(b) {
    box(b, 0.2, 0.26, 0, 0.6, 0.5, 0.8, P.slate, {
      decals: [decal('py', 0.1, 0.55, 0.9, 0.85, darken(P.slate, 0.2))],
    });
    b.text({ x: 0.5, y: 0.76, z: 0.5 }, 'py', 'BUGS', {
      size: 5,
      color: '#ffffff',
      weight: 900,
      fit: 0.5,
    });
    box(b, 0.17, 0.3, 0.8, 0.66, 0.12, 0.52, P.ink, {
      decals: [
        decal('py', 0.08, 0.08, 0.92, 0.92, '#0d1630'),
        // Une coccinelle (le « bug ») sur l'écran.
        decal('py', 0.38, 0.28, 0.62, 0.62, P.coral),
        decal('py', 0.44, 0.62, 0.56, 0.72, P.ink),
        decal('py', 0.49, 0.28, 0.51, 0.62, P.ink),
        decal('py', 0.41, 0.36, 0.46, 0.42, P.ink),
        decal('py', 0.54, 0.48, 0.59, 0.54, P.ink),
      ],
    });
  },
  board_welcome(b) {
    box(b, 0.18, 0.46, 0, 0.06, 0.06, 0.4, P.slate);
    box(b, 0.76, 0.46, 0, 0.06, 0.06, 0.4, P.slate);
    box(b, 0.08, 0.42, 0.38, 0.84, 0.1, 1.0, P.teal, {
      decals: [
        decal('py', 0.07, 0.06, 0.93, 0.94, '#fbf8f2'),
        decal('py', 0.15, 0.5, 0.85, 0.53, P.coral),
        decal('py', 0.15, 0.38, 0.85, 0.41, '#cfd5e2'),
        decal('py', 0.15, 0.3, 0.75, 0.33, '#cfd5e2'),
        decal('py', 0.15, 0.22, 0.8, 0.25, '#cfd5e2'),
      ],
    });
    b.text({ x: 0.5, y: 0.53, z: 1.12 }, 'py', 'BIENVENUE', {
      size: 6,
      color: P.slate,
      weight: 800,
      fit: 0.66,
    });
  },
  board_roadmap(b) {
    box(b, 0.18, 0.46, 0, 0.06, 0.06, 0.45, P.woodDark);
    box(b, 0.76, 0.46, 0, 0.06, 0.06, 0.45, P.woodDark);
    const notes: Decal[] = [decal('py', 0.06, 0.06, 0.94, 0.94, '#c99a64')];
    const colors = [P.sun, P.tealLight, P.coral, '#f5f0e6', P.violet, P.sun];
    colors.forEach((c, i) => {
      const u = 0.12 + (i % 3) * 0.28;
      const vv = i < 3 ? 0.42 : 0.12;
      notes.push(decal('py', u, vv, u + 0.2, vv + 0.24, c));
    });
    box(b, 0.08, 0.42, 0.42, 0.84, 0.1, 0.95, P.woodDark, { decals: notes });
    b.text({ x: 0.5, y: 0.53, z: 1.25 }, 'py', 'ROADMAP', {
      size: 6,
      color: P.white,
      weight: 800,
      fit: 0.7,
    });
  },
  elevator(b) {
    box(b, 0, 0.32, 0, 2, 0.68, 2.5, '#c4ccd8', {
      decals: [
        decal('py', 0.16, 0, 0.84, 0.78, '#8f99ab'),
        decal('py', 0.19, 0, 0.495, 0.75, '#dfe5ee'),
        decal('py', 0.505, 0, 0.81, 0.75, '#dfe5ee'),
        decal('py', 0.4, 0.82, 0.6, 0.92, P.ink),
        decal('py', 0.89, 0.36, 0.95, 0.46, P.tealLight),
      ],
    });
    box(b, -0.02, 0.3, 2.5, 2.04, 0.72, 0.08, P.slate);
    b.text({ x: 1, y: 1.01, z: 2.18 }, 'py', 'RDC ▲', {
      size: 5,
      color: P.tealLight,
      weight: 800,
      fit: 0.36,
    });
  },
  /**
   * Joshua, le robot d'accueil : inspiré du petit robot de bureau de la communauté (corps en
   * œuf blanc sur socle noir, petites jambes, tête arrondie, deux grands yeux reliés par une
   * barre, deux antennes à ressort), redessiné dans le style du jeu.
   */
  robot(b) {
    const shell = '#f4f2ee';
    const dark = '#23262f';
    // Socle noir et corps en œuf, plus large un peu en dessous du milieu, ouvert en haut.
    b.cylinder(0.5, 0.5, 0, 0.25, 0.07, dark);
    b.ovoid(
      0.5,
      0.5,
      0.06,
      0.56,
      (t) =>
        t < 0.45
          ? 0.24 + 0.045 * Math.sin((t / 0.45) * (Math.PI / 2))
          : 0.285 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.62) ** 2)),
      shell,
    );
    b.disc(0.5, 0.5, 0.62, 0.12, '#3a3f4c');
    // Petites jambes qui portent la tête.
    for (const [x, y] of [
      [0.43, 0.43],
      [0.55, 0.43],
      [0.43, 0.55],
      [0.55, 0.55],
    ] as const)
      box(b, x, y, 0.61, 0.025, 0.025, 0.1, P.metal, { outline: false });
    // Tête aux angles arrondis.
    b.roundedBox({
      x: 0.19,
      y: 0.32,
      z: 0.7,
      w: 0.62,
      d: 0.36,
      h: 0.36,
      radius: 0.07,
      color: shell,
    });
    // Visage (face avant) : deux grands yeux noirs reliés par une barre.
    const face = 0.685;
    // `dy` : un rien plus en avant pour chaque couche (bord, œil, reflet).
    const ring = (cx: number, cz: number, r: number, color: string, dy: number) => {
      const pts = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * r, y: face + dy, z: cz + Math.sin(a) * r * 1.05 });
      }
      b.poly(pts, color, { facing: 'py' });
    };
    b.poly(
      [
        { x: 0.44, y: face, z: 0.87 },
        { x: 0.56, y: face, z: 0.87 },
        { x: 0.56, y: face, z: 0.89 },
        { x: 0.44, y: face, z: 0.89 },
      ],
      dark,
      { facing: 'py' },
    );
    for (const cx of [0.36, 0.64]) {
      ring(cx, 0.88, 0.1, '#5b606d', 0);
      ring(cx, 0.88, 0.079, '#0f1116', 0.004);
      ring(cx - 0.026, 0.91, 0.021, '#ffffff', 0.008);
    }
    // Antennes à ressort, légèrement écartées.
    for (const [x0, x1] of [
      [0.33, 0.27],
      [0.67, 0.73],
    ] as const) {
      b.poly(
        [
          { x: x0 - 0.012, y: 0.5, z: 1.05 },
          { x: x0 + 0.012, y: 0.5, z: 1.05 },
          { x: x1 + 0.01, y: 0.5, z: 1.55 },
          { x: x1 - 0.01, y: 0.5, z: 1.55 },
        ],
        dark,
      );
      for (let i = 0; i < 5; i++) {
        const t = 0.03 + i * 0.035;
        b.disc(x0 + (x1 - x0) * t, 0.5, 1.07 + 0.5 * t, 0.028, '#7d8494', dark);
      }
      b.cylinder(x1, 0.5, 1.53, 0.018, 0.05, dark);
    }
  },
  arcade(b) {
    box(b, 0.15, 0.22, 0, 0.7, 0.62, 1.55, P.violet, {
      decals: [
        decal('py', 0.12, 0.55, 0.88, 0.82, '#0d1630'),
        decal('py', 0.2, 0.6, 0.45, 0.72, P.tealLight),
        decal('py', 0.55, 0.66, 0.8, 0.76, P.coral),
        decal('py', 0.1, 0.88, 0.9, 0.97, P.sun),
        decal('py', 0.3, 0.05, 0.7, 0.3, darken(P.violet, 0.2)),
      ],
    });
    box(b, 0.15, 0.62, 0.78, 0.7, 0.3, 0.1, P.ink, {
      decals: [
        decal('top', 0.55, 0.3, 0.68, 0.55, P.coral),
        decal('top', 0.72, 0.3, 0.85, 0.55, P.sun),
      ],
    });
    b.cylinder(0.32, 0.77, 0.88, 0.025, 0.1, P.metal);
    b.text({ x: 0.5, y: 0.845, z: 1.45 }, 'py', 'ARCADE', {
      size: 5,
      color: P.ink,
      weight: 900,
      fit: 0.52,
    });
  },
  mirror(b) {
    box(b, 0.14, 0.42, 0, 0.72, 0.12, 1.65, P.woodLight, {
      decals: [
        decal('py', 0.1, 0.06, 0.9, 0.94, '#b9dfea'),
        decal('py', 0.18, 0.5, 0.36, 0.9, '#e2f4f8'),
        decal('py', 0.42, 0.7, 0.5, 0.9, '#e2f4f8'),
      ],
    });
    box(b, 0.1, 0.38, 0, 0.8, 0.2, 0.06, P.woodDark);
  },
  stage(b) {
    box(b, 0, 0, 0, 4, 2, 0.26, P.woodDark, {
      top: P.wood,
      decals: [decal('py', 0, 0.35, 1, 0.55, P.teal)],
    });
    box(b, 2.9, 1.0, 0.26, 0.38, 0.32, 0.66, P.slate, {
      decals: [decal('py', 0.2, 0.55, 0.8, 0.75, P.tealLight)],
    });
    box(b, 2.86, 0.98, 0.92, 0.46, 0.38, 0.05, P.ink);
    plantCanopy(b, 0.35, 0.4, 0.26, 0.9, LEAVES);
  },
  pedestal(b, v) {
    box(b, 0.24, 0.24, 0, 0.52, 0.52, 0.86, P.white, {
      decals: [decal('py', 0.3, 0.7, 0.7, 0.78, '#c9ccd3')],
    });
    if (v % 3 === 0) {
      box(b, 0.36, 0.36, 0.86, 0.28, 0.28, 0.28, P.coral);
      box(b, 0.42, 0.42, 1.14, 0.18, 0.18, 0.18, P.teal);
      box(b, 0.46, 0.46, 1.32, 0.1, 0.1, 0.1, P.sun);
    } else if (v % 3 === 1) {
      b.cylinder(0.5, 0.5, 0.86, 0.16, 0.06, P.metalDark);
      b.cylinder(0.5, 0.5, 0.92, 0.12, 0.4, P.violet);
      b.cylinder(0.5, 0.5, 1.32, 0.16, 0.06, P.tealLight);
    } else {
      const apex: Vec3 = { x: 0.5, y: 0.5, z: 1.45 };
      const c: Vec3[] = [
        { x: 0.3, y: 0.3, z: 0.86 },
        { x: 0.7, y: 0.3, z: 0.86 },
        { x: 0.7, y: 0.7, z: 0.86 },
        { x: 0.3, y: 0.7, z: 0.86 },
      ];
      b.poly([c[3]!, c[2]!, apex], P.sun, { facing: 'py' });
      b.poly([c[1]!, c[2]!, apex], darken(P.sun, 0.2), { facing: 'px' });
    }
  },
  gallery_panel(b, v) {
    const art = pick([P.coral, P.teal, P.violet], v);
    box(b, 0.04, 0.42, 0, 0.92, 0.12, 1.55, '#f4f1ea', {
      decals: [
        decal('py', 0.16, 0.36, 0.84, 0.86, P.ink),
        decal('py', 0.2, 0.4, 0.8, 0.82, lighten(art, 0.55)),
        decal('py', 0.28, 0.46, 0.56, 0.7, art),
        decal('py', 0.5, 0.56, 0.72, 0.76, darken(art, 0.2)),
        decal('py', 0.38, 0.18, 0.62, 0.26, '#c9ccd3'),
      ],
    });
  },
  rope_barrier(b) {
    for (const x of [0.15, 0.85]) {
      b.cylinder(x, 0.5, 0, 0.09, 0.04, '#b08d3c');
      b.cylinder(x, 0.5, 0.04, 0.03, 0.7, '#d9b25a');
      b.cylinder(x, 0.5, 0.74, 0.05, 0.05, '#e8c674');
    }
    box(b, 0.18, 0.48, 0.58, 0.64, 0.04, 0.05, '#b8324a');
  },
  sign_soon(b) {
    box(b, 0.47, 0.47, 0, 0.06, 0.06, 0.9, P.slate);
    box(b, 0.12, 0.44, 0.75, 0.76, 0.08, 0.55, P.sun, {
      decals: [decal('py', 0.06, 0.08, 0.94, 0.92, lighten(P.sun, 0.3))],
    });
    b.text({ x: 0.5, y: 0.53, z: 1.12 }, 'py', 'BIENTÔT', {
      size: 6,
      color: P.slate,
      weight: 900,
      fit: 0.64,
    });
    b.text({ x: 0.5, y: 0.53, z: 0.92 }, 'py', 'GALERIE', {
      size: 4.5,
      color: P.slate,
      weight: 700,
      fit: 0.6,
    });
  },
  rug(b) {
    const quad = (x0: number, y0: number, x1: number, y1: number, c: string, z = 0.005) =>
      b.poly(
        [
          { x: x0, y: y0, z },
          { x: x1, y: y0, z },
          { x: x1, y: y1, z },
          { x: x0, y: y1, z },
        ],
        c,
      );
    quad(0.15, 0.15, 2.85, 1.85, '#c4673f');
    quad(0.3, 0.3, 2.7, 1.7, '#e9d6b8', 0.006);
    quad(0.45, 0.45, 2.55, 1.55, '#d98a5c', 0.007);
    for (let i = 0; i < 5; i++) quad(0.65 + i * 0.4, 0.7, 0.85 + i * 0.4, 1.3, '#f3e6cf', 0.008);
  },
  rug_logo(b) {
    b.disc(1.5, 1.5, 0.005, 1.38, P.teal);
    b.disc(1.5, 1.5, 0.006, 1.2, '#1b8f84');
    b.disc(1.5, 1.5, 0.007, 1.05, P.teal);
    b.text({ x: 1.5, y: 1.5, z: 0.01 }, 'top', 'MALINOSLAND', {
      size: 13,
      color: '#f5fffd',
      weight: 900,
      fit: 2.2,
    });
  },
  doormat(b) {
    b.poly(
      [
        { x: 0.2, y: 0.3, z: 0.005 },
        { x: 1.8, y: 0.3, z: 0.005 },
        { x: 1.8, y: 0.85, z: 0.005 },
        { x: 0.2, y: 0.85, z: 0.005 },
      ],
      '#4a3f38',
    );
    b.text({ x: 1, y: 0.58, z: 0.01 }, 'top', 'BIENVENUE', {
      size: 7,
      color: '#e2c9a0',
      weight: 800,
      fit: 1.4,
    });
  },
  tree(b, v) {
    box(b, 0.42, 0.42, 0, 0.16, 0.16, 0.8, '#7a5236');
    if (v % 3 === 1) {
      // Conifère
      const g = ['#2f7a55', '#3a8f63', '#2a6b4b'];
      [
        [0.1, 0.55, 0.5],
        [0.2, 1.0, 0.45],
        [0.3, 1.4, 0.4],
        [0.4, 1.75, 0.3],
      ].forEach(([o, z, h], i) => box(b, o!, o!, z!, 1 - 2 * o!, 1 - 2 * o!, h!, pick(g, i)));
    } else {
      const leaves =
        v % 3 === 2 ? ['#f2a7c3', '#e88db0', '#f7c3d6'] : [P.leaf, P.leafLight, P.leafDark];
      box(b, 0.1, 0.1, 0.7, 0.8, 0.8, 0.62, leaves[0]!);
      box(b, 0.04, 0.3, 0.82, 0.3, 0.46, 0.4, leaves[2]!);
      box(b, 0.3, 0.04, 0.86, 0.46, 0.3, 0.38, leaves[1]!);
      box(b, 0.2, 0.2, 1.32, 0.6, 0.6, 0.34, leaves[1]!);
      box(b, 0.32, 0.32, 1.66, 0.36, 0.36, 0.2, leaves[0]!);
    }
  },
  bush(b) {
    box(b, 0.14, 0.14, 0, 0.72, 0.72, 0.38, P.leafDark);
    box(b, 0.24, 0.24, 0.38, 0.52, 0.52, 0.16, P.leaf, {
      decals: [
        decal('top', 0.2, 0.2, 0.32, 0.32, '#f6e27a'),
        decal('top', 0.6, 0.55, 0.72, 0.67, '#f2a7c3'),
      ],
    });
  },
  flowerbed(b, v) {
    box(b, 0.05, 0.15, 0, 1.9, 0.7, 0.3, P.woodDark, { top: '#5b3a26' });
    const colors = [P.coral, P.sun, '#f2a7c3', P.violet, '#ffffff'];
    for (let i = 0; i < 7; i++) {
      const x = 0.18 + i * 0.25;
      const y = 0.3 + ((i * 3 + v) % 3) * 0.14;
      box(b, x + 0.04, y + 0.04, 0.3, 0.03, 0.03, 0.14, P.leafDark, { outline: false });
      box(b, x, y, 0.42, 0.11, 0.11, 0.08, pick(colors, i + v), { outline: false });
    }
  },
  bench(b) {
    box(b, 0.16, 0.3, 0, 0.08, 0.46, 0.36, P.ink);
    box(b, 1.76, 0.3, 0, 0.08, 0.46, 0.36, P.ink);
    for (let i = 0; i < 3; i++) box(b, 0.1, 0.3 + i * 0.16, 0.36, 1.8, 0.13, 0.05, P.wood);
    backrest(b, () => {
      box(b, 0.16, 0.2, 0.36, 0.08, 0.08, 0.42, P.ink);
      box(b, 1.76, 0.2, 0.36, 0.08, 0.08, 0.42, P.ink);
      box(b, 0.1, 0.18, 0.54, 1.8, 0.06, 0.12, P.wood);
      box(b, 0.1, 0.18, 0.7, 1.8, 0.06, 0.1, P.wood);
    });
  },
  lamp_post(b) {
    box(b, 0.36, 0.36, 0, 0.28, 0.28, 0.14, P.ink);
    b.cylinder(0.5, 0.5, 0.14, 0.04, 1.96, P.slate);
    box(b, 0.38, 0.38, 2.1, 0.24, 0.24, 0.3, '#ffe7a8', {
      decals: [decal('py', 0.46, 0, 0.54, 1, P.slate), decal('px', 0.46, 0, 0.54, 1, P.slate)],
    });
    box(b, 0.33, 0.33, 2.4, 0.34, 0.34, 0.06, P.ink);
  },
  fountain(b) {
    const stone = '#c9c2b5';
    b.poly(
      [
        { x: 0.25, y: 0.25, z: 0.26 },
        { x: 1.75, y: 0.25, z: 0.26 },
        { x: 1.75, y: 1.75, z: 0.26 },
        { x: 0.25, y: 1.75, z: 0.26 },
      ],
      P.water,
    );
    box(b, 0.1, 0.1, 0, 1.8, 0.15, 0.36, stone);
    box(b, 0.1, 0.25, 0, 0.15, 1.5, 0.36, stone);
    box(b, 1.75, 0.25, 0, 0.15, 1.5, 0.36, stone);
    box(b, 0.1, 1.75, 0, 1.8, 0.15, 0.36, stone);
    b.cylinder(1, 1, 0.26, 0.12, 0.6, stone);
    b.cylinder(1, 1, 0.86, 0.34, 0.08, stone);
    b.disc(1, 1, 0.945, 0.27, lighten(P.water, 0.2));
    b.cylinder(1, 1, 0.94, 0.05, 0.25, stone);
  },
  parasol_table(b) {
    b.cylinder(0.5, 0.5, 0, 0.12, 0.03, P.ink);
    b.cylinder(0.5, 0.5, 0.03, 0.03, 0.6, P.metal);
    b.cylinder(0.5, 0.5, 0.62, 0.36, 0.04, P.white);
    b.cylinder(0.5, 0.5, 0.66, 0.02, 1.0, P.white);
    const apex: Vec3 = { x: 0.5, y: 0.5, z: 1.95 };
    const r = 0.78;
    const c: Vec3[] = [
      { x: 0.5 - r, y: 0.5 - r, z: 1.55 },
      { x: 0.5 + r, y: 0.5 - r, z: 1.55 },
      { x: 0.5 + r, y: 0.5 + r, z: 1.55 },
      { x: 0.5 - r, y: 0.5 + r, z: 1.55 },
    ];
    b.poly([c[0]!, c[1]!, apex], lighten(P.coral, 0.1));
    b.poly([c[3]!, c[0]!, apex], '#fff3e6');
    b.poly([c[1]!, c[2]!, apex], '#f3e2d0');
    b.poly([c[2]!, c[3]!, apex], P.coral);
  },
  deck_chair(b) {
    box(b, 0.24, 0.3, 0, 0.05, 0.05, 0.2, P.woodDark);
    box(b, 0.71, 0.3, 0, 0.05, 0.05, 0.2, P.woodDark);
    box(b, 0.24, 0.84, 0, 0.05, 0.05, 0.2, P.woodDark);
    box(b, 0.71, 0.84, 0, 0.05, 0.05, 0.2, P.woodDark);
    box(b, 0.22, 0.3, 0.2, 0.56, 0.62, 0.06, P.teal, {
      decals: [decal('top', 0.3, 0, 0.45, 1, '#fdf7ec'), decal('top', 0.6, 0, 0.75, 1, '#fdf7ec')],
    });
    backrest(b, () =>
      box(b, 0.22, 0.14, 0.24, 0.56, 0.14, 0.5, P.teal, {
        decals: [decal('py', 0.3, 0, 0.45, 1, '#fdf7ec'), decal('py', 0.6, 0, 0.75, 1, '#fdf7ec')],
      }),
    );
  },
  cone(b) {
    box(b, 0.3, 0.3, 0, 0.4, 0.4, 0.05, '#f06a2b');
    box(b, 0.38, 0.38, 0.05, 0.24, 0.24, 0.15, '#f06a2b');
    box(b, 0.41, 0.41, 0.2, 0.18, 0.18, 0.1, P.white);
    box(b, 0.44, 0.44, 0.3, 0.12, 0.12, 0.14, '#f06a2b');
  },
  fence(b) {
    box(b, 0.1, 0.38, 0, 0.06, 0.2, 0.06, P.ink);
    box(b, 0.84, 0.38, 0, 0.06, 0.2, 0.06, P.ink);
    box(b, 0.11, 0.45, 0, 0.04, 0.06, 0.66, P.metal);
    box(b, 0.85, 0.45, 0, 0.04, 0.06, 0.66, P.metal);
    const stripes: Decal[] = [];
    for (let i = 0; i < 5; i++) stripes.push(decal('py', i * 0.2, 0, i * 0.2 + 0.1, 1, '#d93b30'));
    box(b, 0.04, 0.44, 0.38, 0.92, 0.05, 0.22, P.white, { decals: stripes });
  },
  scaffold(b) {
    const pole = '#8892a6';
    for (const [x, y] of [
      [0.15, 0.15],
      [1.8, 0.15],
      [0.15, 1.8],
      [1.8, 1.8],
    ] as const)
      box(b, x, y, 0, 0.06, 0.06, 2.4, pole);
    for (const z of [1.1, 2.2]) box(b, 0.12, 0.12, z, 1.76, 1.76, 0.06, P.woodLight);
    box(b, 0.15, 1.82, 0.6, 1.7, 0.03, 0.04, pole);
    box(b, 1.82, 0.15, 0.6, 0.03, 1.7, 0.04, pole);
    box(b, 0.4, 0.5, 0, 0.5, 0.5, 0.4, '#a87b4f');
    box(b, 0.5, 1.1, 0, 0.4, 0.4, 0.3, '#a87b4f');
    box(b, 1.2, 0.4, 1.16, 0.4, 0.4, 0.4, '#9aa3b5');
  },
  sign_site(b) {
    box(b, 0.2, 0.47, 0, 0.06, 0.06, 0.9, P.metalDark);
    box(b, 0.74, 0.47, 0, 0.06, 0.06, 0.9, P.metalDark);
    box(b, 0.08, 0.44, 0.7, 0.84, 0.08, 0.7, P.sun, {
      decals: [
        decal('py', 0, 0, 1, 0.14, P.ink),
        decal('py', 0.1, 0.0, 0.25, 0.14, P.sun),
        decal('py', 0.45, 0, 0.6, 0.14, P.sun),
        decal('py', 0.8, 0, 0.95, 0.14, P.sun),
      ],
    });
    b.text({ x: 0.5, y: 0.53, z: 1.2 }, 'py', 'TOUR', {
      size: 8,
      color: P.ink,
      weight: 900,
      fit: 0.7,
    });
    b.text({ x: 0.5, y: 0.53, z: 1.0 }, 'py', 'chantier · v0.3', {
      size: 4.5,
      color: P.ink,
      weight: 700,
      fit: 0.72,
    });
  },
  sign_hub(b) {
    box(b, 0.22, 0.32, 0, 0.56, 0.36, 0.08, P.ink);
    box(b, 0.26, 0.36, 0.08, 0.48, 0.28, 1.9, P.ink, {
      decals: [decal('py', 0, 0.9, 1, 0.94, P.teal), decal('py', 0, 0.06, 1, 0.08, P.coral)],
    });
    b.text({ x: 0.5, y: 0.65, z: 1.62 }, 'py', 'M', { size: 16, color: P.tealLight, weight: 900 });
    b.text({ x: 0.5, y: 0.65, z: 1.2 }, 'py', 'MALINOS', {
      size: 4.6,
      color: P.white,
      weight: 800,
      fit: 0.42,
    });
    b.text({ x: 0.5, y: 0.65, z: 1.06 }, 'py', 'LAND', {
      size: 4.6,
      color: P.white,
      weight: 800,
      fit: 0.42,
    });
    b.text({ x: 0.5, y: 0.65, z: 0.6 }, 'py', 'LE HUB', {
      size: 4,
      color: P.coral,
      weight: 800,
      fit: 0.42,
    });
  },
};

// ---------------------------------------------------------------------------
// Décors muraux : dessinés sur une face +y de mur (plan y = WALL_FACE_Y).

export type DecorArt = (b: IsoBuilder, variant: number, faceY: number) => void;

export const DECOR_ART: Record<string, DecorArt> = {
  window(b, _v, fy) {
    box(b, 0.12, fy, 0.85, 0.76, 0.03, 1.3, P.white, {
      decals: [
        decal('py', 0.08, 0.06, 0.92, 0.94, '#9fd3ea'),
        decal('py', 0.12, 0.55, 0.3, 0.9, '#c8e9f5'),
        decal('py', 0.47, 0.06, 0.53, 0.94, P.white),
        decal('py', 0.08, 0.48, 0.92, 0.52, P.white),
      ],
    });
    box(b, 0.08, fy, 0.8, 0.84, 0.08, 0.05, P.white);
  },
  poster(b, v, fy) {
    const c = pick([P.coral, P.teal, P.violet], v);
    const word = pick(['CRÉER', 'PARTAGER', 'APPRENDRE'], v);
    box(b, 0.24, fy, 1.0, 0.52, 0.02, 0.85, c, {
      decals: [
        decal('py', 0.12, 0.42, 0.88, 0.88, lighten(c, 0.25)),
        decal('py', 0.3, 0.52, 0.55, 0.78, P.sun),
        decal('py', 0.5, 0.6, 0.72, 0.82, darken(c, 0.25)),
      ],
    });
    b.text({ x: 0.5, y: fy + 0.03, z: 1.22 }, 'py', word, {
      size: 4.2,
      color: P.white,
      weight: 900,
      fit: 0.44,
    });
  },
  whiteboard(b, _v, fy) {
    box(b, 0.04, fy, 0.95, 0.92, 0.03, 0.85, '#fbfbf8', {
      decals: [
        decal('py', 0.08, 0.7, 0.5, 0.74, P.teal),
        decal('py', 0.08, 0.58, 0.36, 0.62, '#6b7aa8'),
        decal('py', 0.08, 0.46, 0.44, 0.5, '#6b7aa8'),
        decal('py', 0.58, 0.3, 0.68, 0.7, P.coral),
        decal('py', 0.72, 0.3, 0.82, 0.55, P.sun),
        decal('py', 0.86, 0.3, 0.94, 0.8, P.teal),
      ],
    });
    box(b, 0.04, fy, 0.9, 0.92, 0.07, 0.04, P.metal);
  },
  clock(b, _v, fy) {
    box(b, 0.36, fy, 1.75, 0.28, 0.03, 0.28, P.white, {
      decals: [
        decal('py', 0.47, 0.5, 0.53, 0.86, P.ink),
        decal('py', 0.5, 0.47, 0.8, 0.53, P.coral),
      ],
    });
  },
  // Les décors larges débordent vers la gauche (-x) : ils sont ancrés sur la
  // tuile de mur la plus à droite pour ne pas être recouverts par sa voisine.
  screen_wall(b, _v, fy) {
    box(b, -0.85, fy, 0.9, 1.7, 0.04, 1.3, P.ink, {
      decals: [
        decal('py', 0.03, 0.05, 0.97, 0.95, '#18284d'),
        decal('py', 0.06, 0.08, 0.94, 0.3, '#22355f'),
        decal('py', 0.08, 0.14, 0.4, 0.22, P.tealLight),
      ],
    });
    b.text({ x: 0, y: fy + 0.05, z: 1.75 }, 'py', 'MalinosLand Live', {
      size: 9,
      color: P.white,
      weight: 800,
      fit: 1.5,
    });
    b.text({ x: 0, y: fy + 0.05, z: 1.5 }, 'py', 'Prochains événements : v0.5', {
      size: 5,
      color: '#9fb2da',
      weight: 600,
      fit: 1.5,
    });
  },
  logo_neon(b, _v, fy) {
    box(b, -0.95, fy, 1.45, 1.8, 0.03, 0.5, P.ink);
    b.text({ x: -0.05, y: fy + 0.05, z: 1.7 }, 'py', 'MalinosLand', {
      size: 9,
      color: '#9ffcef',
      weight: 800,
      font: 'Georgia, serif',
      fit: 1.6,
      glow: '#22b5a6',
    });
  },
};
