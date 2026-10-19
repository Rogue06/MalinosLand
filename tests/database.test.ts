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
