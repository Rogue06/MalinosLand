import { describe, expect, it } from 'vitest';
import {
  checkEmbed,
  demoCsp,
  demoHtml,
  demoPage,
  demoTargetProblem,
  embedCheck,
  readFraming,
  sourceAllows,
  type Fetcher,
} from '../server/src/embed';

const GAME = 'https://malinosland.pages.dev';
const WORKER = 'https://rt.example.workers.dev';
const ANCESTORS = [WORKER, GAME];
const env = {
  ALLOWED_ORIGINS: GAME,
  SUPABASE_URL: 'https://db.example.co',
  SUPABASE_KEY: 'sb_publishable_test_0123456789',
};
const TOKEN = 'aaaa.bbbb.cccc';

/** Faux site : chaque adresse a sa réponse (statut et en-têtes) ; les appels sont notés. */
function fakeSites(routes: Record<string, { status?: number; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const r = routes[url];
    if (!r) throw new Error('injoignable');
    return new Response('<html>contenu jamais lu</html>', {
      status: r.status ?? 200,
      headers: r.headers ?? {},
    });
  };
  return { fetcher, calls };
}

describe('démo du musée : adresses vérifiées et encadrées', () => {
  it('https, nom de domaine, port 443 uniquement', () => {
    expect(demoTargetProblem('https://mon-projet.github.io/app')).toBeNull();
    expect(demoTargetProblem('https://mon-projet.fr:443/')).toBeNull();
    const bad: Array<[string, RegExp]> = [
      ['http://mon-projet.fr', /https/],
      ['https://mon-projet.fr:8443', /port/],
      ['https://moi:secret@mon-projet.fr', /identifiants/],
      ['https://localhost', /nom de domaine|locale/],
      ['https://serveur.internal', /locale/],
      ['https://malinosland.pages.dev', /MalinosLand/],
      ['https://abc.supabase.co', /MalinosLand/],
      ['pas une adresse', /invalide/],
    ];
    for (const [url, why] of bad) expect(demoTargetProblem(url), url).toMatch(why);
    expect(
      demoTargetProblem('https://rt.example.workers.dev/demo/1', ['rt.example.workers.dev']),
    ).toMatch(/MalinosLand/);
  });

  it('IP refusées sous toutes leurs formes (décimal, hexadécimal, octal, IPv6)', () => {
    for (const ip of [
      'https://127.0.0.1',
      'https://2130706433',
      'https://0x7f000001',
      'https://0177.0.0.1',
      'https://127.1',
      'https://[::1]',
      'https://[::ffff:7f00:1]',
      'https://169.254.169.254/latest',
    ])
      expect(demoTargetProblem(ip), ip).toMatch(/IP/);
  });
});

describe('démo du musée : lecture des en-têtes', () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it('X-Frame-Options : DENY et SAMEORIGIN refusent', () => {
    expect(readFraming(h({ 'X-Frame-Options': 'DENY' }), ANCESTORS).ok).toBe(false);
    expect(readFraming(h({ 'X-Frame-Options': 'sameorigin' }), ANCESTORS).ok).toBe(false);
    expect(readFraming(h({}), ANCESTORS)).toEqual({
      ok: true,
      reason: 'aucun en-tête n’interdit le cadre',
    });
  });

  it('frame-ancestors : absent, *, https: ou nos origines → possible ; sinon refus', () => {
    const csp = (v: string) => readFraming(h({ 'Content-Security-Policy': v }), ANCESTORS).ok;
    expect(csp("default-src 'self'")).toBe(true);
    expect(csp('frame-ancestors *')).toBe(true);
    expect(csp("default-src 'self'; frame-ancestors https:")).toBe(true);
    expect(csp(`frame-ancestors ${GAME} ${WORKER}`)).toBe(true);
    expect(csp('frame-ancestors https://*.pages.dev https://*.workers.dev')).toBe(true);
    expect(csp("frame-ancestors 'none'")).toBe(false);
    expect(csp("frame-ancestors 'self'")).toBe(false);
    // Le jeu seul ne suffit pas : la visionneuse est aussi un cadre parent.
    expect(csp(`frame-ancestors ${GAME}`)).toBe(false);
    // Deux politiques : chacune doit accepter.
    expect(csp("frame-ancestors *, frame-ancestors 'self'")).toBe(false);
  });

  it('correspondance des sources', () => {
    expect(sourceAllows('*.pages.dev', GAME)).toBe(true);
    expect(sourceAllows('*.pages.dev', 'https://pages.dev')).toBe(false);
    expect(sourceAllows('http://malinosland.pages.dev', GAME)).toBe(true);
    expect(sourceAllows('https://malinosland.pages.dev:8443', GAME)).toBe(false);
    expect(sourceAllows("'unsafe-inline'", GAME)).toBe(false);
  });
});

