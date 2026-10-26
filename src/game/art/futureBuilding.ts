import { darken, lighten, rgba } from './color';
import { PALETTE as P } from './palette';

/**
 * Maquette du futur Bâtiment des créations (PR 11), affichée sur le grand panneau du chantier.
 * Illustration dessinée au Canvas 2D, sans image stockée : un immeuble aux façades presque
 * entièrement vitrées, où l'on voit des Malinos visiter les expositions (demande du
 * responsable), une grue et le titre du projet. Ce n'est qu'une promesse : le bâtiment n'existe
 * pas encore dans le jeu.
 */

/** Taille logique de l'illustration (multipliée par `scale` au rendu), rapport 1,6. */
export const FUTURE_W = 200;
export const FUTURE_H = 125;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, sans-serif";

type Pt = { x: number; y: number };

/** Pied de l'arête avant, coins gauche et droit au sol, hauteur des façades. */
const C: Pt = { x: 100, y: 116 };
const LEFT: Pt = { x: 46, y: 85 };
const RIGHT: Pt = { x: 140, y: 93 };
const HEIGHT = 46;
const FLOORS = 3;

const len = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** Silhouettes des visiteurs : couleurs de veste et de cheveux, comme les avatars du jeu. */
const VISITORS = [
  { top: P.coral, hair: '#3b2a20' },
  { top: P.violet, hair: '#e2b45a' },
  { top: P.teal, hair: '#1f1a17' },
  { top: P.sun, hair: '#8a4b2a' },
  { top: '#2f6fd6', hair: '#d9d2c8' },
];
/** Couleurs des affiches accrochées à l'intérieur. */
const FRAMES = [P.coral, P.teal, P.violet, P.sun, '#2f6fd6', P.leaf];

/**
 * Dessine une façade vitrée dans son repère : `s` le long de la façade (0 → `w`), `t` vers le
 * bas depuis le haut du mur (0 → HEIGHT). Intérieur éclairé, affiches et visiteurs, puis la
 * vitre teintée, ses reflets et les montants blancs par-dessus.
 */
