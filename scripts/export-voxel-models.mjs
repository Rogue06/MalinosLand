// Exporte les boîtes canoniques du dessin TypeScript vers Blender, sans les dupliquer.
// Le serveur Vite doit tourner. Usage : node scripts/export-voxel-models.mjs [url] [fichier]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:5173/voxel-preview.html';
const output = process.argv[3] || 'art-source/voxel-models.json';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
  throw new Error('Utiliser le serveur local.');
const executablePath =
  process.env.CHROMIUM_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage();
  await page.goto(url);
  const data = await page.evaluate(async () => {
    const { IsoBuilder } = await import('/src/game/art/iso3d.ts');
    const { buildPrototypeAvatar } = await import('/src/game/art/prototype/avatar.ts');
    const { drawPrototypeOak, drawPrototypeSakura } =
      await import('/src/game/art/prototype/trees.ts');
    const original = IsoBuilder.prototype.box;
    let boxes = [];
    const result = {};
    // Export synchrone : pas d'interruption du rendu ou d'écriture sur la scène affichée.
    try {
      IsoBuilder.prototype.box = function (spec) {
        boxes.push(spec);
        return this;
      };
      for (const pose of ['idle', 'walkA', 'walkB', 'sit']) {
        // De dos assis : les jambes cachées par le siège sont omises, comme dans le jeu.
        for (const facing of ['py', 'px', 'ny', 'nx']) {
          boxes = [];
          buildPrototypeAvatar(facing, pose);
          result[`avatar-${facing}-${pose}`] = {
            pivot: 0,
            rotation: ['py', 'px', 'ny', 'nx'].indexOf(facing),
            boxes,
          };
        }
      }
      for (const [name, draw] of [
        ['oak', drawPrototypeOak],
        ['sakura', drawPrototypeSakura],
      ]) {
        for (let rotation = 0; rotation < 4; rotation++) {
          boxes = [];
          draw(new IsoBuilder());
          result[`${name}-${rotation}`] = { pivot: 1, rotation, boxes };
        }
      }
    } finally {
      IsoBuilder.prototype.box = original;
    }
    return { version: 1, projection: '2:1, tuile 64x32, hauteur 32px/unité', models: result };
  });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(`Export : ${Object.keys(data.models).length} modèles dans ${output}`);
} finally {
  await browser.close();
}