describe('démo du musée : vérification technique', () => {
  const opts = (fetcher: Fetcher) => ({ ancestors: ANCESTORS, ownHosts: [], fetcher });

  it('en-têtes seulement, redirections suivies à la main et revérifiées', async () => {
    const site = fakeSites({
      'https://projet.fr/': { status: 301, headers: { Location: '/fr/' } },
      'https://projet.fr/fr/': { headers: { 'Content-Security-Policy': 'frame-ancestors *' } },
    });
    expect(await checkEmbed('https://projet.fr/', opts(site.fetcher))).toEqual({
      verdict: 'accepte',
      reason: 'aucun en-tête n’interdit le cadre',
    });
    expect(site.calls.map((c) => c.url)).toEqual(['https://projet.fr/', 'https://projet.fr/fr/']);
    expect(site.calls.every((c) => c.init?.redirect === 'manual')).toBe(true);
  });

  it('refus : redirection vers http, une IP, une autre origine, ou plus de 3', async () => {
    const http = fakeSites({
      'https://a.fr/': { status: 302, headers: { Location: 'http://a.fr/' } },
    });
    expect((await checkEmbed('https://a.fr/', opts(http.fetcher))).reason).toMatch(/https/);
    const ip = fakeSites({
      'https://a.fr/': { status: 307, headers: { Location: 'https://10.0.0.1/admin' } },
    });
    const r = await checkEmbed('https://a.fr/', opts(ip.fetcher));
    expect(r.verdict).toBe('refuse');
    expect(ip.calls).toHaveLength(1);
    const other = fakeSites({
      'https://a.fr/': { status: 301, headers: { Location: 'https://www.a.fr/' } },
    });
    expect((await checkEmbed('https://a.fr/', opts(other.fetcher))).reason).toMatch(/www\.a\.fr/);
    const loop = fakeSites({
      'https://a.fr/1': { status: 302, headers: { Location: '/2' } },
      'https://a.fr/2': { status: 302, headers: { Location: '/3' } },
      'https://a.fr/3': { status: 302, headers: { Location: '/4' } },
      'https://a.fr/4': { status: 302, headers: { Location: '/5' } },
    });
    expect((await checkEmbed('https://a.fr/1', opts(loop.fetcher))).reason).toMatch(/3 au plus/);
    expect(loop.calls).toHaveLength(4);
  });

  it('injoignable : erreur du site ou pas de réponse', async () => {
    const err = fakeSites({ 'https://a.fr/': { status: 503 } });
    expect(await checkEmbed('https://a.fr/', opts(err.fetcher))).toMatchObject({
      verdict: 'injoignable',
    });
    const none = fakeSites({});
    expect((await checkEmbed('https://a.fr/', opts(none.fetcher))).verdict).toBe('injoignable');
  });
});

