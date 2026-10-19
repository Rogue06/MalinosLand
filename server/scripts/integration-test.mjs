// Test d'intégration du serveur temps réel : lance le vrai Worker en local (Wrangler, sans
// compte Cloudflare) et y connecte plusieurs clients WebSocket.
// Usage : cd server && npm run test:integration
import { spawn } from 'node:child_process';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const errors = [];
const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) errors.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '--port',
    String(PORT),
    '--ip',
    '127.0.0.1',
    '--var',
    `ALLOWED_ORIGINS:${ORIGIN}`,
    '--var',
    'MAX_PLAYERS_PER_ROOM:3',
  ],
  {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    detached: true,
  },
);
let logs = '';
server.stdout.on('data', (d) => (logs += d));
server.stderr.on('data', (d) => (logs += d));
const stop = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* déjà arrêté */
  }
};

/** Client WebSocket qui mémorise les messages reçus. */
function client(origin = ORIGIN) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { Origin: origin } });
    const c = { ws, inbox: [], closed: null, error: false };
    ws.onmessage = (e) => {
      try {
        c.inbox.push(JSON.parse(e.data));
      } catch {
        c.inbox.push(e.data);
      }
    };
    ws.onclose = (e) => (c.closed = e.code);
    ws.onerror = () => (c.error = true);
    ws.onopen = () => resolve(c);
    setTimeout(() => resolve(c), 5000);
  });
}
const hello = (c, id, x = 12.5, y = 21.5) =>
  c.ws.send(
    JSON.stringify({
      t: 'hello',
      id,
      name: `Test ${id.slice(0, 2)}`,
      look: {},
      reply: false,
      room: 'hub',
      x,
      y,
      f: 'py',
      s: 0,
    }),
  );
const of = (c, t) => c.inbox.filter((m) => m && m.t === t);

try {
  // Attente du démarrage du serveur local.
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await sleep(1000);
    up = await fetch(`${BASE}/health`)
      .then((r) => r.ok)
      .catch(() => false);
  }
  check(up, 'le serveur local démarre et répond sur /health');
  if (!up) throw new Error('serveur indisponible');

  const evil = await client('https://site-pirate.example');
  check(
    evil.error || evil.ws.readyState !== WebSocket.OPEN,
    'une origine non autorisée est refusée',
  );

  const a = await client();
  const b = await client();
  hello(a, 'aaaaaaaa11');
  await sleep(300);
  hello(b, 'bbbbbbbb22');
  await sleep(500);
  check(
    of(a, 'hello').some((m) => m.id === 'bbbbbbbb22'),
    'A voit arriver B',
  );
  check(
    of(b, 'hello').some((m) => m.id === 'aaaaaaaa11'),
    'B reçoit la présence de A',
  );

  a.ws.send(
    JSON.stringify({ t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 12.9, y: 21.5, f: 'px', s: 1 }),
  );
  await sleep(400);
  check(
    of(b, 'state').some((m) => m.id === 'aaaaaaaa11' && m.x === 12.9),
    'B reçoit le déplacement de A',
  );

  a.ws.send(
    JSON.stringify({ t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 30, y: 3, f: 'px', s: 1 }),
  );
  a.ws.send(
    JSON.stringify({ t: 'state', id: 'bbbbbbbb22', room: 'hub', x: 12, y: 21, f: 'px', s: 1 }),
  );
  await sleep(400);
  check(of(b, 'state').length === 1, 'téléportation et usurpation d’identité ignorées');

  a.ws.send(
    JSON.stringify({
      t: 'chat',
      id: 'aaaaaaaa11',
      room: 'hub',
      scope: 'global',
      text: 'Bonjour <b>Malinos</b>',
    }),
  );
  await sleep(400);
  check(
    of(b, 'chat').some((m) => m.text === 'Bonjour <b>Malinos</b>'),
    'le chat arrive (texte brut, jamais interprété)',
  );

  a.ws.send('ping');
  await sleep(300);
  check(
    a.inbox.includes('pong'),
    'le « ping » de maintien reçoit « pong » (réponse automatique gratuite)',
  );

  const c = await client();
  hello(c, 'cccccccc33');
  const d = await client();
  hello(d, 'dddddddd44');
  await sleep(600);
  check(
    of(d, 'notice').some((m) => m.code === 'full') && d.closed === 4001,
    'le 4e joueur est refusé : salle pleine (limite 3)',
  );

  b.ws.close();
  await sleep(600);
  check(
    of(a, 'bye').some((m) => m.id === 'bbbbbbbb22'),
    'A est prévenu du départ de B',
  );

  for (const x of [a, c, d, evil]) x.ws.close();
} catch (err) {
  errors.push(err.message);
  console.error(logs.slice(-3000));
} finally {
  stop();
}

if (errors.length) {
  console.error(`❌ ${errors.length} vérification(s) en échec`);
  process.exit(1);
}
console.log('✅ Serveur temps réel : tous les tests d’intégration passent');
process.exit(0);
