import { AIR, BLOCKS, blockDef, type Pattern } from './blocks';
import { CHUNK, CHUNKS_X, SIZE_X, SIZE_Y, SIZE_Z, type Cell, type VoxelWorld } from './world';

export { CHUNK };

/**
 * Construction des maillages du monde en cubes (logique pure et testée) : seules les faces
 * visibles sont gardées, avec une ombre douce dans les coins (occlusion ambiante) et la lumière
 * (ciel, grottes sombres, torches). Le résultat est en repère Three.js : X = x, Y = z (haut),
 * Z = y. Le monde est découpé en tranches de CHUNK × CHUNK colonnes, reconstruites à la demande.
 */
/** Ordre des motifs dans l'atlas de textures (une case de 16 × 16 pixels par motif). */
export const PATTERNS: readonly Pattern[] = [
  'grass_top',
  'grass_side',
  'dirt',
  'stone',
  'planks',
  'log_side',
  'log_top',
  'leaves',
  'glass',
  'sand',
  'brick',
  'turquoise',
  'coral',
  'bedrock',
  'pad',
  'coal_ore',
  'crystal_ore',
  'table_top',
  'table_side',
  'furnace_side',
  'furnace_front',
  'torch',
  'snow',
  'snow_side',
  'gravel',
  'hub_wall',
  'hub_trim',
  'hub_floor',
  'hub_light',
];
const TILE = new Map(PATTERNS.map((p, i) => [p, i]));

/**
 * Lumière : hauteur du ciel par colonne (calculée à la demande, -2 : pas encore connue) et
 * sources de lumière posées (torches, lanternes), rangées par position.
 */
export interface Lighting {
  world: VoxelWorld;
  /** Plus haut cube qui arrête la lumière, par colonne (x + y × SIZE_X). */
  skyTop: Int16Array;
  lights: Map<number, Cell>;
  /** Tranches déjà parcourues à la recherche de lumières. */
  scanned: Uint8Array;
}

/** Lumière dans une grotte ou sous un toit, sans torche (douce : le jeu reste lisible). */
export const CAVE_LIGHT = 0.3;
/** Portée d'une torche (cubes). */
export const TORCH_RANGE = 7;

/** Lumière du monde : rien n'est calculé d'avance, tout l'est à la demande. */
export function computeLighting(world: VoxelWorld): Lighting {
  return {
    world,
    skyTop: new Int16Array(SIZE_X * SIZE_Y).fill(-2),
    lights: new Map(),
    scanned: new Uint8Array(CHUNKS_X * (SIZE_Y / CHUNK)),
  };
}

/** Hauteur du ciel d'une colonne (le plus haut cube qui arrête la lumière). */
function skyTopOf(l: Lighting, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= SIZE_X || y >= SIZE_Y) return -1;
  const i = x + y * SIZE_X;
  if (l.skyTop[i] === -2) {
    let top = -1;
    for (let z = SIZE_Z - 1; z >= 0; z--) {
      const b = l.world.get(x, y, z);
      if (b !== AIR && !blockDef(b).seeThrough) {
        top = z;
        break;
      }
    }
    l.skyTop[i] = top;
  }
  return l.skyTop[i]!;
}

/** Cherche les sources de lumière d'une tranche (une seule fois). */
export function scanLights(l: Lighting, cx: number, cy: number): void {
  const ci = cx + CHUNKS_X * cy;
  if (l.scanned[ci]) return;
  l.scanned[ci] = 1;
  for (let z = 0; z < SIZE_Z; z++)
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++)
        if (blockDef(l.world.get(x, y, z)).light) l.lights.set(l.world.index(x, y, z), { x, y, z });
}

/** Un cube a changé : la colonne et les sources de lumière sont remises à jour. */
export function updateLighting(l: Lighting, c: Cell): void {
  l.skyTop[c.x + c.y * SIZE_X] = -2;
  for (const z of [c.z, c.z + 1]) {
    const i = l.world.index(c.x, c.y, z);
    if (z < SIZE_Z && blockDef(l.world.get(c.x, c.y, z)).light) l.lights.set(i, { ...c, z });
    else l.lights.delete(i);
  }
}

/** Sources de lumière qui peuvent éclairer un rectangle de colonnes. */
function lightsNear(l: Lighting, x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  for (const t of l.lights.values())
    if (
      t.x >= x0 - TORCH_RANGE &&
      t.x <= x1 + TORCH_RANGE &&
      t.y >= y0 - TORCH_RANGE &&
      t.y <= y1 + TORCH_RANGE
    )
      out.push(t);
  return out;
}

/** Lumière d'une case vide (0 à 1). `near` : sources à prendre en compte (toutes par défaut). */
export function lightAt(
  l: Lighting,
  x: number,
  y: number,
  z: number,
  near: Iterable<Cell> = l.lights.values(),
): number {
  let light = z > skyTopOf(l, x, y) ? 1 : CAVE_LIGHT;
  for (const t of near) {
    const d = Math.abs(t.x - x) + Math.abs(t.y - y) + Math.abs(t.z - z);
    if (d < TORCH_RANGE) light = Math.max(light, 1 - d / (TORCH_RANGE + 1) + 0.05);
  }
  return Math.min(1, light);
}

export interface MeshData {
  positions: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  /** Nombre de faces (carrés) : utile aux tests et aux mesures. */
  faces: number;
}

const emptyMesh = (): MeshData => ({ positions: [], uvs: [], colors: [], indices: [], faces: 0 });

