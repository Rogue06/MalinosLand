import { describe, expect, it } from 'vitest';
import { MUSEUM_CATEGORIES, MUSEUM_CATEGORY_IDS, museumCategory } from '../src/content/museum';
import {
  checkProjectDraft,
  isValidProjectUrl,
  normalizeProjectUrl,
  parseTags,
  projectUrlProblem,
} from '../src/core/museum';
import { fitTitle, wrapTitle } from '../src/game/art/posters';
import {
  MUSEUM_WALL_TTL_MS,
  PROJECT_REPORT_REASONS,
  explainProjectError,
  loadMuseumWall,
  museumWallStore,
  parseMuseumProjects,
  parseProjectReports,
  parseMyProjects,
  parseProject,
} from '../src/services/museum';
import migration from '../supabase/migrations/20261027090000_museum.sql?raw';
import museumPanelSource from '../src/ui/panels/Museum.tsx?raw';
import museumVisitSource from '../src/ui/panels/MuseumVisit.tsx?raw';
import hub from '../src/content/maps/hub.json';
import type { MapFile } from '../src/world/types';
import { URL_CASES } from './fixtures/projectUrls';

describe('Musée : adresses des projets', () => {
  it('même verdict que la base sur les cas de référence', () => {
    for (const [url, ok] of URL_CASES) expect(isValidProjectUrl(url), url).toBe(ok);
  });

  it('mise en forme : https ajouté, domaine en minuscules, le reste intact', () => {
    expect(normalizeProjectUrl('  Mon-Site.FR/Page?Q=A  ')).toBe('https://mon-site.fr/Page?Q=A');
    expect(normalizeProjectUrl('HTTPS://Exemple.GitHub.io')).toBe('https://exemple.github.io');
    expect(normalizeProjectUrl('http://mon-site.fr')).toBe('http://mon-site.fr');
    expect(normalizeProjectUrl('')).toBe('');
  });

  it('un message clair pour chaque refus', () => {
    expect(projectUrlProblem('https://mon-site.fr')).toBeNull();
    const cases: Array<[string, RegExp]> = [
      ['', /Indique/],
      ['http://mon-site.fr', /https/],
      ['ftp://mon-site.fr', /commencer par https/],
      ['https://192.168.1.10', /adresse IP/],
      ['https://mon-site.fr:8080', /port/],
      ['https://moi:secret@mon-site.fr', /identifiant/],
      ['https://serveur.local', /Internet/],
      ['https://malinosland.pages.dev', /MalinosLand/],
      ['https://mon-site.fr/a b', /espace/],
      [`https://mon-site.fr/${'a'.repeat(300)}`, /trop longue/],
    ];
    for (const [url, message] of cases) expect(projectUrlProblem(url), url).toMatch(message);
  });
});

describe('Musée : vérification du formulaire', () => {
  const ok = {
    title: '  Malino   Notes ',
    summary: 'Un carnet de notes\npour apprendre l’IA.',
    url: 'mon-projet.github.io',
    category: 'outil-ia',
    tags: '#IA, notes, ia, ',
  };

  it('nettoie et accepte un projet correct', () => {
    expect(checkProjectDraft(ok)).toEqual({
      draft: {
        title: 'Malino Notes',
        summary: 'Un carnet de notes pour apprendre l’IA.',
        url: 'https://mon-projet.github.io',
        category: 'outil-ia',
        tags: ['IA', 'notes'],
      },
      errors: {},
    });
  });

  it('signale chaque champ à corriger', () => {
    const { draft, errors } = checkProjectDraft({
      title: 'A',
      summary: 'Court',
      url: 'http://x.fr',
      category: 'autre',
      tags: 'un, deux, trois, quatre',
    });
    expect(draft).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['category', 'summary', 'tags', 'title', 'url']);
    expect(checkProjectDraft({ ...ok, title: 'x'.repeat(61) }).errors.title).toMatch(/trop long/);
    expect(checkProjectDraft({ ...ok, tags: 'x'.repeat(21) }).errors.tags).toMatch(/20/);
  });

  it('mots-clés : sans dièse, sans doublon, sans caractère de contrôle', () => {
    expect(parseTags(' #IA ,, Jeu\u0000 , ia,#jeu')).toEqual(['IA', 'Jeu']);
  });
});

