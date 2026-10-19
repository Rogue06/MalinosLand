// Capture d'écran d'une page servie localement (outil de développement).
// Usage : node scripts/screenshot.mjs <url> <fichier.png> [largeur] [hauteur]
// Variables : FULL=1 (page entière), WAIT=ms, CHROMIUM_PATH=chemin du navigateur.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const [url, out, width = '1400', height = '900'] = process.argv.slice(2);
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(process.env.WAIT || 800));
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
await browser.close();
