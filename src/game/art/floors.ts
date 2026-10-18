import { TILE_H, TILE_W } from '../../core/iso';
import { seededRandom } from '../../core/random';
import type { FloorType } from '../../world/types';
import { darken, lighten, mix } from './color';
import { PALETTE as P } from './palette';

export const FLOOR_VARIANTS = 4;

const BASE: Record<FloorType, string> = {
  wood: '#c99460',
  lounge: '#a8714a',
  hall: '#e4ddd0',
  carpet: '#3f4580',
  gallery: '#d6d8de',
  grass: P.grass,
  path: '#cbbfa8',
  deck: '#b07a4c',
  dirt: '#a07a55',
};

/**
 * Dessine une tuile de sol (losange) dans un canvas. Le losange est très
 * légèrement agrandi pour masquer les joints entre tuiles voisines.
 */
export function drawFloor(type: FloorType, variant: number, scale: number): HTMLCanvasElement {
  const w = TILE_W * scale;
  const h = TILE_H * scale;
  const pad = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(pad + w / 2, pad);
  ctx.scale(scale, scale);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const grow = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -grow);
  ctx.lineTo(hw + grow * 2, hh);
  ctx.lineTo(0, TILE_H + grow);
  ctx.lineTo(-hw - grow * 2, hh);
  ctx.closePath();
  ctx.clip();

  const rnd = seededRandom(variant * 977 + type.length * 131);
  const base = BASE[type];
  ctx.fillStyle = base;
  ctx.fillRect(-hw - 4, -4, TILE_W + 8, TILE_H + 8);

  // Point monde (u, v) de la tuile → pixel local.
  const W = (u: number, v: number): [number, number] => [(u - v) * hw, (u + v) * hh];
  const line = (u0: number, v0: number, u1: number, v1: number, color: string, width = 0.7) => {
    ctx.beginPath();
    ctx.moveTo(...W(u0, v0));
    ctx.lineTo(...W(u1, v1));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const quad = (u0: number, v0: number, u1: number, v1: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(...W(u0, v0));
    ctx.lineTo(...W(u1, v0));
    ctx.lineTo(...W(u1, v1));
    ctx.lineTo(...W(u0, v1));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  switch (type) {
    case 'wood':
    case 'deck':
    case 'lounge': {
      const isDeck = (type as FloorType) === 'deck';
      const n = isDeck ? 4 : 5;
      const alongX = !isDeck;
      for (let i = 0; i < n; i++) {
        const c = mix(base, rnd() > 0.5 ? lighten(base, 0.2) : darken(base, 0.15), rnd() * 0.6);
        if (alongX) quad(0, i / n, 1, (i + 1) / n, c);
        else quad(i / n, 0, (i + 1) / n, 1, c);
        const seam = darken(base, isDeck ? 0.45 : 0.3);
        if (alongX) line(0, i / n, 1, i / n, seam, 0.6);
        else line(i / n, 0, i / n, 1, seam, 1);
        const cut = 0.2 + rnd() * 0.6;
        if (alongX) line(cut, i / n, cut, (i + 1) / n, seam, 0.6);
        else line(i / n, cut, (i + 1) / n, cut, seam, 0.6);
      }
      break;
    }
    case 'hall': {
      quad(0, 0, 1, 1, variant % 2 === 0 ? base : '#d8d0c1');
      for (let i = 0; i < 18; i++) {
        const u = rnd();
        const v = rnd();
        const [x, y] = W(u, v);
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,100,80,0.12)';
        ctx.fillRect(x, y, 0.8, 0.8);
      }
      line(0, 0, 1, 0, 'rgba(110,95,75,0.35)', 0.8);
      line(0, 0, 0, 1, 'rgba(255,255,255,0.5)', 0.8);
      break;
    }
    case 'carpet':
    case 'gallery': {
      for (let i = 0; i < 40; i++) {
        const [x, y] = W(rnd(), rnd());
        ctx.fillStyle =
          type === 'carpet' ? (rnd() > 0.5 ? '#4a5196' : '#363c70') : 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, 1, 1);
      }
      if (type === 'gallery') line(0, 0, 1, 0, 'rgba(120,125,140,0.3)', 0.6);
      break;
    }
    case 'grass': {
      for (let i = 0; i < 26; i++) {
        const [x, y] = W(rnd(), rnd());
        ctx.strokeStyle = rnd() > 0.5 ? '#6aa84c' : '#8fca6a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 1.5, y - 2 - rnd() * 1.5);
        ctx.stroke();
      }
      if (variant === 3) {
        for (let i = 0; i < 3; i++) {
          const [x, y] = W(0.2 + rnd() * 0.6, 0.2 + rnd() * 0.6);
          ctx.fillStyle = [P.white, P.sun, '#f2a7c3'][i]!;
          ctx.fillRect(x, y, 1.4, 1.4);
        }
      }
      break;
    }
    case 'path': {
      for (let a = 0; a < 2; a++) {
        for (let c = 0; c < 2; c++) {
          const tone = mix(base, rnd() > 0.5 ? '#e0d6c2' : '#b3a68e', rnd() * 0.7);
          quad(a / 2 + 0.02, c / 2 + 0.02, (a + 1) / 2 - 0.02, (c + 1) / 2 - 0.02, tone);
        }
      }
      break;
    }
    case 'dirt': {
      for (let i = 0; i < 22; i++) {
        const [x, y] = W(rnd(), rnd());
        ctx.fillStyle = rnd() > 0.5 ? '#8c6a49' : '#b8916a';
        ctx.fillRect(x, y, 1.3, 1);
      }
      break;
    }
  }
  return canvas;
}
