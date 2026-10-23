// Vérifie la galerie réelle dans Chrome : textures, ancrage, cadrage, cache, commandes et réseau.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const site = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'screenshots/voxel';
assert(
  ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(site).hostname),
  'Serveur local uniquement',
);
mkdirSync(out, { recursive: true });
const executablePath =
  process.env.CHROMIUM_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const metrics = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(site).origin) {
      errors.push(`Requête externe : ${url.origin}`);
      return route.abort();
    }
    return route.continue();
  });
  for (const render of ['procedural', 'blender'])
    for (const quality of [1, 2, 4]) {
      await page.goto(`${site}/voxel-preview.html?render=${render}&quality=${quality}&zoom=3`);
      await page.waitForSelector('#gallery[data-ready="true"]');
      await page.waitForFunction(
        async () => window.__voxelPreview.scene.getScenes(true).length === 1,
      );
      assert.equal(await page.locator('#gallery canvas').count(), 1, 'Une seule instance Phaser');
      // Les sprites sont réellement téléchargés dans Phaser, avec deux caches distincts.
      const result = await page.evaluate(async () => {
        const game = window.__voxelPreview;
        const { renderAvatarSheet } = await import('/src/game/art/characters.ts');
        const { renderPrototypeAvatarSheet, PROTOTYPE_APPEARANCE } =
          await import('/src/game/art/prototype/avatar.ts');
        const scene = game.scene.getScenes(true)[0];
        const sprites = scene.children.list.filter((o) => o.type === 'Sprite');
        if (sprites.length !== 2 || sprites[0].texture.key === sprites[1].texture.key)
          throw Error('Collision entre les textures avant/après');
        const scale = Number(document.getElementById('quality').value);
        const check = (canvas, x, y, w, h, label) => {
          w = Math.trunc(w);
          h = Math.trunc(h);
          const data = canvas.getContext('2d').getImageData(x, y, w, h).data;
          let count = 0;
          for (let py = 0; py < h; py++)
            for (let px = 0; px < w; px++)
              if (data[(py * w + px) * 4 + 3] > 8) {
                count++;
                if (px === 0 || py === 0 || px === w - 1 || py === h - 1)
                  throw Error(
                    `Sprite au bord : ${label}, (${px},${py}), cadre ${w}×${h}, alpha ${data[(py * w + px) * 4 + 3]}`,
                  );
              }
          if (count < 30) throw Error('Sprite vide');
          return count;
        };
        const start = performance.now();
        const counts = [];
        for (const render of [renderAvatarSheet, renderPrototypeAvatarSheet]) {
          const sheet = render(PROTOTYPE_APPEARANCE, scale);
          if (sheet.frames.length !== 16 || new Set(sheet.frames.map((f) => f.name)).size !== 16)
            throw Error('Cadres d’avatar incomplets');
          if (sheet.canvas.width > 2048 || sheet.canvas.height > 2048)
            throw Error('Atlas trop grand');
          for (const f of sheet.frames)
            counts.push(
              check(sheet.canvas, f.x, f.y, sheet.frameW, sheet.frameH, `${render.name}:${f.name}`),
            );
        }
        for (const sprite of sprites) {
          const texture = sprite.texture;
          const source = texture.getSourceImage();
          // TextureFactory enregistre les feuilles dans des Canvas, comme en jeu.
          for (const name of texture.getFrameNames()) {
            const f = texture.get(name);
            check(source, f.cutX, f.cutY, f.cutWidth, f.cutHeight, `${texture.key}:${name}`);
          }
        }
        return {
          generationMs: Math.round(performance.now() - start),
          framesChecked: counts.length + 32,
          renderer: game.renderer.type,
        };
      });
      metrics.push({ render, quality, ...result });
      for (const view of ['models', 'garden']) {
        await page.selectOption('#view', view);
        for (const rotation of ['0', '1', '2', '3']) {
          await page.selectOption('#rotation', rotation);
          for (const pose of ['idle', 'walk', 'sit']) {
            await page.selectOption('#pose', pose);
            await page.waitForFunction(async () => {
              const game = window.__voxelPreview;
              const sprites = game.scene
                .getScenes(true)[0]
                .children.list.filter((o) => o.type === 'Sprite');
              const mode = document.getElementById('pose').value;
              return (
                sprites.length === 2 &&
                sprites.every((s) => mode === 'walk' || s.frame.name.endsWith(`:${mode}`))
              );
            });
          }
        }
      }
      // Retour aux modèles, cadrage aux deux zooms extrêmes, puis cache stable après échauffement.
      await page.selectOption('#view', 'models');
      await page.selectOption('#pose', 'idle');
      await page.selectOption('#rotation', '0');
      for (const zoom of ['1', '4']) {
        await page.selectOption('#zoom', zoom);
        const clipped = await page.evaluate(async () => {
          const game = window.__voxelPreview;
          const scene = game.scene.getScenes(true)[0];
          const rowHeight = game.scale.height / 2;
          const bad = [];
          for (const obj of scene.children.list.filter((o) =>
            ['Image', 'Sprite'].includes(o.type),
          )) {
            const frame = obj.frame,
              source = obj.texture.getSourceImage();
            const cv = document.createElement('canvas');
            cv.width = frame.cutWidth;
            cv.height = frame.cutHeight;
            cv.getContext('2d').drawImage(
              source,
              frame.cutX,
              frame.cutY,
              frame.cutWidth,
              frame.cutHeight,
              0,
              0,
              cv.width,
              cv.height,
            );
            const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            let minY = cv.height,
              maxY = 0,
              minX = cv.width,
              maxX = 0;
            for (let y = 0; y < cv.height; y++)
              for (let x = 0; x < cv.width; x++)
                if (data[(y * cv.width + x) * 4 + 3] > 16) {
                  minY = Math.min(y, minY);
                  maxY = Math.max(y, maxY);
                  minX = Math.min(x, minX);
                  maxX = Math.max(x, maxX);
                }
            const row = obj.y < rowHeight ? 0 : 1;
            const top = obj.y + (minY - obj.displayOriginY) * obj.scaleY;
            const bottom = obj.y + (maxY - obj.displayOriginY) * obj.scaleY;
            const left = obj.x + (minX - obj.displayOriginX) * obj.scaleX;
            const right = obj.x + (maxX - obj.displayOriginX) * obj.scaleX;
            if (
              top < row * rowHeight + 45 ||
              bottom > (row + 1) * rowHeight - 32 ||
              left < 0 ||
              right > game.scale.width
            )
              bad.push(obj.texture.key);
          }
          return bad;
        });
        assert.deepEqual(clipped, [], `Cadrage ${render}/${quality}/zoom${zoom}`);
      }
      const textureCount = () =>
        page.evaluate(async () => Object.keys(window.__voxelPreview.textures.list).length);
      const before = await textureCount();
      for (let i = 0; i < 12; i++) await page.selectOption('#rotation', String(i % 4));
      assert.equal(await textureCount(), before, 'Le cache grandit à chaque affichage');
      console.log(
        `OK : ${render}, textures ×${quality}, 4 orientations, 3 modes, 2 vues, zooms ×1/×4`,
      );
    }
  await page.goto(`${site}/voxel-preview.html?render=blender&zoom=4&quality=4`);
  await page.waitForSelector('#gallery[data-ready="true"]');
  await page.screenshot({ path: join(out, 'comparaison-blender.png'), fullPage: true });
  await page.selectOption('#rotation', '2');
  await page.screenshot({ path: join(out, 'comparaison-dos.png'), fullPage: true });
  await page.selectOption('#rotation', '0');
  await page.selectOption('#zoom', '2');
  await page.selectOption('#view', 'garden');
  await page.screenshot({ path: join(out, 'jardin-blender.png'), fullPage: true });
  await page.selectOption('#pose', 'walk');
  const frames = await page.evaluate(async () => {
    const game = window.__voxelPreview;
    const scene = game.scene.getScenes(true)[0];
    return [0, 1800, 3600, 5400].map((t) => {
      scene.update(t + 900);
      const sprites = scene.children.list.filter((o) => o.type === 'Sprite');
      return sprites.map((s) => ({ frame: s.frame.name, depth: s.depth, x: s.x }));
    });
  });
  assert.equal(
    new Set(frames.map((f) => f[0].frame)).size,
    4,
    'La marche doit passer dans les quatre directions',
  );
  assert(
    frames.flat().some((f) => f.depth < 300) && frames.flat().some((f) => f.depth > 300),
    'Passage derrière/devant le sakura',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('#render').isVisible());
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    width: innerWidth,
    gallery: document.querySelector('.viewport').scrollWidth,
  }));
  assert(overflow.body <= overflow.width, 'La page mobile déborde');
  assert(overflow.gallery >= 1120, 'Le dessin conserve sa vraie échelle sur mobile');
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, 'verification.json'),
    JSON.stringify({ browser: browser.version(), metrics, errors }, null, 2) + '\n',
  );
  console.log(
    'OK : cadres non coupés, caches isolés, navigation, marche, mobile et aucune requête externe.',
  );
} finally {
  await browser.close();
}
