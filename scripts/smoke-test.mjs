// Test de fumée de bout en bout : crée un personnage, entre dans le monde,
// se déplace et vérifie qu'aucune erreur JavaScript ne survient.
// Usage : npm run build && npm run preview  (dans un autre terminal)
//         npm run test:e2e [url] [dossier-captures]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4173/';
// ?debug active l'accès de test (window.__malinosDebug), sans effet sur le jeu.
const url = base + (base.includes('?') ? '&' : '?') + 'debug';
const outDir = process.argv[3] || 'screenshots';
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const step = (name) => console.log(`• ${name}`);
try {
  step('chargement');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('Entrer dans MalinosLand').waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${outDir}/01-accueil.png` });

  step('création du personnage');
  await page.getByPlaceholder('ex. Léa, Max_IA…').fill('Testeur');
  await page.getByText('Entrer dans MalinosLand').click();
  await page.locator('#game canvas').waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/02-arrivee.png` });

  step('déplacement au clavier');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/03-hall.png` });

  step('chat');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Bonjour les Malinos !');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/04-chat.png` });
  const chatOk = await page.getByText('Bonjour les Malinos !').count();
  if (chatOk === 0) errors.push('le message de chat n’apparaît pas');

  const dbg = (expr) => page.evaluate(expr);
  const waitFor = async (fn, what, timeout = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await page.evaluate(fn)) return;
      await page.waitForTimeout(150);
    }
    throw new Error(`délai dépassé : ${what}`);
  };

  step('parler à Malo (déplacement automatique + dialogue)');
  await dbg(() => window.__malinosDebug.use('malo'));
  await page.locator('.dialog').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${outDir}/05-malo.png` });
  for (let i = 0; i < 10 && (await page.locator('.dialog').count()) > 0; i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(120);
  }
  if ((await page.locator('.dialog').count()) > 0) errors.push('le dialogue ne se ferme pas');

  step('panneau de bienvenue');
  await dbg(() => window.__malinosDebug.use('welcome-board'));
  await page.locator('.modal').waitFor({ timeout: 15000 });
  await page.keyboard.press('Escape');

  step('ascenseur');
  await dbg(() => window.__malinosDebug.use('elevator'));
  await page.getByText('Choisis un étage.').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${outDir}/06-ascenseur.png` });
  await page.keyboard.press('Escape');

  step('café au salon');
  await dbg(() => window.__malinosDebug.use('coffee'));
  await page.getByText('Tu te sers un café').waitFor({ timeout: 15000 });

  step('s’asseoir sur le canapé');
  await dbg(() => {
    const d = window.__malinosDebug;
    return d.walkTo(3.5, 15.5);
  });
  await page.waitForTimeout(1500);
  await page.mouse.move(10, 10);
  await waitFor(() => !document.querySelector('.modal'), 'pas de fenêtre ouverte');
  await dbg(() => window.__malinosDebug.useType('sofa'));
  await waitFor(() => window.__malinosDebug.seated(), 'assis sur le canapé');
  await page.screenshot({ path: `${outDir}/07-salon.png` });

  step('terrasse');
  await dbg(() => window.__malinosDebug.walkTo(29.5, 7.5));
  await waitFor(
    () => {
      const p = window.__malinosDebug.pos();
      return Math.abs(p.x - 29.5) < 0.3 && Math.abs(p.y - 7.5) < 0.3;
    },
    'arrivée sur la terrasse',
    25000,
  );
  await page.screenshot({ path: `${outDir}/08-terrasse.png` });

  step('démo multi-onglets');
  const page2 = await context.newPage();
  page2.on('pageerror', (e) => errors.push(`onglet 2 : ${e.message}`));
  await page2.setViewportSize({ width: 1366, height: 800 });
  await page2.goto(url, { waitUntil: 'networkidle' });
  await page2.locator('#game canvas').waitFor({ timeout: 15000 });
  await waitFor(
    () => window.__malinosDebug && window.__malinosDebug.peers() > 0,
    'le 2e onglet est visible',
  );
  const peers2 = await page2.evaluate(() => window.__malinosDebug.peers());
  if (peers2 < 1) errors.push('le 2e onglet ne voit pas le premier');
  await page2.evaluate(() => window.__malinosDebug.walkTo(28.5, 8.5));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/09-multi-onglets.png` });
  await page2.close();
} catch (err) {
  errors.push(`étape échouée : ${err.message}`);
  await page.screenshot({ path: `${outDir}/erreur.png` }).catch(() => {});
}
await browser.close();

if (errors.length > 0) {
  console.error('❌ Échec du test de fumée :\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`✅ Test de fumée réussi (captures dans ${outDir}/)`);