describe('démo du musée : route /embed-check', () => {
  const post = (auth?: string, body = '{"id":7}') =>
    new Request(`${WORKER}/embed-check`, {
      method: 'POST',
      headers: { Origin: GAME, ...(auth ? { Authorization: auth } : {}) },
      body,
    });

  it('refusée sans jeton, ou si la base dit non (pas modérateur, plafond atteint)', async () => {
    const calls: string[] = [];
    const db: Fetcher = async (url) => {
      calls.push(url);
      return Response.json(false);
    };
    expect((await embedCheck(post(), env, db)).status).toBe(403);
    expect(calls).toEqual([]);
    const res = await embedCheck(post(`Bearer ${TOKEN}`), env, db);
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(GAME);
    // Le site n'est jamais contacté.
    expect(calls).toEqual([`${env.SUPABASE_URL}/rest/v1/rpc/embed_check_quota`]);
  });

  it('un modérateur : l’adresse vient de la base, le résultat est renvoyé', async () => {
    const fetcher: Fetcher = async (url, init) => {
      const auth = new Headers(init?.headers).get('Authorization');
      if (url.endsWith('/rpc/embed_check_quota')) return Response.json(auth === `Bearer ${TOKEN}`);
      if (url.includes('/rest/v1/projects?id=eq.7'))
        return Response.json([{ url: 'https://a.fr/' }]);
      if (url === 'https://a.fr/')
        return new Response('', { headers: { 'X-Frame-Options': 'DENY' } });
      throw new Error(url);
    };
    const res = await embedCheck(post(`Bearer ${TOKEN}`), env, fetcher);
    expect(await res.json()).toMatchObject({
      verdict: 'refuse',
      reason: expect.stringMatching(/DENY/),
    });
    expect((await embedCheck(post(`Bearer ${TOKEN}`, '{"id":"x"}'), env, fetcher)).status).toBe(
      400,
    );
  });
});

describe('démo du musée : visionneuse /demo/:id', () => {
  const get = (path: string, dest = 'iframe') =>
    new Request(`${WORKER}${path}`, { headers: dest ? { 'Sec-Fetch-Dest': dest } : {} });
  const db =
    (answer: unknown): Fetcher =>
    async (url, init) => {
      expect(url).toBe(`${env.SUPABASE_URL}/rest/v1/rpc/museum_demo`);
      seen.push(JSON.parse(String(init?.body)));
      return Response.json(answer);
    };
  let seen: unknown[] = [];

  it('CSP limitée à l’origine du projet, affichable seulement dans le jeu', async () => {
    seen = [];
    const res = await demoPage(get('/demo/12'), env, db('https://projet.fr/app?x=1'));
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('frame-src https://projet.fr;');
    expect(csp).toContain(`frame-ancestors ${GAME};`);
    expect(csp).not.toMatch(/script-src|https:;|\*/);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const html = await res.text();
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms" allow=""');
    expect(html).toContain('referrerpolicy="no-referrer" credentialless');
    expect(html).not.toMatch(/<script|allow-top-navigation|allow-popups/);
    expect(seen).toEqual([{ p_id: 12, p_trial: false }]);
    // Le style de la page est autorisé par son empreinte, rien d'autre.
    expect(csp).toMatch(/style-src 'sha256-[A-Za-z0-9+/=]+'/);
  });

  it('refusée hors d’un cadre, et 404 si la démo n’est pas intégrable', async () => {
    expect((await demoPage(get('/demo/12', 'document'), env, db('https://projet.fr'))).status).toBe(
      403,
    );
    expect((await demoPage(get('/demo/12', ''), env, db('https://projet.fr'))).status).toBe(403);
    expect((await demoPage(get('/demo/12'), env, db(null))).status).toBe(404);
    expect((await demoPage(get('/demo/abc'), env, db(null))).status).toBe(404);
    // Une adresse invalide venue de la base n'est jamais encadrée.
    expect((await demoPage(get('/demo/12'), env, db('https://127.0.0.1'))).status).toBe(404);
    seen = [];
    await demoPage(get('/demo/12?essai'), env, db('https://projet.fr'));
    expect(seen).toEqual([{ p_id: 12, p_trial: true }]);
  });

  it('adresse échappée dans la page', () => {
    expect(demoHtml('https://projet.fr/?a="><script>')).not.toContain('"><script>');
  });

  it('CSP : aucune origine du jeu connue → personne ne peut l’encadrer', async () => {
    expect(await demoCsp('https://projet.fr', [])).toContain("frame-ancestors 'none'");
  });
});
