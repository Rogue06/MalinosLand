import { museumCategory, type MuseumCategoryDef } from '../../content/museum';
import { seededRandom } from '../../core/quiz';
import { darken, lighten, mix, rgba } from './color';
import { PALETTE as P } from './palette';

/**
 * Affiches du Musée des Malinos (v0.4) : dessinées à partir des données du projet (catégorie,
 * titre, auteur), sans aucune image stockée. Cadre en bois, fond et motif propres à la
 * catégorie, socle isométrique et pictogramme lumineux, titre en bas.
 * Canvas 2D seulement (pas de Phaser) : la même fonction sert à l'aperçu du formulaire et,
 * dans la salle du musée, aux stands. Le texte est dessiné (fillText), jamais interprété.
 */

/** Taille logique d'une affiche (multipliée par `scale` au rendu). */
export const POSTER_W = 120;
export const POSTER_H = 168;

export interface PosterData {
  /** Numéro du projet (absent pour un aperçu) : varie le motif et s'affiche « n° 12 ». */
  id?: number;
  title: string;
  author?: string;
  category: string;
  /**
   * Aperçu automatique du site (capture 16:10, DEC-040) : affiché comme un petit écran à la
   * place du socle et du pictogramme. Absent : affiche dessinée seulement.
   */
  image?: CanvasImageSource | null;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, sans-serif";
const FRAME = 5;
const MAT = 3;
const ART = FRAME + MAT;

/** Petit hachage stable (FNV-1a) : la même affiche à chaque affichage. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Coupe un titre en lignes de largeur `maxWidth` (mesurée par `measure`). Un mot trop long est
 * coupé lettre par lettre.
 */
export function wrapTitle(
  title: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of title.split(' ').filter(Boolean)) {
    const tryLine = line ? `${line} ${word}` : word;
    if (measure(tryLine) <= maxWidth) {
      line = tryLine;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const ch of Array.from(word)) {
      if (line && measure(line + ch) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Taille de police et lignes du titre : le plus grand texte qui tient en `maxLines` lignes ;
 * sinon la plus petite taille, dernière ligne terminée par « … ».
 */
export function fitTitle(
  title: string,
  maxWidth: number,
  maxLines: number,
  measureAt: (size: number, text: string) => number,
  sizes: readonly number[] = [14, 13, 12, 11, 10, 9],
): { size: number; lines: string[] } {
  for (const size of sizes) {
    const lines = wrapTitle(title, maxWidth, (t) => measureAt(size, t));
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1]!;
  const lines = wrapTitle(title, maxWidth, (t) => measureAt(size, t)).slice(0, maxLines);
  let last = lines[maxLines - 1]!;
  while (last && measureAt(size, `${last}…`) > maxWidth)
    last = Array.from(last).slice(0, -1).join('');
  lines[maxLines - 1] = `${last.trimEnd()}…`;
  return { size, lines };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cadre en bois (biseau clair en haut à gauche, sombre en bas à droite) et passe-partout. */
function drawFrame(ctx: CanvasRenderingContext2D) {
  const W = POSTER_W;
  const H = POSTER_H;
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(0, 0, W, H);
  const bevel = (pts: number[], color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const f = FRAME;
  bevel([0, 0, W, 0, W - f, f, f, f], P.woodLight);
  bevel([0, 0, f, f, f, H - f, 0, H], P.wood);
  bevel([W, 0, W, H, W - f, H - f, W - f, f], darken(P.woodDark, 0.25));
  bevel([0, H, f, H - f, W - f, H - f, W, H], darken(P.woodDark, 0.4));
  // Veinure du bois.
  ctx.strokeStyle = rgba(P.woodLight, 0.35);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(6, 1.6);
  ctx.lineTo(W - 10, 1.6);
  ctx.moveTo(1.6, 10);
  ctx.lineTo(1.6, H - 14);
  ctx.stroke();
  // Passe-partout crème, ombré sur le bord haut (lumière du musée venant d'en haut).
  ctx.fillStyle = P.cream;
  ctx.fillRect(f, f, W - 2 * f, H - 2 * f);
  ctx.fillStyle = rgba('#000000', 0.18);
  ctx.fillRect(f, f, W - 2 * f, 1);
}

type Rand = () => number;

/** Motif de fond propre à chaque catégorie (varié d'une affiche à l'autre). */
function drawPattern(
  ctx: CanvasRenderingContext2D,
  cat: MuseumCategoryDef,
  rnd: Rand,
  w: number,
  h: number,
) {
  const a = cat.poster.accent;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (cat.id) {
    case 'site': {
      // Treillis isométrique et fenêtres de navigateur flottantes.
      ctx.strokeStyle = rgba(a, 0.13);
      ctx.lineWidth = 0.6;
      for (let k = -h; k < w + h; k += 12) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + h * 2, h);
        ctx.moveTo(k, 0);
        ctx.lineTo(k - h * 2, h);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const ww = 22 + rnd() * 14;
        const x = rnd() * (w - ww);
        const y = 22 + rnd() * 60;
        ctx.fillStyle = rgba(a, 0.13);
        roundRect(ctx, x, y, ww, ww * 0.62, 2);
        ctx.fill();
        ctx.fillStyle = rgba(a, 0.25);
        ctx.fillRect(x + 1, y + 1, ww - 2, 3);
      }
      break;
    }
    case 'application': {
      // Grille d'icônes d'applications, certaines pleines, d'autres en creux.
      const size = 13;
      for (let y = 4; y < h; y += size + 5)
        for (let x = 4 + ((y / (size + 5)) % 2) * 3; x < w; x += size + 5) {
          const t = rnd();
          roundRect(ctx, x, y, size, size, 3.5);
          if (t < 0.35) {
            ctx.fillStyle = rgba(a, 0.08 + rnd() * 0.16);
            ctx.fill();
          } else if (t < 0.6) {
            ctx.strokeStyle = rgba(a, 0.16);
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      break;
    }
    case 'outil-ia': {
      // Réseau de neurones : nœuds reliés à leurs plus proches voisins.
      const nodes = Array.from({ length: 16 }, () => ({ x: rnd() * w, y: rnd() * h * 0.85 }));
      ctx.strokeStyle = rgba(a, 0.22);
      ctx.lineWidth = 0.6;
      for (const n of nodes) {
        const near = [...nodes]
          .sort((p, q) => Math.hypot(p.x - n.x, p.y - n.y) - Math.hypot(q.x - n.x, q.y - n.y))
          .slice(1, 3);
        for (const m of near) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
      }
      for (const n of nodes) {
        const r = 1 + rnd() * 1.6;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
        g.addColorStop(0, rgba(a, 0.55));
        g.addColorStop(1, rgba(a, 0));
        ctx.fillStyle = g;
        ctx.fillRect(n.x - r * 3, n.y - r * 3, r * 6, r * 6);
        ctx.fillStyle = rgba('#ffffff', 0.7);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'jeu': {
      // Pixels, croix et ronds de manette.
      const cell = 6;
      for (let y = 0; y < h; y += cell)
        for (let x = 0; x < w; x += cell)
          if (rnd() < 0.09) {
            ctx.fillStyle = rgba(a, 0.08 + rnd() * 0.14);
            ctx.fillRect(x, y, cell - 1, cell - 1);
          }
      ctx.strokeStyle = rgba(a, 0.3);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const x = rnd() * w;
        const y = 10 + rnd() * h * 0.7;
        ctx.beginPath();
        if (i % 2) {
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
        } else ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'creation': {
      // Taches de couleur douces et coups de pinceau.
      const colors = [P.sun, P.coral, P.tealLight, P.violet, a];
      for (let i = 0; i < 7; i++) {
        const x = rnd() * w;
        const y = rnd() * h * 0.8;
        const r = 10 + rnd() * 22;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = colors[i % colors.length]!;
        g.addColorStop(0, rgba(c, 0.32));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = rgba(colors[(i + 2) % colors.length]!, 0.35);
        const y = 18 + rnd() * h * 0.6;
        ctx.beginPath();
        ctx.moveTo(-4, y);
        ctx.bezierCurveTo(w * 0.3, y - 14 + rnd() * 28, w * 0.7, y - 14 + rnd() * 28, w + 4, y);
        ctx.stroke();
      }
      break;
    }
    case 'open-source': {
      // Branches de code qui se séparent et se rejoignent, avec leurs étapes.
      const lanes = [w * 0.18, w * 0.5, w * 0.82];
      ctx.lineWidth = 1.4;
      lanes.forEach((x, i) => {
        ctx.strokeStyle = rgba(a, 0.16 + i * 0.05);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        for (let y = 6 + rnd() * 10; y < h; y += 14 + rnd() * 14) {
          ctx.fillStyle = rgba(a, 0.35);
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.strokeStyle = rgba(a, 0.22);
      for (let i = 0; i < 4; i++) {
        const from = lanes[i % 2 === 0 ? 1 : i % 3]!;
        const to = lanes[(i + 1) % 3]!;
        const y = 12 + rnd() * h * 0.7;
        ctx.beginPath();
        ctx.moveTo(from, y);
        ctx.bezierCurveTo(from, y + 10, to, y + 6, to, y + 18);
        ctx.stroke();
      }
      break;
    }
  }
}

/** Pictogramme de la catégorie, centré en (0, 0), environ 30 unités de large. */
function drawGlyph(ctx: CanvasRenderingContext2D, cat: MuseumCategoryDef) {
  const white = '#ffffff';
  ctx.strokeStyle = white;
  ctx.fillStyle = white;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (cat.id) {
    case 'site': {
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 13, 0, 0, Math.PI * 2);
      ctx.moveTo(-13, 0);
      ctx.lineTo(13, 0);
      ctx.moveTo(-11, -6.5);
      ctx.lineTo(11, -6.5);
      ctx.moveTo(-11, 6.5);
      ctx.lineTo(11, 6.5);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      break;
    }
    case 'application': {
      roundRect(ctx, -9.5, -15, 19, 30, 4);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-2.5, -11.5);
      ctx.lineTo(2.5, -11.5);
      ctx.stroke();
      for (const [x, y] of [
        [-5.5, -6],
        [0.5, -6],
        [-5.5, 0],
        [0.5, 0],
      ] as const) {
        roundRect(ctx, x, y, 5, 5, 1.2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 10, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'outil-ia': {
      const star = (x: number, y: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y);
        ctx.quadraticCurveTo(x, y, x, y - r);
        ctx.fill();
      };
      star(-2, 2, 14);
      star(10, -10, 5.5);
      star(11, 9, 3.2);
      break;
    }
    case 'jeu': {
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(9, -8);
      ctx.bezierCurveTo(16, -8, 19, 2, 17, 8);
      ctx.bezierCurveTo(15, 13, 10, 12, 7, 6);
      ctx.lineTo(-7, 6);
      ctx.bezierCurveTo(-10, 12, -15, 13, -17, 8);
      ctx.bezierCurveTo(-19, 2, -16, -8, -9, -8);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -1);
      ctx.lineTo(-6, -1);
      ctx.moveTo(-9, -4);
      ctx.lineTo(-9, 2);
      ctx.stroke();
      for (const [x, y] of [
        [8, -3],
        [12, 0.5],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'creation': {
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.bezierCurveTo(12, -13, 17, -4, 15, 4);
      ctx.bezierCurveTo(13, 10, 6, 7, 4, 11);
      ctx.bezierCurveTo(2, 15, -3, 14, -8, 12);
      ctx.bezierCurveTo(-16, 8, -17, -4, -11, -10);
      ctx.bezierCurveTo(-8, -12.5, -4, -13, 0, -13);
      ctx.closePath();
      ctx.fillStyle = rgba(white, 0.95);
      ctx.fill();
      const dots: Array<[number, number, string]> = [
        [-7, -5, P.coral],
        [0, -8, P.sun],
        [7, -5, P.teal],
        [-8.5, 3, P.violet],
      ];
      for (const [x, y, c] of dots) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = darken(cat.poster.bottom, 0.1);
      ctx.beginPath();
      ctx.arc(4, 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'open-source': {
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(-7, 9);
      ctx.moveTo(8, -6);
      ctx.bezierCurveTo(8, 3, -7, -1, -7, 7);
      ctx.stroke();
      for (const [x, y] of [
        [-7, -11],
        [8, -9],
        [-7, 11],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = cat.poster.bottom;
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
  }
}

/** Socle isométrique (face du dessus centrée en cx, ty), dans les couleurs de la catégorie. */
function drawPedestal(
  ctx: CanvasRenderingContext2D,
  cat: MuseumCategoryDef,
  cx: number,
  ty: number,
) {
  const hw = 21;
  const hh = 10.5;
  const depth = 15;
  const face = (pts: number[], color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  // Halo au sol.
  const g = ctx.createRadialGradient(cx, ty + hh + depth, 0, cx, ty + hh + depth, 30);
  g.addColorStop(0, rgba('#000000', 0.28));
  g.addColorStop(1, rgba('#000000', 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - 32, ty + depth - 6, 64, 34);
  const base = mix(mix(cat.poster.top, cat.poster.bottom, 0.5), P.cream, 0.42);
  face([cx - hw, ty, cx, ty + hh, cx, ty + hh + depth, cx - hw, ty + depth], lighten(base, 0.12));
  face([cx + hw, ty, cx, ty + hh, cx, ty + hh + depth, cx + hw, ty + depth], darken(base, 0.18));
  face(
    [cx, ty - hh, cx + hw, ty, cx, ty + hh, cx - hw, ty],
    lighten(mix(base, cat.poster.accent, 0.4), 0.35),
  );
  // Liseré lumineux et bandeau du socle.
  ctx.strokeStyle = rgba('#ffffff', 0.55);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - hw, ty);
  ctx.lineTo(cx, ty + hh);
  ctx.lineTo(cx + hw, ty);
  ctx.stroke();
  ctx.strokeStyle = rgba(cat.poster.accent, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - hw, ty + depth - 4);
  ctx.lineTo(cx, ty + hh + depth - 4);
  ctx.lineTo(cx + hw, ty + depth - 4);
  ctx.stroke();
  // Faisceau lumineux qui monte du dessus du socle vers le pictogramme.
  const beam = ctx.createLinearGradient(0, ty, 0, ty - 50);
  beam.addColorStop(0, rgba(cat.poster.accent, 0.42));
  beam.addColorStop(1, rgba(cat.poster.accent, 0));
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - 9, ty);
  ctx.lineTo(cx - 19, ty - 50);
  ctx.lineTo(cx + 19, ty - 50);
  ctx.lineTo(cx + 9, ty);
  ctx.closePath();
  ctx.fill();
  const lens = ctx.createRadialGradient(cx, ty, 0, cx, ty, 10);
  lens.addColorStop(0, rgba('#ffffff', 0.95));
  lens.addColorStop(0.35, rgba(cat.poster.accent, 0.8));
  lens.addColorStop(1, rgba(cat.poster.accent, 0));
  ctx.save();
  ctx.translate(cx, ty);
  ctx.scale(1, 0.45);
  ctx.translate(-cx, -ty);
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(cx, ty, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Aperçu du site en petit écran : cadre sombre, image recadrée, reflet et pied. */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  cat: MuseumCategoryDef,
  image: CanvasImageSource,
  w: number,
) {
  const x = 6;
  const y = 20;
  const sw = w - 12;
  const sh = sw * 0.625; // 16:10, comme les captures
  const cx = w / 2;
  // Halo de la couleur d'accent derrière l'écran.
  const halo = ctx.createRadialGradient(cx, y + sh / 2, 4, cx, y + sh / 2, sw * 0.75);
  halo.addColorStop(0, rgba(cat.poster.accent, 0.45));
  halo.addColorStop(1, rgba(cat.poster.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, y - 20, w, sh + 40);
  // Pied de l'écran.
  ctx.fillStyle = darken(cat.poster.bottom, 0.35);
  ctx.fillRect(cx - 4, y + sh + 1, 8, 7);
  ctx.beginPath();
  ctx.ellipse(cx, y + sh + 9, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cadre, puis l'image recadrée pour remplir l'écran.
  ctx.save();
  ctx.shadowColor = rgba('#000000', 0.45);
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#0d1220';
  roundRect(ctx, x - 2.5, y - 2.5, sw + 5, sh + 5, 3);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, sw, sh, 1.5);
  ctx.clip();
  const iw = (image as { width: number }).width || 640;
  const ih = (image as { height: number }).height || 400;
  const k = Math.max(sw / iw, sh / ih);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x + (sw - iw * k) / 2, y + (sh - ih * k) / 2, iw * k, ih * k);
  // Reflet de la vitre.
  const glass = ctx.createLinearGradient(x, y, x + sw, y + sh);
  glass.addColorStop(0, rgba('#ffffff', 0.16));
  glass.addColorStop(0.35, rgba('#ffffff', 0.02));
  glass.addColorStop(1, rgba('#ffffff', 0));
  ctx.fillStyle = glass;
  ctx.fillRect(x, y, sw, sh);
  ctx.restore();
  ctx.strokeStyle = rgba(cat.poster.accent, 0.7);
  ctx.lineWidth = 0.6;
  roundRect(ctx, x - 2.5, y - 2.5, sw + 5, sh + 5, 3);
  ctx.stroke();
}

/** Dessine l'affiche dans `ctx`, en unités logiques (POSTER_W × POSTER_H) multipliées par `scale`. */
export function drawPoster(ctx: CanvasRenderingContext2D, data: PosterData, scale = 1): void {
  const cat = museumCategory(data.category);
  const rnd = seededRandom(hash(`${data.id ?? 0}|${data.category}|${data.title}`));
  const w = POSTER_W - 2 * ART;
  const h = POSTER_H - 2 * ART;
  const cx = w / 2;

  ctx.save();
  ctx.scale(scale, scale);
  drawFrame(ctx);

  ctx.save();
  ctx.translate(ART, ART);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Fond en dégradé, motif, puis lumière du projecteur venant d'en haut.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, cat.poster.top);
  bg.addColorStop(1, cat.poster.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  drawPattern(ctx, cat, rnd, w, h);
  const spot = ctx.createRadialGradient(cx, -14, 4, cx, 10, h * 0.85);
  spot.addColorStop(0, rgba('#ffffff', 0.32));
  spot.addColorStop(0.5, rgba('#ffffff', 0.08));
  spot.addColorStop(1, rgba('#ffffff', 0));
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  if (data.image) drawScreen(ctx, cat, data.image, w);
  else {
    // Socle et pictogramme flottant, avec un halo de la couleur d'accent.
    const ty = 72;
    drawPedestal(ctx, cat, cx, ty);
    ctx.save();
    ctx.translate(cx, ty - 26);
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    halo.addColorStop(0, rgba(cat.poster.accent, 0.55));
    halo.addColorStop(1, rgba(cat.poster.accent, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-26, -26, 52, 52);
    ctx.shadowColor = rgba(darken(cat.poster.bottom, 0.4), 0.6);
    ctx.shadowBlur = 3 * scale;
    ctx.shadowOffsetY = 1.5 * scale;
    ctx.scale(1.15, 1.15);
    drawGlyph(ctx, cat);
    ctx.restore();
  }

  // Étiquette de catégorie et numéro d'inventaire.
  ctx.font = `800 6.5px ${FONT}`;
  ctx.textBaseline = 'middle';
  const label = cat.label.toUpperCase();
  const lw = ctx.measureText(label).width + 9;
  ctx.fillStyle = rgba(darken(cat.poster.bottom, 0.3), 0.55);
  roundRect(ctx, 5, 5, lw, 10, 5);
  ctx.fill();
  ctx.fillStyle = cat.poster.accent;
  ctx.fillText(label, 9.5, 10.4);
  if (data.id) {
    ctx.textAlign = 'right';
    ctx.font = `600 6px ${FONT}`;
    ctx.fillStyle = rgba('#ffffff', 0.7);
    ctx.fillText(`n° ${data.id}`, w - 6, 10.4);
    ctx.textAlign = 'left';
  }

  // Bas de l'affiche : voile sombre, titre et auteur.
  const veil = ctx.createLinearGradient(0, h - 64, 0, h);
  veil.addColorStop(0, rgba(darken(cat.poster.bottom, 0.5), 0));
  veil.addColorStop(0.45, rgba(darken(cat.poster.bottom, 0.5), 0.6));
  veil.addColorStop(1, rgba(darken(cat.poster.bottom, 0.6), 0.85));
  ctx.fillStyle = veil;
  ctx.fillRect(0, h - 64, w, 64);

  const maxWidth = w - 12;
  const { size, lines } = fitTitle(data.title || 'Ton projet', maxWidth, 3, (s, t) => {
    ctx.font = `800 ${s}px ${FONT}`;
    return ctx.measureText(t).width;
  });
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = rgba('#000000', 0.55);
  ctx.shadowBlur = 2 * scale;
  ctx.shadowOffsetY = 0.8 * scale;
  ctx.fillStyle = '#ffffff';
  const lead = size * 1.12;
  const lastBaseline = h - (data.author ? 15 : 9);
  lines.forEach((line, i) => ctx.fillText(line, cx, lastBaseline - (lines.length - 1 - i) * lead));
  if (data.author) {
    ctx.font = `600 7px ${FONT}`;
    ctx.fillStyle = lighten(cat.poster.accent, 0.3);
    ctx.fillText(`par ${data.author}`, cx, h - 5.5);
  }
  ctx.shadowColor = 'transparent';

  // Reflet du verre, en diagonale.
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0.28, rgba('#ffffff', 0));
  sheen.addColorStop(0.36, rgba('#ffffff', 0.09));
  sheen.addColorStop(0.44, rgba('#ffffff', 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Ombre portée du passe-partout sur l'œuvre.
  ctx.strokeStyle = rgba('#000000', 0.25);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(ART + 0.4, ART + 0.4, w - 0.8, h - 0.8);
  ctx.restore();
}

/** Affiche dans un nouveau canevas (aperçu du formulaire, page de prévisualisation). */
export function renderPoster(data: PosterData, scale = 2): HTMLCanvasElement {
  return posterCanvas(data, scale);
}

/**
 * Affiche d'un stand encore libre : invitation à exposer sa création (cadre identique, fond
 * clair, contour pointillé et grand « + »).
 */
export function drawEmptyPoster(ctx: CanvasRenderingContext2D, scale = 1): void {
  const w = POSTER_W - 2 * ART;
  const h = POSTER_H - 2 * ART;
  const cx = w / 2;
  ctx.save();
  ctx.scale(scale, scale);
  drawFrame(ctx);
  ctx.save();
  ctx.translate(ART, ART);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f4efe4');
  bg.addColorStop(1, '#e2d8c6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // Fin quadrillage isométrique, comme un plan d'architecte.
  ctx.strokeStyle = rgba(P.slate, 0.08);
  ctx.lineWidth = 0.5;
  for (let k = -h; k < w + h; k += 10) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + h * 2, h);
    ctx.moveTo(k, 0);
    ctx.lineTo(k - h * 2, h);
    ctx.stroke();
  }
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = rgba(P.teal, 0.75);
  ctx.lineWidth = 1.2;
  roundRect(ctx, 7, 7, w - 14, h - 14, 6);
  ctx.stroke();
  ctx.setLineDash([]);
  // Grand « + » dans un disque turquoise.
  const cy = h * 0.4;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
  g.addColorStop(0, rgba(P.tealLight, 0.5));
  g.addColorStop(1, rgba(P.tealLight, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - 24, cy - 24, 48, 48);
  ctx.fillStyle = P.teal;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6.5, cy);
  ctx.lineTo(cx + 6.5, cy);
  ctx.moveTo(cx, cy - 6.5);
  ctx.lineTo(cx, cy + 6.5);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = P.slate;
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText('Ta création', cx, h * 0.66);
  ctx.fillText('ici ?', cx, h * 0.66 + 13);
  ctx.font = `600 7px ${FONT}`;
  ctx.fillStyle = darken(P.teal, 0.15);
  ctx.fillText('Expose-la au musée', cx, h - 16);
  ctx.restore();
  ctx.restore();
}

/** Affiche (ou affiche d'invitation si `data` est null) dans un canevas, pour le jeu. */
export function posterCanvas(data: PosterData | null, scale = 2): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(POSTER_W * scale);
  canvas.height = Math.round(POSTER_H * scale);
  const ctx = canvas.getContext('2d')!;
  if (data) drawPoster(ctx, data, scale);
  else drawEmptyPoster(ctx, scale);
  return canvas;
}
