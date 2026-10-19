import { useEffect, useRef } from 'preact/hooks';
import type { FloorType } from '../../world/types';
import { peersPosStore, playerPosStore, worldInfoStore, zoneStore } from '../../state';
import { useStore } from '../hooks';

const COLORS: Record<FloorType, string> = {
  wood: '#c99460',
  lounge: '#a8714a',
  hall: '#e4ddd0',
  carpet: '#5a61a8',
  gallery: '#c9ccd6',
  grass: '#6faa4f',
  path: '#cbbfa8',
  deck: '#b07a4c',
  dirt: '#8f6c4b',
};
const CELL = 3;

/** Mini-carte isométrique (dessinée une fois, points des joueurs par-dessus). */
export function Minimap() {
  const map = useStore(worldInfoStore);
  const pos = useStore(playerPosStore);
  const peers = useStore(peersPosStore);
  const zone = useStore(zoneStore);
  const base = useRef<HTMLCanvasElement | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  const w = map ? (map.width + map.height) * CELL : 0;
  const h = map ? ((map.width + map.height) * CELL) / 2 + 4 : 0;
  const ox = map ? map.height * CELL : 0;
  const toScreen = (x: number, y: number) => ({
    x: ox + (x - y) * CELL,
    y: 2 + ((x + y) * CELL) / 2,
  });

  useEffect(() => {
    if (!map) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const entry = map.legend[map.tiles[y]![x]!];
        if (!entry) continue;
        const p = toScreen(x, y);
        ctx.fillStyle = entry.wall
          ? entry.wall === 'low'
            ? '#3a4466'
            : '#1f2740'
          : COLORS[entry.floor ?? 'grass'];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + CELL, p.y + CELL / 2);
        ctx.lineTo(p.x, p.y + CELL);
        ctx.lineTo(p.x - CELL, p.y + CELL / 2);
        ctx.fill();
      }
    }
    base.current = c;
  }, [map]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !base.current) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base.current, 0, 0);
    for (const p of peers) {
      const s = toScreen(p.x, p.y);
      ctx.fillStyle = '#ffc857';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const s = toScreen(pos.x, pos.y);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#22b5a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [pos, peers, map]);

  if (!map) return null;
  return (
    <div class="minimap panel-glass" aria-label="Mini-carte">
      <canvas ref={ref} width={w} height={h} />
      <span class="minimap-caption">{zone?.name ?? map.name}</span>
    </div>
  );
}
