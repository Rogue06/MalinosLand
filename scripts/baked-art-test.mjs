// Validation du build public : éditeur, profils existants, modèles distants et retour de salle.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const site = process.argv[2] || 'http://127.0.0.1:4173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(site).hostname));
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const errors = [];
mkdirSync('screenshots/baked-art', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() =>
    localStorage.setItem(
      'malinosland:settings',
      JSON.stringify({
        v: 1,
        data: {
          quality: 'normal',
          alwaysDay: true,
          sounds: false,
          ambience: false,
          multiTab: true,
        },
      }),
    ),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site}/jouer/?debug`);
  assert.equal(
    await page.getByRole('radio', { name: 'Malino 3D', exact: true }).getAttribute('aria-checked'),
    'true',
  );
  await page.getByPlaceholder('ex. Léa, Max_IA…').fill('Test modeles');
  await page.getByRole('button', { name: 'Entrer dans MalinosLand →' }).click();
  await page.waitForFunction(() => window.__malinosDebug?.art().avatar.includes('malino-v1'));
  const trees = await page.evaluate(() => window.__malinosDebug.art().trees);
  assert.ok(trees.length > 50);
  assert.ok(trees.every((t) => t.frame.includes('baked-v1')));
  assert.deepEqual([...new Set(trees.map((t) => t.variant))].sort(), [0, 1, 2]);
  assert.equal(await page.locator('#local-art-preview').count(), 0);
  await page.evaluate(() => {
    window.__malinosDebug.teleport(17.5, 30.5, 'py');
    window.__malinosDebug.zoom(2.4);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/baked-art/jardin.png' });
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('malinosland:profile')).data.look,
  );
  await page.locator('button[title="Mon avatar"]').click();
  await page.getByRole('radio', { name: 'Classique personnalisable', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Coiffure', exact: true })
    .getByRole('radio', { name: 'boucles', exact: true })
    .click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForFunction(() => window.__malinosDebug.art().avatar.includes('classic:'));
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('malinosland:profile')).data.look.hair,
    ),
    3,
  );
  for (const model of ['Malino 3D', 'Classique personnalisable']) {
    await page.locator('button[title="Mon avatar"]').click();
    await page.getByRole('radio', { name: model, exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  }
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('malinosland:profile')).data.look,
  );
  assert.equal(after.hair, 3);
  assert.equal(after.skin, before.skin);
  assert.equal(after.accessory, before.accessory);
  await page.reload();
  await page.waitForFunction(() => window.__malinosDebug?.art().avatar.includes('classic:'));

  // Deux onglets, même moteur réseau : le choix de modèle est visible chez l'autre joueur.
  const other = await context.newPage();
  other.on('pageerror', (error) => errors.push(error.message));
  await other.goto(`${site}/jouer/?debug`);
  await other.waitForFunction(() => window.__malinosDebug?.peers() === 1);
  await other.locator('button[title="Mon avatar"]').click();
  await other.getByRole('radio', { name: 'Malino 3D', exact: true }).click();
  await other.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForFunction(() =>
    window.__malinosDebug.art().peers.some((k) => k.includes('malino-v1')),
  );
  await other.waitForFunction(() =>
    window.__malinosDebug.art().peers.some((k) => k.includes('classic:')),
  );
  await other.close();
  assert.equal(
    await page.evaluate(() =>
      window.__malinosDebug.travel('home-0123456789abcdef0123456789abcdef'),
    ),
    true,
  );
  await page.waitForFunction(() => window.__malinosDebug.room().startsWith('home-'));
  await page.evaluate(() => window.__malinosDebug.travel('hub'));
  await page.waitForFunction(() => window.__malinosDebug.room() === 'hub');
  assert.equal(await page.evaluate(() => window.__malinosDebug.art().trees.length), trees.length);
  assert.deepEqual(errors, []);
  console.log(
    `OK : ${trees.length} arbres, nouveau modèle par défaut, choix classique, réglages conservés, rechargement, deux joueurs et changement de salle.`,
  );
} finally {
  await browser.close();
}
