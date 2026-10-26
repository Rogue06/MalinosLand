// Régénère les captures d'écran de la documentation (docs/images/).
// Usage : npm run build && npm run preview   (dans un autre terminal)
//         npm run docs:screenshots [url]
// Les images sont en JPEG (légères) ; relis-les avant de les commiter.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const out = 'docs/images';
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
if (!existsSync(out)) mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const viewport = { width: 1280, height: 760 };
const look = { body: 0, skin: 1, hair: 6, hairColor: 7, top: 2, bottom: 3, accessory: 2 };

/** Ouvre le jeu avec un profil de démonstration déjà créé. */
async function openGame(progress = []) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ look, progress }) => {
      const put = (k, data) =>
        localStorage.setItem(`malinosland:${k}`, JSON.stringify({ v: 1, data }));
      put('profile', { name: 'Malino', look });
      put('settings', {
        quality: 'normal',
        fpsLimit: 0,
        reducedMotion: false,
        showNames: true,
        showStats: false,
        multiTab: false,
      });
      put('progress', progress);
      // Carte d'arrivée déjà vue aujourd'hui : elle ne cache pas les captures.
      const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
      put('intent', { intent: null, answered: true, shownDay: today });
    },
    { look, progress },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('Erreur de la page :', e.message));
  await page.goto(`${base}jouer/?debug`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__malinosDebug, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page;
}

const shot = async (page, name) => {
  // Laisse finir les animations d'apparition (fenêtres, bulles).
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 });
  console.log(`✓ ${out}/${name}.jpg`);
};
const teleport = async (page, x, y, f = 'py') => {
  await page.evaluate(([x, y, f]) => window.__malinosDebug.teleport(x, y, f), [x, y, f]);
  await page.waitForTimeout(1800);
};
const closeHud = (page) => page.evaluate(() => document.querySelector('.objectives')?.remove());

// 0. Image d'aperçu pour les partages (1200 × 630), si la page d'accueil privée est installée
{
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  // Seulement si la page d'accueil (dépôt privé) est installée : son image de partage y est rangée.
  if ((await page.locator('.patch-title').count()) > 0) {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: 'public/accueil/partage.jpg', type: 'jpeg', quality: 80 });
    console.log('✓ public/accueil/partage.jpg (à copier dans le dépôt privé)');
  }
  await context.close();
}

// 1. Écran d'accueil (création du personnage)
{
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${base}jouer/`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('ex. Léa, Max_IA…').fill('Malino');
  await page.getByText('Styles prêts à porter').waitFor();
  await page.locator('.preset').nth(4).click();
  await shot(page, 'accueil-creation-personnage');
  await context.close();
}

// 2. Vue d'ensemble du Hub (sans interface), pour le README
{
  const page = await openGame();
  await teleport(page, 13.5, 13.5, 'py');
  await page.evaluate(() => {
    window.__malinosDebug.zoom(0.62);
    document.getElementById('ui').style.display = 'none';
  });
  await page.waitForTimeout(1500);
  await shot(page, 'hub-vue-ensemble');
  await page.context().close();
}

// 3. Arrivée devant le Hub, objectifs visibles
{
  const page = await openGame(['chat']);
  await teleport(page, 12.9, 22.6, 'ny');
  await shot(page, 'hub-arrivee');

  // 4. Dialogue avec Joshua
  await teleport(page, 11.5, 16.6, 'ny');
  await page.evaluate(() => window.__malinosDebug.use('joshua'));
  await page.locator('.dialog').waitFor();
  await shot(page, 'hall-dialogue-joshua');
  await page.keyboard.press('Escape');

  // 5. Coworking
  await closeHud(page);
  await teleport(page, 5.5, 4.5, 'ny');
  await shot(page, 'coworking');

  // 6. Salle de conférence et Musée des Malinos
  await teleport(page, 18.5, 3.5, 'py');
  await shot(page, 'conference-et-galerie');

  // 7. Salon : assis sur le canapé, émote café
  await teleport(page, 2.5, 12.5, 'py');
  await page.evaluate(() => window.__malinosDebug.useType('sofa'));
  await page.waitForFunction(() => window.__malinosDebug.seated(), null, { timeout: 30000 });
  await page.locator('.emotes button[title="Émote ☕"]').click();
  await page.waitForTimeout(1200);
  await shot(page, 'salon-assis-cafe');

  // 8. Terrasse et jardin
  await teleport(page, 29.5, 7.5, 'py');
  await shot(page, 'terrasse');

  // 9. Panneaux : avatar (miroir), feuille de route, ascenseur
  await page.evaluate(() => document.querySelector('[title="Mon avatar"]')?.click());
  await page.locator('.avatar-editor').waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'panneau-avatar');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('[title="Feuille de route"]')?.click());
  await page.locator('.roadmap').waitFor();
  await shot(page, 'panneau-feuille-de-route');
  await page.keyboard.press('Escape');
  await teleport(page, 12.5, 10.6, 'ny');
  await page.evaluate(() => window.__malinosDebug.use('elevator'));
  await page.getByText('Mon logement').first().waitFor();
  await shot(page, 'panneau-ascenseur');
  await page.keyboard.press('Escape');
  // 10. Le Parc des Malinos (étang, kiosque).
  await teleport(page, 39.0, 20.0, 'py');
  await page.evaluate(() => window.__malinosDebug.zoom(0.8));
  await page.waitForTimeout(1500);
  await shot(page, 'parc');
  await teleport(page, 40.5, 8.0, 'ny');
  await page.evaluate(() => window.__malinosDebug.zoom(1.5));
  await page.waitForTimeout(1500);
  await shot(page, 'salle-de-jeux');
  // 11. Un studio de la Tour (gabarit commun à tous les logements).
  await page.evaluate(() => window.__malinosDebug.travel(`home-${'a'.repeat(32)}`));
  await page.waitForFunction(() => window.__malinosDebug?.room?.().startsWith('home-'));
  await page.waitForTimeout(1500);
  await shot(page, 'studio');
  await page.context().close();
}

await browser.close();
console.log('Captures terminées.');
