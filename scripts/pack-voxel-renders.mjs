// Assemble les rendus Blender avec le Canvas du navigateur déjà utilisé par le projet.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const site = process.argv[2] || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(site).hostname))
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
  await page.goto(`${site}/voxel-preview.html`);
  const atlases = await page.evaluate(async () => {
    const groups = {
      avatar: ['py', 'px', 'ny', 'nx'].flatMap((f) =>
        ['idle', 'walkA', 'walkB', 'sit'].map((p) => `avatar-${f}-${p}`),
      ),
      oak: [0, 1, 2, 3].map((r) => `oak-${r}`),
      sakura: [0, 1, 2, 3].map((r) => `sakura-${r}`),
      'sakura-study': [0, 1, 2, 3].map((r) => `sakura-study-${r}`),
    };
    const output = {};
    for (const [name, frames] of Object.entries(groups)) {
      const cols = name === 'avatar' ? 4 : 2;
      const frameHeight = name === 'sakura-study' ? 480 : 512;
      const canvas = document.createElement('canvas');
      canvas.width = cols * 384;
      canvas.height = (frames.length / cols) * frameHeight;
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        img.src = `/screenshots/blender-frames/${frames[i]}.png`;
        await img.decode();
        ctx.drawImage(img, (i % cols) * 384, Math.floor(i / cols) * frameHeight);
      }
      output[name] = canvas.toDataURL('image/png').split(',')[1];
    }
    return output;
  });
  mkdirSync('src/dev/voxel-assets', { recursive: true });
  for (const [name, data] of Object.entries(atlases))
    writeFileSync(`src/dev/voxel-assets/${name}.png`, Buffer.from(data, 'base64'));
  console.log('Quatre atlas Blender assemblés (28 vues).');
} finally {
  await browser.close();
}