/** Les 6 faces : direction (monde), assombrissement, coins (décalages dans le cube). */
const RAW_FACES: ReadonlyArray<{
  d: [number, number, number];
  shade: number;
  kind: 'top' | 'side' | 'bottom';
  corners: Array<[number, number, number]>;
}> = [
  {
    d: [0, 0, 1],
    shade: 1,
    kind: 'top',
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    d: [0, 0, -1],
    shade: 0.55,
    kind: 'bottom',
    corners: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
      [0, 0, 0],
    ],
  },
  {
    d: [1, 0, 0],
    shade: 0.82,
    kind: 'side',
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    d: [-1, 0, 0],
    shade: 0.82,
    kind: 'side',
    corners: [
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
    ],
  },
  {
    d: [0, 1, 0],
    shade: 0.68,
    kind: 'side',
    corners: [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
    ],
  },
  {
    d: [0, -1, 0],
    shade: 0.68,
    kind: 'side',
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
];

/**
 * Pour chaque face : ses deux axes tangents (occlusion ambiante) et le sens des triangles, calculé
 * dans le repère Three.js pour que la face soit visible de l'extérieur.
 */
const FACES = RAW_FACES.map((f) => {
  const axis = f.d.findIndex((v) => v !== 0);
  const tangents = [0, 1, 2].filter((a) => a !== axis) as [number, number];
  const three = (c: [number, number, number]) => [c[0], c[2], c[1]] as const;
  const [p0, p1, p2] = f.corners.map(three) as Array<readonly [number, number, number]>;
  const u = [p1![0] - p0![0], p1![1] - p0![1], p1![2] - p0![2]];
  const v = [p2![0] - p0![0], p2![1] - p0![1], p2![2] - p0![2]];
  const n = [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  const want = three(f.d);
  const flip = n[0]! * want[0] + n[1]! * want[1] + n[2]! * want[2] < 0;
  return { ...f, tangents, flip };
});
const AO = [1, 0.84, 0.7, 0.56];

/**
 * Maillages d'une tranche du monde (colonnes [x0, x0+CHUNK) × [y0, y0+CHUNK)), jusqu'à la
 * hauteur `maxZ` (vue de dessus en coupe). Deux maillages : cubes opaques (feuillage en
 * découpe compris) et verre (transparent).
 */
export function buildChunk(
  world: VoxelWorld,
  x0: number,
  y0: number,
  maxZ: number,
  light: Lighting,
  atlasTiles = PATTERNS.length,
): { opaque: MeshData; glass: MeshData } {
  const opaque = emptyMesh();
  const glass = emptyMesh();
  // Lumières de cette tranche et des voisines, cherchées une fois.
  const cx = Math.floor(x0 / CHUNK);
  const cy = Math.floor(y0 / CHUNK);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (cx + dx >= 0 && cy + dy >= 0 && cx + dx < CHUNKS_X && (cy + dy) * CHUNK < SIZE_Y)
        scanLights(light, cx + dx, cy + dy);
  const near = lightsNear(light, x0, y0, x0 + CHUNK - 1, y0 + CHUNK - 1);
  const occludes = (x: number, y: number, z: number) => {
    if (z > maxZ) return false;
    const b = world.get(x, y, z);
    return b !== AIR && !blockDef(b).seeThrough;
  };
  for (let z = 0; z <= Math.min(maxZ, SIZE_Z - 1); z++)
    for (let y = y0; y < Math.min(y0 + CHUNK, SIZE_Y); y++)
      for (let x = x0; x < Math.min(x0 + CHUNK, SIZE_X); x++) {
        const b = world.get(x, y, z);
        if (b === AIR) continue;
        const def = BLOCKS[b]!;
        if (def.small) continue; // torches : dessinées à part
        const out = def.translucent ? glass : opaque;
        for (const f of FACES) {
          const nx = x + f.d[0];
          const ny = y + f.d[1];
          const nz = z + f.d[2];
          // Face cachée par un voisin plein, ou entre deux cubes du même verre / feuillage.
          const n = nz > maxZ ? AIR : world.get(nx, ny, nz);
          if (n !== AIR && !blockDef(n).seeThrough) continue;
          if (n === b && def.translucent) continue;
          if (nz < 0) continue;
          const pattern =
            f.kind === 'top' ? def.tex.top : f.kind === 'bottom' ? def.tex.bottom : def.tex.side;
          const tile = TILE.get(pattern) ?? 0;
          const lit = lightAt(light, nx, ny, nz, near) * f.shade;
          const base = out.positions.length / 3;
          f.corners.forEach(([cx, cy, cz], i) => {
            // Occlusion ambiante : les deux voisins de côté et le voisin d'angle, devant la face.
            const c = [cx, cy, cz];
            const [t1, t2] = f.tangents;
            const s1 = c[t1]! === 1 ? 1 : -1;
            const s2 = c[t2]! === 1 ? 1 : -1;
            const at = (a: number, b: number) => {
              const p = [nx, ny, nz];
              p[t1]! += a;
              p[t2]! += b;
              return occludes(p[0]!, p[1]!, p[2]!);
            };
            const side1 = at(s1, 0);
            const side2 = at(0, s2);
            const level = side1 && side2 ? 3 : +side1 + +side2 + +at(s1, s2);
            const v = lit * AO[level]!;
            // Repère Three.js : X = x, Y = z, Z = y.
            out.positions.push(x + cx, z + cz, y + cy);
            out.colors.push(v, v, v);
            const u = [0, 1, 1, 0][i]!;
            const w = [0, 0, 1, 1][i]!;
            const pad = 0.5 / 16;
            out.uvs.push((tile + pad + u * (1 - 2 * pad)) / atlasTiles, pad + w * (1 - 2 * pad));
          });
          if (f.flip) out.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
          else out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          out.faces++;
        }
      }
  return { opaque, glass };
}
