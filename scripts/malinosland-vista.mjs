// Image du Hub de MalinosLand vu de loin, pour le Chantier des mondes (DEC-046) : le vrai jeu
// en 2D isométrique, capturé sans interface, fond rendu transparent, posé sur une île flottante. On la régénère quand le Hub
// change :
//   npm run build && npm run preview      (dans un autre terminal)
//   npm run chantier:vue [url]
// Résultat : src/sandbox/assets/malinosland.webp
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync } from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const out = 'src/sandbox/assets/malinosland.webp';
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 2400, height: 1500 },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  const put = (k, data) => localStorage.setItem(`malinosland:${k}`, JSON.stringify({ v: 1, data }));
  put('profile', { name: 'Malino', look: {} });
  put('settings', {
    quality: 'normal',
    fpsLimit: 0,
    reducedMotion: true,
    showNames: false,
    showStats: false,
    multiTab: false,
  });
  put('progress', []);
  const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
  put('intent', { intent: null, answered: true, shownDay: today });
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('Erreur de la page :', e.message));
await page.goto(`${base}jouer/?debug`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__malinosDebug, null, { timeout: 30000 });
await page.evaluate(() => {
  const d = window.__malinosDebug;
  d.time(13); // en plein jour
  d.teleport(24, 19, 'py'); // au centre de la carte
  d.zoom(0.4);
  document.getElementById('ui').style.display = 'none';
});
await page.waitForTimeout(3500);
const png = await page.screenshot({ type: 'png' });

// Détourage dans le navigateur : le fond uni du jeu devient transparent (bords adoucis), puis
// l'image est recadrée au plus près et enregistrée en WebP.
const data = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  const [br, bg, bb] = [d[0], d[1], d[2]]; // coin en haut à gauche : le fond
  let x0 = c.width,
    y0 = c.height,
    x1 = 0,
    y1 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb);
    const a = Math.max(0, Math.min(255, (dist - 6) * 12));
    d[i + 3] = a;
    if (a > 0) {
      const p = i / 4;
      const x = p % c.width;
      const y = Math.floor(p / c.width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  ctx.putImageData(px, 0, 0);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // 2048 de large au plus : assez net de loin, léger à charger.
  const k = Math.min(1, 2048 / w);
  const W = Math.round(w * k);
  const H = Math.round(h * k);
  const map = document.createElement('canvas');
  map.width = W;
  map.height = H;
  const m = map.getContext('2d');
  m.drawImage(c, x0, y0, w, h, 0, 0, W, H);

  // Coins du sol (gauche, bas, droite) : le dessous de l'île part de ses bords.
  const a = m.getImageData(0, 0, W, H).data;
  const solid = (x, y) => a[(y * W + x) * 4 + 3] > 128;
  let L = null;
  let R = null;
  let B = null;
  for (let x = 0; x < W && !L; x++) for (let y = 0; y < H; y++) if (solid(x, y)) L = { x, y };
  for (let x = W - 1; x >= 0 && !R; x--) for (let y = 0; y < H; y++) if (solid(x, y)) R = { x, y };
  for (let y = H - 1; y >= 0 && !B; y--) for (let x = 0; x < W; x++) if (solid(x, y)) B = { x, y };

  // Île flottante : tranche de terre sous l'herbe, puis rochers en pointe (pixels de 8).
  const D = Math.round(W * 0.03);
  const T = Math.round(W * 0.2);
  const o = document.createElement('canvas');
  o.width = W;
  o.height = H + D + T;
  const g = o.getContext('2d');
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const poly = (pts, color) => {
    g.fillStyle = color;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fill();
  };
  // Rochers : contour irrégulier qui descend jusqu'à une pointe sous le coin du bas.
  const tip = { x: B.x, y: B.y + D + T };
  const rocks = [{ x: L.x + 4, y: L.y + D }];
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    rocks.push({
      x: L.x + (tip.x - L.x) * t + (rnd() - 0.5) * 30,
      y: L.y + D + (tip.y - L.y - D) * Math.pow(t, 0.8) + (rnd() - 0.5) * 24,
    });
  }
  rocks.push(tip);
  for (let i = 11; i >= 1; i--) {
    const t = i / 12;
    rocks.push({
      x: R.x + (tip.x - R.x) * t + (rnd() - 0.5) * 30,
      y: R.y + D + (tip.y - R.y - D) * Math.pow(t, 0.8) + (rnd() - 0.5) * 24,
    });
  }
  rocks.push({ x: R.x - 4, y: R.y + D });
  rocks.push({ x: B.x, y: B.y + D });
  poly(rocks, '#5b6478');
  // Taches de pierre plus claires et plus sombres, en gros pixels.
  g.save();
  g.clip();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.5 ? '#6f7890' : '#474f63';
    const s = 8 * (1 + Math.floor(rnd() * 2));
    g.fillRect(
      Math.floor((rnd() * W) / 8) * 8,
      H - 40 + Math.floor((rnd() * (D + T + 40)) / 8) * 8,
      s,
      s,
    );
  }
  g.restore();
  // Les deux faces de terre sous les bords du sol, herbe en haut.
  const face = (p, q, color) => {
    poly([p, q, { x: q.x, y: q.y + D }, { x: p.x, y: p.y + D }], color);
    poly([p, q, { x: q.x, y: q.y + 6 }, { x: p.x, y: p.y + 6 }], '#4fa35a');
  };
  face(L, B, '#7a4f30');
  face(B, R, '#94603a');
  g.drawImage(map, 0, 0);
  return { url: o.toDataURL('image/webp', 0.86), w: o.width, h: o.height };
}, png.toString('base64'));
writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64'));
console.log(`✓ ${out} (${data.w} × ${data.h})`);
await browser.close();