describe('Musée : données reçues de la base', () => {
  const row = {
    id: 4,
    title: ' Mon‮projet ',
    summary: 'Un résumé assez long.',
    url: 'https://mon-projet.fr',
    category: 'jeu',
    tags: ['a', 'b', 'c', 'd'],
    status: 'rejected',
    reject_reason: 'Lien cassé',
    created_at: '2026-10-24T10:00:00Z',
  };

  it('nettoie les textes et ignore les lignes inutilisables', () => {
    expect(parseProject(row)).toEqual({
      id: 4,
      title: 'Monprojet',
      summary: 'Un résumé assez long.',
      url: 'https://mon-projet.fr',
      category: 'jeu',
      tags: ['a', 'b', 'c'],
    });
    for (const bad of [
      { ...row, url: 'javascript:alert(1)' },
      { ...row, url: 'http://mon-projet.fr' },
      { ...row, category: 'inconnue' },
      { ...row, id: -1 },
      { ...row, title: '' },
      null,
    ])
      expect(parseProject(bad)).toBeNull();
  });

  it('mes projets : statut et motif ; projets exposés : auteur', () => {
    expect(parseMyProjects([row, { ...row, url: 'x' }, { ...row, status: 'bizarre' }])).toEqual([
      expect.objectContaining({ status: 'rejected', rejectReason: 'Lien cassé' }),
      expect.objectContaining({ status: 'pending', rejectReason: 'Lien cassé' }),
    ]);
    const [exposed] = parseMuseumProjects([{ ...row, author: '<b>x', embed: 'ok' }]);
    expect(exposed).toMatchObject({ author: 'Malino', embed: 'ok' });
    expect(parseMuseumProjects('pas une liste')).toEqual([]);
  });

  it('refus de la base expliqués simplement', () => {
    expect(explainProjectError({ message: 'Trop de propositions aujourd’hui' }).message).toMatch(
      /demain/,
    );
    expect(
      explainProjectError({ message: 'Déjà 3 projets en attente de validation' }).message,
    ).toMatch(/3 projets en attente/);
    expect(explainProjectError({ message: 'Déjà 10 projets exposés' }).message).toMatch(/retire/);
    expect(explainProjectError({ code: '23514' }).message).toMatch(/adresse/);
    expect(explainProjectError(null).message).toMatch(/ne répond pas/);
  });
});

describe('Musée : catégories et affiches', () => {
  it('les catégories du jeu sont exactement celles de la base', () => {
    const sql = /category in \(([^)]*)\)/.exec(migration)![1]!;
    expect([...sql.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...MUSEUM_CATEGORY_IDS]);
    expect(MUSEUM_CATEGORIES.map((c) => c.id)).toEqual([...MUSEUM_CATEGORY_IDS]);
    expect(museumCategory('inconnue').id).toBe('site');
  });

  it('titre de l’affiche : coupé aux espaces, mots trop longs coupés, « … » si trop long', () => {
    const measure = (t: string) => t.length * 6;
    expect(wrapTitle('Un petit projet', 60, measure)).toEqual(['Un petit', 'projet']);
    expect(wrapTitle('Anticonstitutionnellement', 60, measure)).toEqual([
      'Anticonsti',
      'tutionnell',
      'ement',
    ]);
    const atSize = (size: number, t: string) => (t.length * size) / 2;
    expect(fitTitle('Court', 90, 3, atSize)).toEqual({ size: 14, lines: ['Court'] });
    const long = fitTitle('mot '.repeat(40).trim(), 90, 3, atSize);
    expect(long.size).toBe(9);
    expect(long.lines).toHaveLength(3);
    expect(long.lines[2]!.endsWith('…')).toBe(true);
    for (const line of long.lines) expect(atSize(9, line)).toBeLessThanOrEqual(90);
  });

  it('liens externes : nouvel onglet, sans transmettre la page d’origine', () => {
    expect(museumPanelSource).toMatch(/target="_blank" rel="noopener noreferrer"/);
    expect(museumPanelSource.match(/<a /g)).toHaveLength(1);
  });
});