function facade(
  ctx: CanvasRenderingContext2D,
  w: number,
  opts: { shade: number; seed: number; door: boolean; columns: number },
) {
  const floorH = HEIGHT / FLOORS;
  // Intérieur : mur du fond chaud et clair, sol un peu plus sombre à chaque étage.
  ctx.fillStyle = darken('#fff3dc', opts.shade);
  ctx.fillRect(0, 0, w, HEIGHT);
  for (let f = 0; f < FLOORS; f++) {
    const top = f * floorH;
    ctx.fillStyle = darken('#e9d3b4', opts.shade);
    ctx.fillRect(0, top + floorH - 2.4, w, 2.4);
    // Affiches au mur, puis visiteurs devant.
    for (let i = 0; i < 3; i++) {
      const k = (opts.seed + f * 3 + i) % FRAMES.length;
      const x = (w / 3) * i + w / 6 - 3;
      ctx.fillStyle = darken('#7a5a3a', opts.shade);
      ctx.fillRect(x - 0.6, top + 2.4, 7.2, 6.4);
      ctx.fillStyle = darken(FRAMES[k]!, opts.shade);
      ctx.fillRect(x, top + 3, 6, 5.2);
    }
    const ground = f === FLOORS - 1 && opts.door;
    const people = ground ? [0.18, 0.84] : f === 1 ? [0.3, 0.62] : [0.48];
    people.forEach((u, i) => {
      const v = VISITORS[(opts.seed + f * 2 + i) % VISITORS.length]!;
      const x = u * w;
      const feet = top + floorH - 2.4;
      ctx.fillStyle = darken('#2a2f45', opts.shade);
      ctx.fillRect(x - 1.6, feet - 3.2, 1.3, 3.2);
      ctx.fillRect(x + 0.3, feet - 3.2, 1.3, 3.2);
      ctx.fillStyle = darken(v.top, opts.shade);
      ctx.beginPath();
      ctx.roundRect(x - 2.4, feet - 7.6, 4.8, 4.8, 1.4);
      ctx.fill();
      ctx.fillStyle = darken('#f1c9a5', opts.shade);
      ctx.beginPath();
      ctx.arc(x, feet - 9.4, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darken(v.hair, opts.shade);
      ctx.beginPath();
      ctx.arc(x, feet - 9.9, 1.95, Math.PI, Math.PI * 2);
      ctx.fill();
    });
  }
  // Vitre : teinte bleutée légère (on voit à travers), plus sombre en bas.
  const glass = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  glass.addColorStop(0, rgba(darken('#9fe3f2', opts.shade), 0.28));
  glass.addColorStop(1, rgba(darken('#3a8fb8', opts.shade), 0.34));
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, w, HEIGHT);
  // Reflets du ciel en diagonale.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, HEIGHT);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (const x0 of [w * 0.12, w * 0.58]) {
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + 9, 0);
    ctx.lineTo(x0 - 9, HEIGHT);
    ctx.lineTo(x0 - 18, HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Porte d'entrée au rez-de-chaussée, sous un auvent turquoise.
  if (opts.door) {
    const dw = 11;
    const dx = w / 2 - dw / 2;
    ctx.fillStyle = rgba('#1b3a52', 0.55);
    ctx.fillRect(dx, HEIGHT - floorH + 3, dw, floorH - 3);
    ctx.fillStyle = P.teal;
    ctx.fillRect(dx - 2.5, HEIGHT - floorH + 1.2, dw + 5, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(w / 2 - 0.3, HEIGHT - floorH + 3.4, 0.6, floorH - 3.4);
  }
  // Montants et dalles : fins traits blancs de façade-rideau.
  ctx.fillStyle = darken('#f4f7fb', opts.shade);
  for (let f = 0; f <= FLOORS; f++) ctx.fillRect(0, f * floorH - 0.6, w, 1.2);
  for (let c = 0; c <= opts.columns; c++) {
    const x = Math.min(w - 0.5, Math.max(0, (w / opts.columns) * c - 0.4));
    ctx.fillRect(x, 0, 0.8, HEIGHT);
  }
}

/** Place le repère d'une façade : du coin `a` (en haut) vers le coin `b`, verticales droites. */
function onFacade(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, draw: (w: number) => void) {
  const w = len(a, b);
  ctx.save();
  ctx.transform((b.x - a.x) / w, (b.y - a.y) / w, 0, 1, a.x, a.y - HEIGHT);
  draw(w);
  ctx.restore();
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = '#7a5235';
  ctx.fillRect(x - 0.9, y - r * 0.6, 1.8, r * 0.9);
  for (const [dx, dy, k] of [
    [0, -r * 1.35, 1],
    [-r * 0.55, -r * 0.95, 0.78],
    [r * 0.55, -r * 0.9, 0.8],
  ] as const) {
    ctx.fillStyle = k === 1 ? color : darken(color, 0.12);
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 1.6, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** Grue de chantier jaune, derrière le bâtiment : il est encore à construire. */
function crane(ctx: CanvasRenderingContext2D) {
  const mast = 166;
  const top = 26;
  const yellow = '#f2b632';
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 1;
  ctx.fillStyle = yellow;
  ctx.fillRect(mast - 2.5, top, 5, 84 - top);
  ctx.strokeStyle = darken(yellow, 0.3);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let y = top; y < 84; y += 5) {
    ctx.moveTo(mast - 2.5, y);
    ctx.lineTo(mast + 2.5, y + 5);
    ctx.moveTo(mast + 2.5, y);
    ctx.lineTo(mast - 2.5, y + 5);
  }
  ctx.stroke();
  // Flèche, contre-flèche et cabine.
  ctx.fillStyle = yellow;
  ctx.fillRect(112, top - 3, mast + 30 - 112, 3);
  ctx.fillStyle = P.metalDark;
  ctx.fillRect(mast + 16, top, 10, 5);
  ctx.fillStyle = P.white;
  ctx.fillRect(mast - 6, top + 1, 6, 5);
  ctx.strokeStyle = darken(yellow, 0.35);
  ctx.beginPath();
  ctx.moveTo(mast, top - 9);
  ctx.lineTo(116, top - 3);
  ctx.moveTo(mast, top - 9);
  ctx.lineTo(mast + 28, top - 3);
  ctx.stroke();
  ctx.fillStyle = yellow;
  ctx.beginPath();
  ctx.moveTo(mast - 2, top - 3);
  ctx.lineTo(mast, top - 10);
  ctx.lineTo(mast + 2, top - 3);
  ctx.fill();
  // Câble et poutre suspendue.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(124, top);
  ctx.lineTo(124, top + 12);
  ctx.stroke();
  ctx.fillStyle = P.coral;
  ctx.fillRect(117, top + 12, 14, 2.2);
}

function drawFuture(ctx: CanvasRenderingContext2D) {
  const W = FUTURE_W;
  const H = FUTURE_H;
  // Ciel d'après-midi et soleil.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#7cc8ea');
  sky.addColorStop(0.6, '#cdeef6');
  sky.addColorStop(1, '#fff1d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,244,200,0.9)';
  ctx.beginPath();
  ctx.arc(28, 38, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [x, y, r] of [
    [60, 34, 5],
    [67, 32, 6.5],
    [75, 35, 4.5],
    [176, 48, 4],
    [182, 46, 5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  crane(ctx);
  // Pelouse et allée qui mène à l'entrée.
  ctx.fillStyle = P.grass;
  ctx.fillRect(0, 84, W, H - 84);
  ctx.fillStyle = lighten(P.grass, 0.12);
  ctx.fillRect(0, 84, W, 3);
  const door = { x: (LEFT.x + C.x) / 2, y: (LEFT.y + C.y) / 2 };
  ctx.fillStyle = '#e8dcc6';
  ctx.beginPath();
  ctx.moveTo(door.x - 5, door.y - 1);
  ctx.lineTo(door.x + 5, door.y + 1);
  ctx.lineTo(door.x - 14, H);
  ctx.lineTo(door.x - 36, H);
  ctx.closePath();
  ctx.fill();
  // Ombre portée au sol.
  ctx.fillStyle = 'rgba(30,60,40,0.25)';
  ctx.beginPath();
  ctx.moveTo(C.x, C.y);
  ctx.lineTo(RIGHT.x, RIGHT.y);
  ctx.lineTo(RIGHT.x + 22, RIGHT.y + 6);
  ctx.lineTo(C.x + 18, C.y + 4);
  ctx.closePath();
  ctx.fill();
  tree(ctx, 160, 108, 6, P.leaf);
  // Toit-terrasse, puis les deux façades vitrées.
  const back = { x: LEFT.x + RIGHT.x - C.x, y: LEFT.y + RIGHT.y - C.y };
  const up = (p: Pt, h = HEIGHT): Pt => ({ x: p.x, y: p.y - h });
  ctx.fillStyle = '#eef1f5';
  ctx.beginPath();
  for (const p of [C, LEFT, back, RIGHT].map((p) => up(p))) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(95,227,208,0.55)';
  ctx.beginPath();
  // Verrière sur le toit : petit losange vitré au centre.
  const mid = { x: (up(C).x + up(back).x) / 2, y: (up(C).y + up(back).y) / 2 };
  ctx.moveTo(mid.x, mid.y - 6);
  ctx.lineTo(mid.x + 14, mid.y);
  ctx.lineTo(mid.x, mid.y + 6);
  ctx.lineTo(mid.x - 14, mid.y);
  ctx.closePath();
  ctx.fill();
  onFacade(ctx, LEFT, C, (w) => facade(ctx, w, { shade: 0, seed: 0, door: true, columns: 6 }));
  onFacade(ctx, C, RIGHT, (w) => facade(ctx, w, { shade: 0.16, seed: 3, door: false, columns: 4 }));
  // Bandeau « CRÉATIONS » en haut de la façade d'entrée.
  onFacade(ctx, LEFT, C, (w) => {
    ctx.fillStyle = P.ink;
    ctx.fillRect(w * 0.22, -6.5, w * 0.56, 6.5);
    ctx.fillStyle = P.tealLight;
    ctx.font = `800 5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CRÉATIONS', w / 2, -3.1, w * 0.5);
  });
  // Arête et acrotère, pour bien détacher le volume.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(C.x, C.y);
  ctx.lineTo(C.x, C.y - HEIGHT);
  ctx.stroke();
  ctx.strokeStyle = darken('#eef1f5', 0.25);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(up(LEFT).x, up(LEFT).y);
  ctx.lineTo(up(C).x, up(C).y);
  ctx.lineTo(up(RIGHT).x, up(RIGHT).y);
  ctx.stroke();
  tree(ctx, 30, 104, 7, P.leaf);
  tree(ctx, 178, 118, 5, '#f4a7c4');
  // Titre, en haut, sur un bandeau sombre.
  ctx.fillStyle = rgba(P.ink, 0.92);
  ctx.fillRect(0, 0, W, 21);
  ctx.fillStyle = P.tealLight;
  ctx.fillRect(0, 21, W, 1.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 9.5px ${FONT}`;
  ctx.fillText('FUTUR BÂTIMENT DES CRÉATIONS', W / 2, 8.4, W - 14);
  ctx.fillStyle = '#c9d3ec';
  ctx.font = `600 5.4px ${FONT}`;
  ctx.fillText('Le musée des Malinos s’agrandira ici', W / 2, 16, W - 20);
  // Pastille « bientôt ».
  ctx.fillStyle = P.coral;
  ctx.beginPath();
  ctx.roundRect(W - 46, H - 15, 40, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 5.6px ${FONT}`;
  ctx.fillText('BIENTÔT', W - 26, H - 9.8);
}

let cached: HTMLCanvasElement | null = null;

/** Illustration de la maquette (dessinée une seule fois, puis partagée). */
export function futureBuildingCanvas(scale = 2): HTMLCanvasElement {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(FUTURE_W * scale);
  canvas.height = Math.round(FUTURE_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  drawFuture(ctx);
  return (cached = canvas);
}
