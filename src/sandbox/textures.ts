import { seededRandom } from '../core/random';
import { blockDef, itemDef, type Pattern } from './blocks';
import { PATTERNS } from './mesh';

/**
 * Textures du « Chantier des mondes » : petits motifs de 16 × 16 pixels dessinés par le code
 * (aucune image téléchargée ni copiée), réunis dans une seule bande (atlas). Les couleurs
 * reprennent la palette de MalinosLand ; la dalle de départ porte le losange de MalinosLand.
 */
export const TEX = 16;

type Px = (x: number, y: number, rgba: string) => void;

const hex = (h: string, k = 0): string => {
  const n = parseInt(h.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** Remplit la case de bruit autour d'une couleur (variation ± `amp`). */
function noise(px: Px, rnd: () => number, color: string, amp = 0.12): void {
  for (let y = 0; y < TEX; y++)
    for (let x = 0; x < TEX; x++) px(x, y, hex(color, (rnd() - 0.5) * 2 * amp));
}

function speckle(px: Px, rnd: () => number, color: string, count: number, size = 1): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * (TEX - size + 1));
    const y = Math.floor(rnd() * (TEX - size + 1));
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) px(x + dx, y + dy, hex(color, (rnd() - 0.5) * 0.2));
  }
}

const DRAW: Record<
  Pattern,
  (px: Px, rnd: () => number, clear: (x: number, y: number) => void) => void
> = {
  grass_top: (px, r) => {
    noise(px, r, '#6cbf5a', 0.14);
    speckle(px, r, '#8bd46f', 14);
    speckle(px, r, '#4fa35a', 10);
  },
  grass_side: (px, r) => {
    noise(px, r, '#9b6a43', 0.12);
    speckle(px, r, '#7a5235', 8);
    for (let x = 0; x < TEX; x++) {
      const h = 3 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) px(x, y, hex('#6cbf5a', (r() - 0.5) * 0.25));
    }
  },
  dirt: (px, r) => {
    noise(px, r, '#9b6a43', 0.12);
    speckle(px, r, '#7a5235', 10);
    speckle(px, r, '#b98a5c', 6);
  },
  stone: (px, r) => {
    noise(px, r, '#8b93a6', 0.1);
    speckle(px, r, '#6f778a', 12, 2);
    speckle(px, r, '#a3abbd', 8);
  },
  planks: (px, r) => {
    noise(px, r, '#d9a46a', 0.06);
    for (let y = 0; y < TEX; y += 4) for (let x = 0; x < TEX; x++) px(x, y, hex('#a87a4a'));
    for (let row = 0; row < 4; row++) {
      const seam = (row * 7 + 3) % TEX;
      for (let y = row * 4 + 1; y < row * 4 + 4; y++) px(seam, y, hex('#a87a4a'));
    }
  },
  log_side: (px, r) => {
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++)
        px(x, y, hex(x % 4 === 0 ? '#6e4529' : '#8a5a36', (r() - 0.5) * 0.18));
  },
  log_top: (px, r) => {
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const ring = Math.floor(d) % 3 === 0;
        px(x, y, hex(d > 6.5 ? '#6e4529' : ring ? '#b98a5c' : '#d9a46a', (r() - 0.5) * 0.1));
      }
  },
  leaves: (px, r, clear) => {
    noise(px, r, '#4fa35a', 0.22);
    speckle(px, r, '#7cc96a', 10);
    for (let i = 0; i < 26; i++) clear(Math.floor(r() * TEX), Math.floor(r() * TEX));
  },
  glass: (px, _r, clear) => {
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++) {
        const edge = x === 0 || y === 0 || x === TEX - 1 || y === TEX - 1;
        const shine = (x + y === 5 || x + y === 6 || x + y === 9) && x > 1 && y > 1;
        if (edge) px(x, y, 'rgba(230,248,255,0.95)');
        else if (shine) px(x, y, 'rgba(255,255,255,0.6)');
        else clear(x, y);
      }
  },
  sand: (px, r) => {
    noise(px, r, '#ecd596', 0.07);
    speckle(px, r, '#d8bd76', 12);
  },
  brick: (px, r) => {
    noise(px, r, '#b5694a', 0.1);
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++) {
        const row = Math.floor(y / 4);
        const off = row % 2 ? 4 : 0;
        if (y % 4 === 3 || (x + off) % 8 === 7) px(x, y, hex('#d8cfc0', (r() - 0.5) * 0.1));
      }
  },
  turquoise: (px, r) => {
    noise(px, r, '#3fcab8', 0.06);
    for (let i = 0; i < TEX; i++) {
      px(i, 0, hex('#8af0e2'));
      px(0, i, hex('#8af0e2'));
      px(i, TEX - 1, hex('#1f9284'));
      px(TEX - 1, i, hex('#1f9284'));
    }
    // Losange du logo.
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++)
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) === 4) px(x, y, hex('#d9fff9'));
  },
  coral: (px, r) => {
    noise(px, r, '#ff8a6a', 0.06);
    for (let i = 0; i < TEX; i++) {
      px(i, 0, hex('#ffc0ad'));
      px(0, i, hex('#ffc0ad'));
      px(i, TEX - 1, hex('#d95e3f'));
      px(TEX - 1, i, hex('#d95e3f'));
    }
    for (let y = 4; y < 12; y += 4)
      for (let x = 2; x < 14; x++) px(x, y + ((x >> 1) % 2), hex('#ffd9cc'));
  },
  bedrock: (px, r) => {
    noise(px, r, '#2b3352', 0.25);
    speckle(px, r, '#141a2b', 14, 2);
  },
  pad: (px, r) => {
    noise(px, r, '#ffc857', 0.05);
    // Losange de MalinosLand : lisible de tous les côtés (une face du dessus n'a pas de sens).
    for (let y = 0; y < TEX; y++)
      for (let x = 0; x < TEX; x++) {
        const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        if (d < 2) px(x, y, hex('#22b5a6'));
        else if (d < 3) px(x, y, hex('#5fe3d0'));
        else if (d >= 5 && d < 6) px(x, y, hex('#c99a2e'));
      }
    for (let i = 0; i < TEX; i++) {
      px(i, 0, hex('#fff0c4'));
      px(0, i, hex('#fff0c4'));
      px(i, TEX - 1, hex('#c99a2e'));
      px(TEX - 1, i, hex('#c99a2e'));
    }
  },
  coal_ore: (px, r) => {
    DRAW.stone(px, r, () => {});
    speckle(px, r, '#262a36', 7, 2);
  },
  crystal_ore: (px, r) => {
    DRAW.stone(px, r, () => {});
    for (let i = 0; i < 4; i++) {
      const cx = 3 + Math.floor(r() * 10);
      const cy = 3 + Math.floor(r() * 10);
      px(cx, cy - 1, hex('#d9fff9'));
      px(cx - 1, cy, hex('#5fe3d0'));
      px(cx, cy, hex('#8af0e2'));
      px(cx + 1, cy, hex('#22b5a6'));
      px(cx, cy + 1, hex('#1f9284'));
    }
  },
  table_top: (px, r) => {
    DRAW.planks(px, r, () => {});
    for (let i = 0; i < TEX; i++) {
      px(i, 0, hex('#6e4529'));
      px(0, i, hex('#6e4529'));
      px(i, TEX - 1, hex('#6e4529'));
      px(TEX - 1, i, hex('#6e4529'));
      px(i, 7, hex('#6e4529'));
      px(7, i, hex('#6e4529'));
    }
  },
  table_side: (px, r) => {
    DRAW.planks(px, r, () => {});
    // Une scie et un marteau accrochés.
    for (let x = 3; x < 8; x++) px(x, 4, hex('#c9ced8'));
    for (let x = 3; x < 8; x += 2) px(x, 5, hex('#c9ced8'));
    for (let y = 3; y < 11; y++) px(11, y, hex('#6e4529'));
    for (let x = 9; x < 14; x++) px(x, 3, hex('#5b6478'));
  },
  furnace_side: (px, r) => DRAW.stone(px, r, () => {}),
  furnace_front: (px, r) => {
    DRAW.stone(px, r, () => {});
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, hex('#1f1a17'));
    for (let x = 5; x < 11; x++) px(x, 12, hex(x % 2 ? '#ff7a59' : '#ffc857'));
    for (let x = 6; x < 10; x++) px(x, 11, hex('#ff7a59', -0.2));
  },
  torch: (px, _r, clear) => {
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) clear(x, y);
    for (let y = 6; y < 16; y++) {
      px(7, y, hex('#8a5a36'));
      px(8, y, hex('#6e4529'));
    }
    px(7, 4, hex('#ffc857'));
    px(8, 4, hex('#ffc857'));
    px(7, 5, hex('#ff7a59'));
    px(8, 5, hex('#ff7a59'));
    px(7, 3, hex('#fff0c4'));
  },
};

