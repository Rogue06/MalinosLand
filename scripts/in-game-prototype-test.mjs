// Vérifie l'essai dans la vraie scène, avec un profil de test isolé du navigateur utilisateur.
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const site = process.argv[2] || 'http://127.0.0.1:5173';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(site).hostname));
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const errors = [];
const external = [];
const profile = JSON.stringify({ v: 1, data: { name: 'Visiteur', look: {} } });
mkdirSync('screenshots/in-game-prototype', { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== site) external.push(r.url());
  });
  await page.addInitScript((p) => {
    if (!localStorage.getItem('malinosland:profile'))
      localStorage.setItem('malinosland:profile', p);
    localStorage.setItem(
      'malinosland:settings',
      JSON.stringify({
        v: 1,
        data: {
          quality: 'high',
          sounds: false,
          ambience: false,
          alwaysDay: true,
          multiTab: true,
        },
      }),
    );
    localStorage.setItem(
      'malinosland:prototype:settings',
      localStorage.getItem('malinosland:settings'),
    );
  }, profile);
  await page.goto(`${site}/jouer/?prototype=voxel&debug`);
  await page.waitForFunction(() => window.__malinosDebug?.state().fps > 0, { timeout: 45000 });
  const initial = await page.evaluate(async () => {
    const s = window.__localArtPreview;
    return {
      state: window.__malinosDebug.state(),
      avatar: s.avatar.sprite.texture.key,
      changed: s.world.objects.filter((o) => o.variant >= 100).map((o) => [o.x, o.y, o.variant]),
      mapChanged: s.world.map.objects.some((o) => o.variant >= 100),
      profile: localStorage.getItem('malinosland:profile'),
    };
  });
  assert.equal(initial.state.transport, 'offline');
  assert.equal(initial.changed.length, 3);
  assert.equal(initial.mapChanged, false);
  assert.match(initial.avatar, /local-garden-study/);
  const savedProfile = initial.profile;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/in-game-prototype/jardin.png' });

  // Déplacements réels, collisions conservées et profondeur de part et d'autre du sakura.
  assert.equal(await page.evaluate(() => window.__malinosDebug.teleport(16.5, 31.5)), false);
  for (const [x, y, side] of [
    [16.5, 30.5, 'behind'],
    [16.5, 32.5, 'front'],
  ]) {
    assert.equal(
      await page.evaluate(([x, y]) => window.__malinosDebug.teleport(x, y, 'py'), [x, y]),
      true,
    );
    await page.waitForTimeout(180);
    const depths = await page.evaluate(async () => {
      const s = window.__localArtPreview;
      const tree = [...s.renderer3d.objects.values()].find(
        (o) => o.obj.x === 16 && o.obj.y === 31 && o.obj.type === 'tree',
      );
      return [s.avatar.sprite.depth, tree.image.depth];
    });
    assert.ok(
      side === 'behind' ? depths[0] < depths[1] : depths[0] > depths[1],
      `${side}: ${depths}`,
    );
    await page.screenshot({ path: `screenshots/in-game-prototype/${side}.png` });
  }
  await page.evaluate(() => window.__malinosDebug.walkTo(17.5, 30.5));
  await page.waitForFunction(() => !window.__malinosDebug.state().walking);
  assert.ok(
    await page.evaluate(
      () =>
        Math.hypot(window.__malinosDebug.pos().x - 17.5, window.__malinosDebug.pos().y - 30.5) <
        0.15,
    ),
  );

  // Les 16 poses et les 4 orientations des deux arbres doivent avoir des pixels, sans bord coupé.
  const frames = await page.evaluate(async () => {
    const s = window.__localArtPreview;
    const { inGamePrototype } = await import('/src/dev/inGamePrototype.ts');
    const art = inGamePrototype.art(s);
    const bounds = [];
    for (const variant of [100, 102])
      for (const rotation of [0, 1, 2, 3]) {
        const { canvas } = art.objectRenders.tree(rotation, variant, 2);
        const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        let minX = canvas.width,
          minY = canvas.height,
          maxX = 0,
          maxY = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (data[(y * canvas.width + x) * 4 + 3] > 8) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
        bounds.push({
          variant,
          rotation,
          valid:
            minX > 0 &&
            minY > 0 &&
            maxX < canvas.width - 1 &&
            maxY < canvas.height - 1 &&
            maxX > minX,
        });
      }
    return { bounds, frames: s.avatar.sprite.texture.getFrameNames() };
  });
  assert.ok(
    frames.bounds.every((b) => b.valid),
    JSON.stringify(frames.bounds),
  );
  assert.equal(frames.frames.length, 16);
  assert.equal(await page.evaluate(() => window.__malinosDebug.sit('bench') !== false), true);
  await page.waitForTimeout(180);
  assert.match(
    await page.evaluate(async () => window.__localArtPreview.avatar.sprite.frame.name),
    /sit/,
  );

  await page.evaluate(() => window.__malinosDebug.travel('home-0123456789abcdef0123456789abcdef'));
  await page.waitForFunction(
    () => window.__malinosDebug.room() === 'home-0123456789abcdef0123456789abcdef',
  );
  await page.evaluate(() => window.__malinosDebug.travel('hub'));
  await page.waitForFunction(() => window.__malinosDebug.room() === 'hub');
  assert.equal(
    await page.evaluate(
      async () => window.__localArtPreview.world.objects.filter((o) => o.variant >= 100).length,
    ),
    3,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('malinosland:profile')),
    savedProfile,
  );
  assert.deepEqual(external, []);

  // Le jeu habituel ne charge aucun atlas expérimental.
  const assets = [];
  page.on('request', (r) => {
    if (r.url().includes('voxel-assets')) assets.push(r.url());
  });
  await page.goto(`${site}/jouer/?debug`);
  await page.waitForFunction(() => window.__malinosDebug?.state().fps > 0);
  assert.equal(await page.locator('#local-art-preview').count(), 0);
  assert.deepEqual(assets, []);
  assert.deepEqual(errors, []);
  // Les trois atlas validés sont publics ; le code d'atelier reste exclu.
  for (const name of ['avatar', 'oak', 'sakura'])
    assert.ok(
      readdirSync('dist/assets').some(
        (file) => file.startsWith(`${name}-`) && file.endsWith('.png'),
      ),
    );
  for (const file of readdirSync('dist/assets')) {
    assert.doesNotMatch(file, /inGamePrototype|voxel/i);
    if (file.endsWith('.js'))
      assert.doesNotMatch(
        readFileSync(`dist/assets/${file}`, 'utf8'),
        /local-garden-study|blender-source|inGamePrototype/,
      );
  }
  console.log(
    'OK : Hub, 3 arbres, 16 poses, 4 orientations, marche, collision, profondeur, siège, changement de salle, profil intact, hors ligne et exclusion production.',
  );
} finally {
  await browser.close();
}
