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
  const send = (who: string | null, kind = 'idee', message = 'Ajouter une piscine !') =>
    as(
      who,
      `insert into public.feedback (kind, message, author_name, context) values ($1, $2, 'Eve', '{"zone":"hall"}')`,
      [kind, message],
    );

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${EVE}') on conflict do nothing`);
  });

  it('un visiteur comme un joueur connecté peut envoyer une idée ou un bug', async () => {
    await send(null, 'bug', 'Le banc du jardin flotte');
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
        null,
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
    for (let i = 0; i < 29; i++) await send(null);
    await expect(send(null)).rejects.toThrow(/Trop de messages pour le moment/);
  });
});