/** Atlas : une bande de TEX pixels de haut, une case par motif (dans l'ordre de PATTERNS). */
export function buildAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX * PATTERNS.length;
  canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  PATTERNS.forEach((p, i) => {
    const rnd = seededRandom(1000 + i * 97);
    const ox = i * TEX;
    const px: Px = (x, y, c) => {
      ctx.fillStyle = c;
      ctx.clearRect(ox + x, y, 1, 1);
      ctx.fillRect(ox + x, y, 1, 1);
    };
    const clear = (x: number, y: number) => ctx.clearRect(ox + x, y, 1, 1);
    DRAW[p](px, rnd, clear);
  });
  return canvas;
}

/**
 * Icône d'un objet pour l'inventaire : petit cube en perspective pour un cube, symbole sur fond
 * coloré pour les autres objets (outils, charbon, cristal…).
 */
export function drawIcon(canvas: HTMLCanvasElement, atlas: HTMLCanvasElement, item: number): void {
  const size = 40;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  const def = itemDef(item);
  if (!def) return;
  if (!def.block || blockDef(item).small) {
    if (blockDef(item).small) {
      ctx.drawImage(atlas, PATTERNS.indexOf('torch') * TEX, 0, TEX, TEX, 4, 4, 32, 32);
      return;
    }
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(20, 20, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = def.color;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.glyph, 20, 21);
    return;
  }
  const b = blockDef(item);
  const tile = (p: Pattern) => PATTERNS.indexOf(p) * TEX;
  // Trois faces en perspective isométrique (dessus, gauche, droite), assombries comme en jeu.
  const face = (p: Pattern, m: [number, number, number, number, number, number], shade: number) => {
    ctx.save();
    ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
    ctx.drawImage(atlas, tile(p), 0, TEX, TEX, 0, 0, TEX, TEX);
    ctx.fillStyle = `rgba(10,14,26,${1 - shade})`;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(0, 0, TEX, TEX);
    ctx.restore();
  };
  const k = 1.05;
  face(b.tex.top, [k, 0.5 * k, -k, 0.5 * k, 20, 4], 1);
  face(b.tex.side, [k, 0.5 * k, 0, k, 3.2, 12.4], 0.72);
  face(b.tex.side, [k, -0.5 * k, 0, k, 20, 20.8], 0.86);
}