describe('Musée : la salle (v0.4, PR 9)', () => {
  const map = hub as unknown as MapFile;

  it('la galerie est ouverte et devient le Musée des Malinos, sans barrière à l’entrée', () => {
    const zone = map.zones.find((z) => z.id === 'gallery')!;
    expect(zone).toMatchObject({ name: 'Musée des Malinos', status: 'open' });
    const inside = (o: { x: number; y: number }) =>
      o.x >= zone.rect.x &&
      o.x < zone.rect.x + zone.rect.w &&
      o.y >= zone.rect.y &&
      o.y < zone.rect.y + zone.rect.h;
    expect(map.objects.filter((o) => o.type === 'rope_barrier' && inside(o))).toEqual([]);
    expect(map.objects.some((o) => o.type === 'museum_kiosk' && inside(o))).toBe(true);
    expect(map.objects.find((o) => o.id === 'gallery-sign')?.type).toBe('sign_museum');
  });

  it('7 stands, chacun à sa place (0 = le projet le plus récent)', () => {
    const slots = map.objects.flatMap((o) =>
      o.interaction?.kind === 'stand' ? [o.interaction.slot] : [],
    );
    expect([...slots].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const o of map.objects.filter((x) => x.interaction?.kind === 'stand'))
      expect(['museum_wall', 'museum_stand']).toContain(o.type);
  });

  it('liste des stands : hors ligne, stands libres ; une seule lecture toutes les 5 minutes', async () => {
    museumWallStore.set({ status: 'idle', projects: [], at: 0 });
    await loadMuseumWall(1000);
    // Pas de serveur de comptes dans les tests : rien n'est demandé au réseau.
    expect(museumWallStore.get()).toEqual({ status: 'offline', projects: [], at: 1000 });
    const ready = { status: 'ready' as const, projects: [], at: 5000 };
    museumWallStore.set(ready);
    await loadMuseumWall(5000 + MUSEUM_WALL_TTL_MS - 1);
    expect(museumWallStore.get()).toBe(ready);
  });

  it('signalements de projets : mêmes motifs que la base, données relues', () => {
    const sql = /reason in \(([^)]*)\)/.exec(
      migration.slice(migration.indexOf('project_reports')),
    )![1]!;
    expect([...sql.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(
      PROJECT_REPORT_REASONS.map((r) => r.id).sort(),
    );
    expect(
      parseProjectReports([
        {
          id: 1,
          project_id: 4,
          reason: 'arnaque',
          details: 'Demande\nmon mot de passe',
          status: 'ouvert',
          created_at: '2026-10-24T10:00:00Z',
          projects: { title: 'Projet', url: 'javascript:alert(1)', status: 'approved' },
        },
        { id: 'x' },
      ]),
    ).toEqual([
      {
        id: 1,
        projectId: 4,
        status: 'ouvert',
        reason: 'arnaque',
        details: 'Demande mon mot de passe',
        createdAt: '2026-10-24T10:00:00Z',
        project: { title: 'Projet', url: '', status: 'approved' },
      },
    ]);
  });

  it('fiche et liste : aucun lien direct, tout passe par ExternalLink', () => {
    expect(museumVisitSource).not.toMatch(/<a /);
    expect(museumVisitSource).toMatch(/<ExternalLink url=\{project\.url\}/);
  });
});
