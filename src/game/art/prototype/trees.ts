import type { BoxSpec, Decal, IsoBuilder } from '../iso3d';
import { OBJECT_ART, type ObjectArt } from '../objects';

type Cluster = readonly [number, number, number, number, number, number, string];
const cube = (
  b: IsoBuilder,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  extra: Partial<BoxSpec> = {},
) => b.box({ x, y, z, w, d, h, color, outline: false, ...extra });
const patch = (
  face: Decal['face'],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  color: string,
): Decal => ({ face, u0, v0, u1, v1, color });

function trunk(b: IsoBuilder, tall: number): void {
  cube(b, 0.4, 0.4, 0, 0.2, 0.2, tall, '#8c5c3c', {
    decals: [
      patch('py', 0.12, 0, 0.28, 0.75, '#a67146'),
      patch('px', 0.5, 0.22, 0.68, 1, '#754831'),
      patch('ny', 0.18, 0, 0.34, 0.85, '#a67146'),
      patch('nx', 0.5, 0.3, 0.68, 1, '#754831'),
    ],
  });
  cube(b, 0.34, 0.43, 0, 0.06, 0.12, 0.09, '#875936');
  cube(b, 0.48, 0.6, 0, 0.12, 0.07, 0.065, '#875936');
}

/** Croix florale plaquée sur une face. Les rotations sont celles du moteur. */
function blossom(face: Decal['face']): Decal[] {
  return [
    patch(face, 0.36, 0.27, 0.55, 0.84, '#ffe6ee'),
    patch(face, 0.17, 0.46, 0.74, 0.65, '#fff1f3'),
    patch(face, 0.37, 0.47, 0.54, 0.64, '#ffd579'),
  ];
}

/** Chêne compact : même empreinte 1 × 1 que l'arbre actuel. */
export function drawPrototypeOak(b: IsoBuilder): void {
  trunk(b, 1.12);
  cube(b, 0.23, 0.44, 0.7, 0.2, 0.13, 0.13, '#8c5c3c');
  cube(b, 0.55, 0.45, 0.85, 0.22, 0.13, 0.12, '#8c5c3c');
  const clusters: Cluster[] = [
    [0.19, 0.17, 0.8, 0.61, 0.61, 0.46, '#32805c'],
    [0.06, 0.3, 0.87, 0.27, 0.39, 0.3, '#3d9564'],
    [0.33, 0.67, 0.82, 0.33, 0.29, 0.32, '#3b9567'],
    [0.67, 0.38, 0.89, 0.28, 0.35, 0.31, '#348960'],
    [0.39, 0.05, 1.02, 0.36, 0.29, 0.34, '#4eaa64'],
    [0.03, 0.15, 1.17, 0.34, 0.34, 0.3, '#55af67'],
    [0.12, 0.49, 1.17, 0.35, 0.35, 0.31, '#4ca568'],
    [0.48, 0.55, 1.2, 0.37, 0.35, 0.33, '#65b86b'],
    [0.4, 0.19, 1.36, 0.37, 0.36, 0.29, '#63b567'],
    [0.19, 0.35, 1.47, 0.37, 0.34, 0.28, '#7ac76f'],
    [0.31, 0.27, 1.75, 0.31, 0.28, 0.17, '#8ecf70'],
  ];
  clusters.forEach(([x, y, z, w, d, h, color], i) =>
    cube(b, 0.5 + (x - 0.5) * 1.25, 0.5 + (y - 0.5) * 1.25, z, w * 1.25, d * 1.25, h, color, {
      decals:
        i % 3 === 0
          ? [
              patch('py', 0.12, 0.22, 0.27, 0.38, '#9bd45d'),
              patch('px', 0.6, 0.57, 0.75, 0.74, '#87c959'),
            ]
          : [],
    }),
  );
  cube(b, 0.1, 0.56, 1.48, 0.0875, 0.0875, 0.025, '#a3d967');
  cube(b, 0.2, 0.525, 1.48, 0.075, 0.0875, 0.035, '#94ce5d');
}

/** Sakura : trois bouquets séparés, branches apparentes, silhouette asymétrique. */
export function drawPrototypeSakura(b: IsoBuilder): void {
  trunk(b, 1.48);
  cube(b, 0.16, 0.43, 0.56, 0.25, 0.13, 0.13, '#8c5c3c');
  cube(b, 0.16, 0.43, 0.69, 0.12, 0.13, 0.24, '#9b6843');
  cube(b, 0.6, 0.43, 0.78, 0.22, 0.13, 0.13, '#8c5c3c');
  cube(b, 0.7, 0.43, 0.91, 0.12, 0.13, 0.25, '#9b6843');
  const clusters: Cluster[] = [
    [0.0, 0.22, 0.58, 0.43, 0.5, 0.48, '#e68daf'],
    [0.04, 0.32, 1.06, 0.31, 0.31, 0.22, '#f3a6c5'],
    [0.27, 0.53, 0.64, 0.23, 0.27, 0.38, '#f39bbb'],
    [0.11, 0.4, 1.28, 0.16, 0.15, 0.08, '#ffc0d7'],
    [0.53, 0.22, 0.78, 0.47, 0.49, 0.51, '#ed96ba'],
    [0.6, 0.29, 1.29, 0.33, 0.32, 0.21, '#f6b1ce'],
    [0.78, 0.61, 0.86, 0.2, 0.19, 0.35, '#e88aaf'],
    [0.7, 0.36, 1.5, 0.15, 0.15, 0.08, '#ffc6dc'],
    [0.18, 0.08, 1.26, 0.58, 0.55, 0.45, '#ec96b9'],
    [0.13, 0.2, 1.39, 0.24, 0.32, 0.27, '#efa0c2'],
    [0.34, 0.5, 1.39, 0.31, 0.22, 0.28, '#f6adcc'],
    [0.31, 0.2, 1.71, 0.35, 0.34, 0.24, '#f7b5cf'],
    [0.4, 0.28, 1.95, 0.17, 0.16, 0.09, '#ffc6dc'],
  ];
  clusters.forEach(([x, y, z, w, d, h, color], i) =>
    cube(b, 0.5 + (x - 0.5) * 1.25, 0.5 + (y - 0.5) * 1.25, z, w * 1.25, d * 1.25, h, color, {
      decals: [0, 4, 8, 11].includes(i)
        ? [...blossom('py'), ...blossom('px'), ...blossom('ny'), ...blossom('nx')]
        : [],
    }),
  );
}

export const prototypeTreeArt: ObjectArt = (b, variant) => {
  if (variant % 3 === 1) OBJECT_ART.tree!(b, variant);
  else if (variant % 3 === 2) drawPrototypeSakura(b);
  else drawPrototypeOak(b);
};
