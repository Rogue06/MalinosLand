// Test d'intégration du serveur temps réel : lance le vrai Worker en local (Wrangler, sans
// compte Cloudflare) et y connecte plusieurs clients WebSocket. Une fausse base Supabase locale
// répond à la vérification des comptes.
// Usage : cd server && npm run test:integration
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const errors = [];
const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) errors.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fausse base : seul VALID_TOKEN correspond à un profil (comme `my_account` dans Supabase).
const DB_PORT = 8790;
const VALID_TOKEN = 'aaaa.bbbb.cccc';
const ACCOUNT = { id: '0b1c2d3e-0000-4000-8000-000000000001', name: 'Élodie' };
const ACCOUNT_PLAYER = ACCOUNT.id.replaceAll('-', '');
const fakeDb = createServer((req, res) => {
  // Logements : seul le compte de test (son propre jeton) peut entrer ; un visiteur, non.
  if (req.method === 'POST' && req.url === '/rest/v1/rpc/can_enter_home') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(req.headers.authorization === `Bearer ${VALID_TOKEN}`));
  }
  const ok =
    req.method === 'POST' &&
    req.url === '/rest/v1/rpc/my_account' &&
    req.headers.apikey === 'sb_publishable_test_0123456789';
  const auth = req.headers.authorization;
  res.setHeader('Content-Type', 'application/json');
  if (!ok || !auth) return res.writeHead(400).end('{}');
  if (auth !== `Bearer ${VALID_TOKEN}`) return res.writeHead(401).end('{}');
  res.end(JSON.stringify([ACCOUNT]));
}).listen(DB_PORT, '127.0.0.1');

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
    '--var',
    `SUPABASE_URL:http://127.0.0.1:${DB_PORT}`,
    '--var',
    'SUPABASE_KEY:sb_publishable_test_0123456789',
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
  fakeDb.close();
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* déjà arrêté */
  }
};

/** Client WebSocket qui mémorise les messages reçus. */
function client(origin = ORIGIN, protocols = undefined) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, {
      headers: { Origin: origin },
      ...(protocols ? { protocols } : {}),
    });
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
const hello = (c, id, x = 12.5, y = 21.5, name = `Test ${id.slice(0, 2)}`) =>
  c.ws.send(
    JSON.stringify({
      t: 'hello',
      id,
      name,
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

  const noToken = await fetch(`${BASE}/visits`, { headers: { Origin: ORIGIN } });
  check(
    noToken.status === 403,
    'l’historique des connexions est refusé sans le jeton du responsable',
  );

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
    of(d, 'queue').some((m) => m.pos === 1) && !d.closed,
    'le 4e joueur attend son tour dans la file (limite 3)',
  );

  b.ws.close();
  await sleep(600);
  check(
    of(a, 'bye').some((m) => m.id === 'bbbbbbbb22'),
    'A est prévenu du départ de B',
  );
  check(
    of(d, 'queue').some((m) => m.pos === 0) && of(a, 'hello').some((m) => m.id === 'dddddddd44'),
    'une place se libère : le joueur en attente entre tout seul',
  );

  // Comptes : jeton vérifié par la base → pseudo du compte et marque « vérifié ».
  c.ws.close();
  await sleep(400);
  const e = await client(ORIGIN, ['malinos.v1', `jwt.${VALID_TOKEN}`]);
  check(e.ws.protocol === 'malinos.v1', 'le serveur accepte le sous-protocole du jeu');
  hello(e, ACCOUNT_PLAYER, 12.5, 21.5, 'Usurpateur');
  await sleep(600);
  const seen = of(a, 'hello').find((m) => m.id === ACCOUNT_PLAYER);
  check(
    seen?.name === 'Élodie' && seen?.v === true,
    'un joueur connecté garde le pseudo de son compte, avec la marque « vérifié »',
  );
  const HOME = `home-${ACCOUNT_PLAYER}`;
  e.ws.send(JSON.stringify({ t: 'enter', id: ACCOUNT_PLAYER, room: HOME }));
  a.ws.send(JSON.stringify({ t: 'enter', id: 'aaaaaaaa11', room: HOME }));
  await sleep(800);
  check(
    of(e, 'door').some((m) => m.ok && m.room === HOME) &&
      of(a, 'door').some((m) => !m.ok && m.why === 'closed'),
    'logement : le propriétaire entre chez lui, un visiteur refusé par la base reste dehors',
  );
  e.ws.close(); // libère une place (limite 3) pour le visiteur suivant
  await sleep(400);
  const g = await client(ORIGIN, ['malinos.v1', 'jwt.faux.jeton.x']);
  hello(g, 'gggggggg77');
  await sleep(600);
  const guest = of(a, 'hello').find((m) => m.id === 'gggggggg77');
  check(!!guest && guest.v === undefined, 'un jeton refusé par la base = simple visiteur');

  for (const x of [a, d, g, evil]) x.ws.close();
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
