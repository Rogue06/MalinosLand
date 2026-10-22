import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Règles d'accès de la base (RLS) testées sans compte ni Docker : PGlite fait tourner un vrai
 * PostgreSQL en WebAssembly. On recrée le minimum de Supabase (rôles anon/authenticated,
 * schéma auth, auth.uid()) puis on applique les migrations du dossier supabase/migrations.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  -- Comme Supabase : droits larges par défaut, la RLS fait le tri.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const LOOK = JSON.stringify({ body: 1, hair: 2 });

let db: PGlite;

/** Exécute une requête avec l'identité d'un joueur (null : visiteur anonyme). */
async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const migrations = import.meta.glob<string>('../supabase/migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  for (const file of Object.keys(migrations).sort()) await db.exec(migrations[file]!);
  await db.exec(`insert into auth.users (id) values ('${ALICE}'), ('${BOB}')`);
});

describe('base de données : profils', () => {
  it('un joueur crée son propre profil, pas celui d’un autre', async () => {
    await as(ALICE, `insert into public.profiles (id, name, look) values ($1, 'Alice', $2)`, [
      ALICE,
      LOOK,
    ]);
    await expect(
      as(ALICE, `insert into public.profiles (id, name, look) values ($1, 'Faux Bob', $2)`, [
        BOB,
        LOOK,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it('un visiteur ne peut rien écrire', async () => {
    await expect(
      as(null, `insert into public.profiles (id, name, look) values ($1, 'Intrus', $2)`, [
        BOB,
        LOOK,
      ]),
    ).rejects.toThrow();
  });

  it('les profils sont lisibles par tous', async () => {
    const res = await as<{ name: string }>(null, 'select name from public.profiles');
    expect(res.rows.map((r) => r.name)).toEqual(['Alice']);
  });

  it('on ne modifie que son propre profil', async () => {
    await as(BOB, `insert into public.profiles (id, name, look) values ($1, 'Bob', $2)`, [
      BOB,
      LOOK,
    ]);
    const res = await as(BOB, `update public.profiles set name = 'Pirate' where id = $1`, [ALICE]);
    expect(res.affectedRows).toBe(0);
    await as(ALICE, `update public.profiles set name = 'Alice2' where id = $1`, [ALICE]);
    const names = await as<{ name: string }>(
      null,
      'select name from public.profiles order by name',
    );
    expect(names.rows.map((r) => r.name)).toEqual(['Alice2', 'Bob']);
  });

  it('id et dates ne sont pas modifiables par le joueur', async () => {
    await expect(
      as(ALICE, `update public.profiles set created_at = now() - interval '1 year' where id = $1`, [
        ALICE,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it('pseudo unique (sans tenir compte des majuscules) et bien formé', async () => {
    await expect(
      as(BOB, `update public.profiles set name = 'ALICE2' where id = $1`, [BOB]),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      as(BOB, `update public.profiles set name = ' espace' where id = $1`, [BOB]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(BOB, `update public.profiles set name = 'x' where id = $1`, [BOB]),
    ).rejects.toThrow(/check constraint/);
  });

  it('apparence limitée en taille', async () => {
    const huge = JSON.stringify({ junk: 'x'.repeat(5000) });
    await expect(
      as(BOB, `update public.profiles set look = $2 where id = $1`, [BOB, huge]),
    ).rejects.toThrow(/check constraint/);
  });

  it('pas de suppression directe, mais suppression de son compte en cascade', async () => {
    const del = await as(BOB, `delete from public.profiles where id = $1`, [BOB]);
    expect(del.affectedRows).toBe(0);
    await expect(as(null, 'select public.delete_my_account()')).rejects.toThrow();
    await as(BOB, 'select public.delete_my_account()');
    const names = await as<{ name: string }>(null, 'select name from public.profiles');
    expect(names.rows.map((r) => r.name)).toEqual(['Alice2']);
    const users = await db.query('select id from auth.users');
    expect(users.rows).toHaveLength(1);
  });
});

describe('base de données : my_profile (serveur temps réel)', () => {
  it('renvoie le profil du joueur connecté, rien pour un visiteur', async () => {
    const me = await as<{ id: string; name: string }>(ALICE, 'select * from public.my_profile()');
    expect(me.rows).toEqual([{ id: ALICE, name: 'Alice2' }]);
    const acc = await as(ALICE, 'select * from public.my_account()');
    expect(acc.rows).toEqual([{ id: ALICE, name: 'Alice2', role: null }]);
    const guest = await as(null, 'select * from public.my_profile()');
    expect(guest.rows).toEqual([]);
  });
});

describe('base de données : signalements et modération', () => {
  const MODO = '00000000-0000-4000-8000-0000000000c1';
  const DORA = '00000000-0000-4000-8000-0000000000d1';
  const report = (who: string, extra = '') =>
    as(
      who,
      `insert into public.reports (reported_player, reported_account, reported_name, reason, details, messages${extra ? ', status' : ''})
       values ($1, $2, 'Alice2', 'spam', 'pub en boucle', '["achetez !"]'${extra ? `, '${extra}'` : ''})`,
      [ALICE.replace(/-/g, ''), ALICE],
    );

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${MODO}'), ('${DORA}')`);
    await db.exec(`insert into public.moderators (user_id) values ('${MODO}')`);
  });

  it('un joueur connecté peut signaler, un visiteur non', async () => {
    await report(DORA);
    await expect(
      as(
        null,
        `insert into public.reports (reported_player, reported_name, reason) values ('aaaaaaaa11', 'X', 'spam')`,
      ),
    ).rejects.toThrow();
  });

  it('impossible de signaler au nom d’un autre ou de créer un signalement déjà « traité »', async () => {
    await expect(
      as(
        DORA,
        `insert into public.reports (reporter_id, reported_player, reported_name, reason) values ($1, 'aaaaaaaa11', 'X', 'spam')`,
        [MODO],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(report(DORA, 'traite')).rejects.toThrow(/permission denied/);
  });

  it('seuls les modérateurs lisent et traitent les signalements', async () => {
    const seenByDora = await as(DORA, 'select id from public.reports');
    expect(seenByDora.rows).toHaveLength(0);
    const seenByModo = await as<{ id: number; reason: string }>(
      MODO,
      'select id, reason from public.reports',
    );
    expect(seenByModo.rows).toHaveLength(1);
    const id = seenByModo.rows[0]!.id;
    const byDora = await as(DORA, `update public.reports set status = 'traite' where id = $1`, [
      id,
    ]);
    expect(byDora.affectedRows).toBe(0);
    await as(MODO, `update public.reports set status = 'traite' where id = $1`, [id]);
    await expect(
      as(MODO, `update public.reports set reason = 'autre' where id = $1`, [id]),
    ).rejects.toThrow(/permission denied/);
    const after = await as<{ status: string }>(MODO, 'select status from public.reports');
    expect(after.rows[0]!.status).toBe('traite');
  });

  it('is_moderator et la liste des modérateurs ne sont pas accessibles aux joueurs', async () => {
    const me = await as<{ m: boolean }>(MODO, 'select public.is_moderator() as m');
    expect(me.rows[0]!.m).toBe(true);
    const dora = await as<{ m: boolean }>(DORA, 'select public.is_moderator() as m');
    expect(dora.rows[0]!.m).toBe(false);
    await expect(as(DORA, 'select * from public.moderators')).rejects.toThrow(/permission denied/);
    await expect(
      as(DORA, `insert into public.moderators (user_id) values ($1)`, [DORA]),
    ).rejects.toThrow(/permission denied/);
  });

  it('pas plus de 10 signalements par jour et par joueur', async () => {
    for (let i = 0; i < 9; i++) await report(DORA);
    await expect(report(DORA)).rejects.toThrow(/Trop de signalements/);
  });

  it('messages joints limités en taille', async () => {
    const big = JSON.stringify(Array.from({ length: 50 }, () => 'x'.repeat(200)));
    await expect(
      as(
        MODO,
        `insert into public.reports (reported_player, reported_name, reason, messages) values ('aaaaaaaa11', 'X', 'spam', $1)`,
        [big],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('base de données : boîte à idées et bugs', () => {
  const MODO = '00000000-0000-4000-8000-0000000000c1';
  const EVE = '00000000-0000-4000-8000-0000000000e1';
  const INSERT = `insert into public.feedback (kind, message, author_name, context) values ($1, $2, 'Eve', '{"zone":"hall"}')`;
  const send = (who: string, kind = 'idee', message = 'Ajouter une piscine !') =>
    as(who, INSERT, [kind, message]);
  /** Visiteur : écrit par la fonction Edge (après Turnstile), avec la clé serveur. */
  const sendAsServer = async (kind = 'idee', message = 'Ajouter une piscine !') => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    return db.query(INSERT, [kind, message]);
  };

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${EVE}') on conflict do nothing`);
  });

  it('un joueur connecté envoie directement ; un visiteur passe par le serveur', async () => {
    await expect(as(null, INSERT, ['bug', 'Le banc du jardin flotte'])).rejects.toThrow(
      /permission denied/,
    );
    await sendAsServer('bug', 'Le banc du jardin flotte');
    await send(EVE);
    const rows = await db.query<{ author_id: string | null }>(
      'select author_id from public.feedback order by id',
    );
    expect(rows.rows.map((r) => r.author_id)).toEqual([null, EVE]);
  });

  it('impossible de se faire passer pour un autre ou de choisir le statut', async () => {
    await expect(
      as(
        EVE,
        `insert into public.feedback (kind, message, author_id) values ('idee', 'Bonjour !', $1)`,
        [MODO],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(
        EVE,
        `insert into public.feedback (kind, message, status) values ('idee', 'Bonjour !', 'traite')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('message de 5 à 1000 caractères, type connu', async () => {
    await expect(send(EVE, 'idee', 'ok')).rejects.toThrow(/check constraint/);
    await expect(send(EVE, 'idee', 'x'.repeat(1001))).rejects.toThrow(/check constraint/);
    await expect(send(EVE, 'pub', 'Achetez mon produit')).rejects.toThrow(/check constraint/);
  });

  it('seuls les modérateurs lisent et traitent', async () => {
    expect((await as(EVE, 'select id from public.feedback')).rows).toHaveLength(0);
    expect(
      (await as(null, 'select id from public.feedback').catch(() => ({ rows: [] }))).rows,
    ).toHaveLength(0);
    const rows = await as<{ id: number }>(MODO, 'select id from public.feedback order by id');
    expect(rows.rows.length).toBeGreaterThanOrEqual(2);
    await as(MODO, `update public.feedback set status = 'traite' where id = $1`, [
      rows.rows[0]!.id,
    ]);
    const byEve = await as(EVE, `update public.feedback set status = 'nouveau' where id = $1`, [
      rows.rows[0]!.id,
    ]);
    expect(byEve.affectedRows).toBe(0);
  });

  it('limites : 10 par jour pour un joueur connecté, 30 par heure pour les visiteurs', async () => {
    for (let i = 0; i < 9; i++) await send(EVE);
    await expect(send(EVE)).rejects.toThrow(/Trop de messages aujourd/);
    for (let i = 0; i < 29; i++) await sendAsServer();
    await expect(sendAsServer()).rejects.toThrow(/Trop de messages pour le moment/);
  });
});

describe('base de données : logements (v0.3)', () => {
  const OWNER = '00000000-0000-4000-8000-0000000000f1';
  const GUEST = '00000000-0000-4000-8000-0000000000f2';
  const OTHER = '00000000-0000-4000-8000-0000000000f3';
  const canEnter = async (who: string | null, owner = OWNER) =>
    (await as<{ ok: boolean }>(who, 'select public.can_enter_home($1) as ok', [owner])).rows[0]!.ok;
  const visitable = async (who: string | null) =>
    (await as<{ owner_id: string; name: string }>(who, 'select * from public.visitable_homes()'))
      .rows;

  beforeAll(async () => {
    await db.exec(
      `insert into auth.users (id) values ('${OWNER}'), ('${GUEST}'), ('${OTHER}') on conflict do nothing`,
    );
    await as(OWNER, `insert into public.profiles (id, name, look) values ($1, 'Odile', '{}')`, [
      OWNER,
    ]);
  });

  it('mon logement est créé à la demande, privé par défaut ; un visiteur n’en a pas', async () => {
    const r = await as<{ mode: string }>(OWNER, 'select public.my_home() as mode');
    expect(r.rows[0]!.mode).toBe('private');
    // Deuxième appel : rien n'est recréé.
    expect(
      (await as<{ mode: string }>(OWNER, 'select public.my_home() as mode')).rows[0]!.mode,
    ).toBe('private');
    await expect(as(null, 'select public.my_home()')).rejects.toThrow();
  });

  it('privé : seul le propriétaire entre ; il n’apparaît pas dans la liste', async () => {
    expect(await canEnter(OWNER)).toBe(true);
    expect(await canEnter(GUEST)).toBe(false);
    expect(await canEnter(null)).toBe(false);
    expect(await visitable(null)).toHaveLength(0);
    // Le propriétaire entre aussi chez lui avant même d'avoir créé son logement.
    expect(await canEnter(OTHER, OTHER)).toBe(true);
  });

  it('sur invitation : seuls les invités entrent et le voient dans la liste', async () => {
    await as(OWNER, `update public.homes set access = 'invite'`);
    await as(OWNER, 'insert into public.home_invites (guest_id) values ($1)', [GUEST]);
    expect(await canEnter(GUEST)).toBe(true);
    expect(await canEnter(OTHER)).toBe(false);
    expect(await canEnter(null)).toBe(false);
    expect((await visitable(GUEST)).map((h) => h.name)).toEqual(['Odile']);
    expect(await visitable(OTHER)).toHaveLength(0);
    const invites = await as<{ name: string }>(OWNER, 'select * from public.my_home_invites()');
    expect(invites.rows).toHaveLength(1);
    expect((await as(OTHER, 'select * from public.home_invites')).rows).toHaveLength(0);
  });

  it('ouvert à tous : tout le monde entre, même sans compte', async () => {
    await as(OWNER, `update public.homes set access = 'public'`);
    expect(await canEnter(OTHER)).toBe(true);
    expect(await canEnter(null)).toBe(true);
    expect((await visitable(null)).map((h) => h.owner_id)).toEqual([OWNER]);
    // On ne se voit pas soi-même dans la liste des logements à visiter.
    expect(await visitable(OWNER)).toHaveLength(0);
  });

  it('personne d’autre ne règle l’accès ni n’invite à la place du propriétaire', async () => {
    const changed = await as(
      OTHER,
      `update public.homes set access = 'private' where owner_id = $1`,
      [OWNER],
    );
    expect(changed.affectedRows).toBe(0);
    await expect(
      as(OTHER, 'insert into public.home_invites (owner_id, guest_id) values ($1, $2)', [
        OWNER,
        OTHER,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(null, `update public.homes set access = 'public' where owner_id = $1`, [OWNER]),
    ).rejects.toThrow(/permission denied/);
    await expect(as(OWNER, `update public.homes set access = 'ouvert'`)).rejects.toThrow(
      /check constraint/,
    );
  });

  it('l’invité peut refuser une invitation ; 50 invitations au plus', async () => {
    await as(GUEST, 'delete from public.home_invites where owner_id = $1', [OWNER]);
    expect((await as(OWNER, 'select * from public.home_invites')).rows).toHaveLength(0);
    const ids = Array.from(
      { length: 51 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    await db.exec(`insert into auth.users (id) values ${ids.map((id) => `('${id}')`).join(',')}`);
    for (const id of ids.slice(0, 50))
      await as(OWNER, 'insert into public.home_invites (guest_id) values ($1)', [id]);
    await expect(
      as(OWNER, 'insert into public.home_invites (guest_id) values ($1)', [ids[50]]),
    ).rejects.toThrow(/Trop d'invitations/);
  });

  it('supprimer son compte supprime son logement et ses invitations', async () => {
    await as(OWNER, 'select public.delete_my_account()');
    expect(
      (await db.query('select * from public.homes where owner_id = $1', [OWNER])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('select * from public.home_invites where owner_id = $1', [OWNER])).rows,
    ).toHaveLength(0);
  });
});

describe('base de données : décoration des logements (v0.3)', () => {
  const HOST = '00000000-0000-4000-8000-0000000000d1';
  const VISITOR = '00000000-0000-4000-8000-0000000000d2';
  const SOFA = { t: 'sofa', x: 2, y: 3, r: 1, v: 2 };
  const decorOf = async (who: string | null) =>
    (await as<{ d: unknown }>(who, 'select public.home_decor($1) as d', [HOST])).rows[0]!.d;
  const setDecor = (who: string, decor: unknown) =>
    as(who, 'update public.homes set decor = $1 where owner_id = $2', [
      decor === null ? null : JSON.stringify(decor),
      HOST,
    ]);

  beforeAll(async () => {
    await db.exec(
      `insert into auth.users (id) values ('${HOST}'), ('${VISITOR}') on conflict do nothing`,
    );
    await as(HOST, 'select public.my_home()');
  });

  it('le propriétaire enregistre sa décoration ; d’origine, elle est vide (null)', async () => {
    expect(await decorOf(HOST)).toBeNull();
    await setDecor(HOST, [SOFA, { t: 'rug', x: 1, y: 9, r: 0, v: 0 }]);
    expect(await decorOf(HOST)).toEqual([SOFA, { t: 'rug', x: 1, y: 9, r: 0, v: 0 }]);
    await setDecor(HOST, []);
    expect(await decorOf(HOST)).toEqual([]);
  });

  it('la base refuse les décorations mal formées', async () => {
    const bad = [
      [{ ...SOFA, t: 'elevator' }],
      [{ ...SOFA, x: 0 }],
      [{ ...SOFA, x: 11 }],
      [{ ...SOFA, y: 10 }],
      [{ ...SOFA, x: 2.5 }],
      [{ ...SOFA, r: 4 }],
      [{ ...SOFA, v: '1' }],
      [{ ...SOFA, extra: true }],
      [{ t: 'sofa', x: 2, y: 3, r: 1 }],
      ['sofa'],
      { t: 'sofa' },
      Array(41).fill(SOFA),
    ];
    for (const decor of bad)
      await expect(setDecor(HOST, decor), JSON.stringify(decor)).rejects.toThrow(
        /check constraint/,
      );
    await setDecor(HOST, Array(40).fill(SOFA));
  });

  it('personne d’autre ne change la décoration', async () => {
    const changed = await setDecor(VISITOR, [SOFA]);
    expect(changed.affectedRows).toBe(0);
    await expect(
      setDecor(HOST, [SOFA]).then(() => as(null, 'update public.homes set decor = null')),
    ).rejects.toThrow(/permission denied/);
  });

  it('la décoration se lit seulement si l’on peut entrer', async () => {
    await setDecor(HOST, [SOFA]);
    expect(await decorOf(VISITOR)).toBeNull();
    expect(await decorOf(null)).toBeNull();
    await as(HOST, `update public.homes set access = 'public' where owner_id = $1`, [HOST]);
    expect(await decorOf(VISITOR)).toEqual([SOFA]);
    expect(await decorOf(null)).toEqual([SOFA]);
  });
});

describe('base de données : progression (objectifs et secrets)', () => {
  const P1 = '00000000-0000-4000-8000-0000000000e1';
  const P2 = '00000000-0000-4000-8000-0000000000e2';
  type Row = { quests: string[]; secrets: string[] };
  const merge = async (who: string | null, quests: string[], secrets: string[]) =>
    (await as<Row>(who, 'select * from public.merge_my_progress($1, $2)', [quests, secrets]))
      .rows[0]!;

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${P1}'), ('${P2}') on conflict do nothing`);
  });

  it('réunit la progression du navigateur et celle du compte, sans rien perdre', async () => {
    expect(await merge(P1, ['coffee'], ['pixel'])).toEqual({
      quests: ['coffee'],
      secrets: ['pixel'],
    });
    // Un autre appareil, avec d'autres trouvailles : tout est réuni.
    expect(await merge(P1, ['terrace'], ['voeu', 'pixel'])).toEqual({
      quests: ['coffee', 'terrace'],
      secrets: ['pixel', 'voeu'],
    });
    // Un appareil vide récupère tout.
    expect(await merge(P1, [], [])).toEqual({
      quests: ['coffee', 'terrace'],
      secrets: ['pixel', 'voeu'],
    });
  });

  it('ignore les identifiants invalides et limite la taille', async () => {
    const r = await merge(
      P2,
      ['OK', 'a b', "x'); drop table x;--", 'bon_id'],
      Array.from(
        { length: 150 },
        (_, i) =>
          `s_${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
      ),
    );
    expect(r.quests).toEqual(['bon_id']);
    expect(r.secrets.length).toBe(100);
  });

  it('chacun ne voit et ne modifie que sa progression ; pas les visiteurs', async () => {
    const seen = await as<Row>(P2, 'select * from public.player_progress');
    expect(seen.rows).toHaveLength(1);
    await expect(as(P2, `update public.player_progress set quests = '{}'`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(merge(null, ['coffee'], [])).rejects.toThrow();
  });

  it('« Recommencer » efface les objectifs mais garde les secrets', async () => {
    await as(P1, 'select public.reset_my_quests()');
    expect(await merge(P1, [], [])).toEqual({ quests: [], secrets: ['pixel', 'voeu'] });
  });
});

describe('base de données : responsable du site', () => {
  const BOSS = '00000000-0000-4000-8000-0000000000d1';
  const MODO2 = '00000000-0000-4000-8000-0000000000d2';
  const owner = async (who: string | null) =>
    (await as<{ ok: boolean }>(who, 'select public.is_site_owner() as ok')).rows[0]!.ok;

  beforeAll(async () => {
    await db.exec(
      `insert into auth.users (id) values ('${BOSS}'), ('${MODO2}') on conflict do nothing`,
    );
    await db.exec(`insert into public.site_owners (user_id) values ('${BOSS}')`);
    await db.exec(`insert into public.moderators (user_id) values ('${MODO2}')`);
  });

  it('seul le responsable est reconnu (un modérateur ne l’est pas)', async () => {
    expect(await owner(BOSS)).toBe(true);
    expect(await owner(MODO2)).toBe(false);
    expect(await owner(null)).toBe(false);
  });

  it('personne ne lit ni ne modifie la liste par l’API', async () => {
    await expect(as(BOSS, 'select * from public.site_owners')).rejects.toThrow(/permission denied/);
    await expect(
      as(MODO2, 'insert into public.site_owners (user_id) values ($1)', [MODO2]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('base de données : rôles visibles (statut doré, modérateurs)', () => {
  const CHEF = '00000000-0000-4000-8000-0000000000e1';
  const RENAUD = '00000000-0000-4000-8000-0000000000e2';
  const MODO3 = '00000000-0000-4000-8000-0000000000e3';
  const role = async (who: string) =>
    (await as<{ r: string | null }>(null, 'select public.account_role($1) as r', [who])).rows[0]!.r;

  beforeAll(async () => {
    await db.exec(
      `insert into auth.users (id) values ('${CHEF}'), ('${RENAUD}'), ('${MODO3}') on conflict do nothing`,
    );
    await db.exec(`insert into public.site_owners (user_id) values ('${CHEF}')`);
    // Le responsable est aussi modérateur : il n'a pourtant pas de badge (son choix).
    await db.exec(`insert into public.moderators (user_id) values ('${CHEF}')`);
    for (const [id, name] of [
      [CHEF, 'Chef'],
      [RENAUD, 'Renaud'],
      [MODO3, 'Modo3'],
    ] as const)
      await as(id, `insert into public.profiles (id, name, look) values ($1, $2, '{}')`, [
        id,
        name,
      ]);
  });

  it('le responsable donne et retire le statut doré et le rôle de modérateur', async () => {
    expect(await role(RENAUD)).toBeNull();
    await as(CHEF, 'select public.set_gold($1, true)', [RENAUD]);
    await as(CHEF, 'select public.set_moderator($1, true)', [MODO3]);
    expect(await role(RENAUD)).toBe('gold');
    expect(await role(MODO3)).toBe('mod');
    expect(await role(CHEF)).toBeNull();
    const me = await as<{ role: string }>(RENAUD, 'select role from public.my_account()');
    expect(me.rows[0]!.role).toBe('gold');
    await as(CHEF, 'select public.set_moderator($1, false)', [MODO3]);
    expect(await role(MODO3)).toBeNull();
  });

  it('personne d’autre ne donne de rôle, et pas à un compte sans profil', async () => {
    await expect(as(MODO3, 'select public.set_gold($1, true)', [MODO3])).rejects.toThrow(
      /responsable/,
    );
    await expect(as(RENAUD, 'select public.set_moderator($1, true)', [MODO3])).rejects.toThrow(
      /responsable/,
    );
    await expect(as(null, 'select public.set_gold($1, true)', [MODO3])).rejects.toThrow(
      /permission denied/,
    );
    const ghost = '00000000-0000-4000-8000-0000000000e9';
    await expect(as(CHEF, 'select public.set_gold($1, true)', [ghost])).rejects.toThrow(/inconnu/);
    await expect(as(CHEF, 'select * from public.gold_members')).rejects.toThrow(
      /permission denied/,
    );
  });
});
