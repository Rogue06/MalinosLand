/**
 * Page de développement : affiche tous les objets, murs, sols et avatars
 * générés. Lancer `npm run dev` puis ouvrir /art-preview.html.
 */
import { CATALOG } from '../content/catalog';
import { AVATAR_PRESETS, DEFAULT_APPEARANCE, HAIR_STYLES } from '../content/avatars';
import { FLOOR_TYPES, WALL_TYPES } from '../world/types';
import type { Rotation } from '../core/rotation';
import { IsoBuilder } from '../game/art/iso3d';
import { DECOR_ART, OBJECT_ART } from '../game/art/objects';
import { drawFloor } from '../game/art/floors';
import { drawWall, wallFaceY } from '../game/art/walls';
import { renderAvatarSheet } from '../game/art/characters';
import { renderPoster } from '../game/art/posters';
import { MUSEUM_CATEGORIES } from '../content/museum';

const root = document.getElementById('root')!;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  root.append(h, grid);
  return grid;
}

function card(parent: HTMLElement, label: string, canvases: HTMLCanvasElement[]): void {
  const c = document.createElement('div');
  c.className = 'card';
  const row = document.createElement('div');
  row.className = 'row';
  for (const cv of canvases) {
    cv.style.width = `${cv.width / 2}px`;
    row.append(cv);
  }
  const span = document.createElement('span');
  span.textContent = label;
  c.append(row, span);
  parent.append(c);
}

// Affiches du musée : un titre court et un titre long par catégorie (voir docs/MUSEE.md).
const POSTER_SAMPLES = [
  { title: 'Malino Notes', author: 'Rogue06' },
  { title: 'Un générateur de quiz pour réviser avec ses enfants', author: 'Joshua' },
];
const posters = section('Affiches du Musée des Malinos');
MUSEUM_CATEGORIES.forEach((cat, i) => {
  card(
    posters,
    cat.label,
    POSTER_SAMPLES.map((s, k) => renderPoster({ ...s, id: 7 + i * 2 + k, category: cat.id }, 2)),
  );
});

const objects = section('Objets du catalogue (4 rotations)');
for (const [type, entry] of Object.entries(CATALOG)) {
  const art = OBJECT_ART[type];
  if (!art) continue;
  const rots: Rotation[] = [0, 1, 2, 3];
  card(
    objects,
    `${type} — ${entry.name}`,
    rots.map((rot) => {
      const b = new IsoBuilder(rot, entry.footprint[0], entry.footprint[1]);
      art(b, 0);
      return b.render(2).canvas;
    }),
  );
}

const avatars = section('Avatars');
for (const preset of AVATAR_PRESETS) {
  card(avatars, preset.name, [renderAvatarSheet(preset.look, 2).canvas]);
}

// Chaque coiffure avec un casque : vérifie que les accessoires ne traversent pas les cheveux.
const hairs = section('Coiffures avec casque (4 orientations)');
HAIR_STYLES.forEach((name, hair) => {
  const sheet = renderAvatarSheet({ ...DEFAULT_APPEARANCE, hair, hairColor: 7, accessory: 2 }, 2);
  const crop = document.createElement('canvas');
  crop.width = sheet.frameW;
  crop.height = sheet.frameH * 4;
  // Première colonne de la feuille : pose immobile pour les 4 orientations.
  crop
    .getContext('2d')!
    .drawImage(sheet.canvas, 0, 0, sheet.frameW, crop.height, 0, 0, sheet.frameW, crop.height);
  card(hairs, name, [crop]);
});

const walls = section('Murs et décors');
for (const type of WALL_TYPES) {
  card(
    walls,
    type,
    [0, 1, 2, 4, 8, 10, 5, 15].map((m) => drawWall(type, m).render(2).canvas),
  );
}
for (const [type, art] of Object.entries(DECOR_ART)) {
  const b = new IsoBuilder();
  art(b, 0, wallFaceY('tall'));
  card(walls, `décor ${type}`, [b.render(2).canvas]);
}

const floors = section('Sols');
for (const type of FLOOR_TYPES) {
  card(
    floors,
    type,
    [0, 1, 2, 3].map((v) => drawFloor(type, v, 2)),
  );
}
