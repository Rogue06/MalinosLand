import './sandbox.css';
import { itemDef } from './blocks';
import { SandboxGame, type GameMode } from './game';
import { HOTBAR_SIZE, RECIPES, STATION_LABEL } from './inventory';
import { ALL_ITEMS } from './blocks';
import { VersionedStorage } from '../services/storage';
import { setSoundEnabled, sfx, soundEnabled } from './sfx';
import { TUTORIAL, currentStep, type TutorialState } from './tutorial';
import { drawIcon } from './textures';

/**
 * Page du prototype « Chantier des mondes » (B0) : écran d'accueil (survie douce ou créatif),
 * barre rapide, sac et fabrication, menu, commandes tactiles. Interface construite en DOM sans
 * innerHTML : tout texte est posé avec textContent.
 */

type Attrs = Record<string, string | boolean | ((e: Event) => void)>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string | null | false>
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false) e.setAttribute(k, v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

const root = document.getElementById('chantier')!;
const store = new VersionedStorage();

/** Où en est le tutoriel (dans ce navigateur) : étape atteinte, ou terminé / passé. */
interface TutoSave {
  step: number;
  done: boolean;
}
const readTuto = (): TutoSave =>
  store.read<TutoSave>('chantier-tuto', 1, (raw) => {
    const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const step = Number.isInteger(r.step)
      ? Math.max(0, Math.min(TUTORIAL.length, r.step as number))
      : 0;
    return { step, done: r.done === true };
  }) ?? { step: 0, done: false };
const writeTuto = (t: TutoSave) => store.write('chantier-tuto', 1, t);
const coarse = matchMedia('(pointer: coarse)').matches;
let game: SandboxGame | null = null;

// ------------------------------------------------------------------ écran d'accueil

function startScreen(): void {
  game?.dispose();
  game = null;
  root.replaceChildren(
    el(
      'section',
      { class: 'start' },
      el('p', { class: 'eyebrow' }, 'MALINOSLAND · PROTOTYPE'),
      el('h1', {}, 'Chantier des mondes'),
      el(
        'p',
        { class: 'lead' },
        'Creuse, récolte, fabrique tes outils et construis ce que tu veux. Ta partie est gardée dans ce navigateur.',
      ),
      el(
        'div',
        { class: 'modes' },
        modeButton(
          'survival',
          '⛏️',
          'Survie douce',
          'Coupe des arbres, fabrique un établi et des pioches, trouve du charbon et du cristal, éclaire les grottes. Ni monstres ni faim.',
        ),
        modeButton(
          'creative',
          '🎨',
          'Créatif',
          'Tous les cubes à volonté, casse en un clic, vole avec F. Construis sans limite (un monde à part).',
        ),
      ),
      el(
        'div',
        { class: 'help' },
        el('h2', {}, coarse ? 'Au doigt' : 'Commandes'),
        coarse
          ? el(
              'ul',
              {},
              el('li', {}, 'Manette à gauche : marcher. Glisser l’écran : regarder.'),
              el('li', {}, '⛏ maintenu : creuser · 🧱 : poser · ⤒ : sauter.'),
              el('li', {}, '👁 : passer de la vue à la première personne à la vue isométrique.'),
            )
          : el(
              'ul',
              {},
              el(
                'li',
                {},
                'ZQSD / WASD : marcher · Espace : sauter · Ctrl ou double Z : courir · Maj : s’accroupir (on ne tombe pas du bord).',
              ),
              el(
                'li',
                {},
                'Souris : regarder · clic gauche maintenu : creuser · clic droit : poser · clic molette : prendre le cube visé.',
              ),
              el(
                'li',
                {},
                '1 à 9 ou molette : choisir · E : sac et fabrication · F5 ou V : changer de vue.',
              ),
              el(
                'li',
                {},
                'Clic droit sur un établi ou un four : fabriquer · créatif : double Espace pour voler · Échap : menu.',
              ),
            ),
      ),
      el('a', { class: 'back', href: '../jouer/' }, '← Retour au Hub'),
    ),
  );
}

function modeButton(mode: GameMode, icon: string, title: string, text: string): HTMLElement {
  return el(
    'button',
    { class: 'mode', type: 'button', onclick: () => play(mode) },
    el('span', { class: 'mode-icon', 'aria-hidden': 'true' }, icon),
    el('strong', {}, title),
    el('span', {}, text),
  );
}

// ------------------------------------------------------------------ partie

function play(mode: GameMode): void {
  const stage = el('div', { class: 'stage' });
  const hud = el('div', { class: 'hud' });
  root.replaceChildren(stage, hud);
  const toastBox = el('div', { class: 'toasts', 'aria-live': 'polite' });
  let toastTimer = 0;
  const toast = (text: string) => {
    toastBox.replaceChildren(el('div', { class: 'toast' }, text));
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastBox.replaceChildren(), 2600);
  };
  let openPanel: 'bag' | 'menu' | null = null;

  const g = new SandboxGame(stage, mode, {
    changed: () => refresh(),
    toast,
    openInventory: () => showPanel('bag'),
  });
  game = g;

  // Barre rapide.
  const slots = Array.from({ length: HOTBAR_SIZE }, (_, i) => {
    const canvas = el('canvas', { class: 'slot-icon' });
    const count = el('span', { class: 'slot-count' });
    const b = el(
      'button',
      {
        class: 'slot',
        type: 'button',
        onclick: () => {
          g.inv.selected = i;
          refresh();
        },
      },
      el('span', { class: 'slot-key' }, String(i + 1)),
      canvas,
      count,
    );
    return { b, canvas, count, item: null as number | null };
  });
  const hotbar = el('div', { class: 'hotbar' }, ...slots.map((s) => s.b));
  const heldName = el('div', { class: 'held-name' });

  // ---- Tutoriel (survie douce) : une carte en haut à gauche, jamais bloquante.
  let tuto = readTuto();
  const tutoCard = el('section', { class: 'tuto', 'aria-live': 'polite' });
  const tutoState: TutorialState = {
    get looked() {
      return g.looked;
    },
    get walked() {
      return g.walked;
    },
    count: (item) => g.inv.count(item),
    placed: (block) => g.placedTypes.has(block),
  };
  let shownStep = -1;
  function renderTuto(step: number | null) {
    if (mode !== 'survival' || tuto.done) {
      tutoCard.hidden = true;
      return;
    }
    tutoCard.hidden = false;
    if (step === null) {
      tutoCard.replaceChildren(
        el('strong', {}, '🎉 Bravo, tu sais tout faire !'),
        el(
          'p',
          {},
          'Explore les grottes : le charbon donne des torches, le cristal une pioche bien plus rapide. Construis ce que tu veux.',
        ),
        el(
          'button',
          {
            class: 'tool',
            type: 'button',
            onclick: () => {
              tuto = { step: TUTORIAL.length, done: true };
              writeTuto(tuto);
              renderTuto(null);
            },
          },
          'Terminer',
        ),
      );
      return;
    }
    const s = TUTORIAL[step]!;
    tutoCard.replaceChildren(
      el('span', { class: 'tuto-step' }, `Tutoriel · ${step + 1}/${TUTORIAL.length}`),
      el('strong', {}, s.title),
      el('p', {}, coarse ? s.touch : s.text),
      el(
        'button',
        {
          class: 'tuto-skip',
          type: 'button',
          onclick: () => {
            tuto = { step, done: true };
            writeTuto(tuto);
            renderTuto(null);
          },
        },
        'Passer le tutoriel',
      ),
    );
  }

  // Boutons du haut.
  const viewBtn = el('button', { class: 'tool', type: 'button', onclick: () => toggleView() });
  const flyBtn = el('button', {
    class: 'tool',
    type: 'button',
    onclick: () => {
      g.fly = !g.fly;
      refresh();
    },
  });
  const rotL = el(
    'button',
    { class: 'tool', type: 'button', title: 'Tourner la vue', onclick: () => g.rotateIso(-1) },
    '⟲',
  );
  const rotR = el(
    'button',
    { class: 'tool', type: 'button', title: 'Tourner la vue', onclick: () => g.rotateIso(1) },
    '⟳',
  );
  const top = el(
    'div',
    { class: 'top' },
    viewBtn,
    el(
      'button',
      { class: 'tool', type: 'button', onclick: () => showPanel('bag') },
      coarse ? '🎒 Sac' : '🎒 Sac (E)',
    ),
    mode === 'creative' ? flyBtn : null,
    rotL,
    rotR,
    el('button', { class: 'tool', type: 'button', onclick: () => showPanel('menu') }, '☰ Menu'),
  );

  const crosshair = el('div', { class: 'crosshair', 'aria-hidden': 'true' });
  const bar = el('div', { class: 'mine-bar' }, el('span', {}));
  const lockHint = el(
    'div',
    { class: 'lock-hint' },
    'Clique dans le monde pour jouer · Échap pour libérer la souris',
  );
  const stats = el('div', { class: 'stats', hidden: true });
  const panel = el('div', { class: 'panel-host' });

  // Commandes tactiles.
  const touch = coarse ? touchControls(g, () => refresh()) : null;

  hud.append(top, tutoCard, crosshair, bar, lockHint, heldName, hotbar, toastBox, stats, panel);
  if (touch) hud.append(touch.root);

  function toggleView() {
    g.setView(g.view === 'first' ? 'iso' : 'first');
    toast(
      g.view === 'first'
        ? 'Vue à la première personne'
        : 'Vue isométrique : la coupe suit ton étage',
    );
  }

  function refresh() {
    const first = g.view === 'first';
    // Raccourcis clavier affichés seulement quand il y a un clavier.
    const k = (key: string) => (coarse ? '' : ` (${key})`);
    viewBtn.textContent = first ? `👁 Vue iso${k('V')}` : `👁 1re personne${k('V')}`;
    flyBtn.textContent = `🕊 Vol : ${g.fly ? 'oui' : 'non'}${k('F')}`;
    rotL.hidden = first;
    rotR.hidden = first;
    crosshair.hidden = !first;
    slots.forEach((s, i) => {
      const item = g.inv.hotbar[i] ?? null;
      if (item !== s.item) {
        s.item = item;
        if (item !== null) drawIcon(s.canvas, g.atlas, item);
        else s.canvas.getContext('2d')?.clearRect(0, 0, s.canvas.width, s.canvas.height);
      }
      const n = item !== null ? g.inv.count(item) : 0;
      s.count.textContent = item !== null && mode === 'survival' && n > 1 ? String(n) : '';
      s.b.classList.toggle('selected', i === g.inv.selected);
      s.b.title = item !== null ? (itemDef(item)?.name ?? '') : 'Case vide';
    });
    const held = g.inv.held();
    // Nom de l'objet tenu, et ce qu'on peut en faire.
    const def = held !== null ? itemDef(held) : null;
    const hint = !def
      ? coarse
        ? '⛏ : creuser'
        : 'clic gauche maintenu : creuser'
      : def.block
        ? coarse
          ? '🧱 : poser'
          : 'clic droit : poser'
        : def.tool
          ? coarse
            ? '⛏ : creuser plus vite'
            : 'creuse plus vite'
          : 'sert à fabriquer (sac)';
    heldName.textContent = `${def?.name ?? 'Mains nues'} · ${hint}`;
    touch?.refresh();
    if (openPanel === 'bag') renderBag();
  }

  // ---- Sac et fabrication.
  function renderBag() {
    const items = mode === 'creative' ? ALL_ITEMS.map((i) => i.id) : [...g.inv.counts.keys()];
    const grid = el(
      'div',
      { class: 'bag-grid' },
      ...items.map((id) => {
        const c = el('canvas', { class: 'slot-icon' });
        drawIcon(c, g.atlas, id);
        return el(
          'button',
          {
            class: 'slot',
            type: 'button',
            title: `${itemDef(id)?.name ?? ''} : ranger dans la case ${g.inv.selected + 1}`,
            onclick: () => {
              g.inv.assign(id);
              refresh();
            },
          },
          c,
          el('span', { class: 'slot-count' }, mode === 'survival' ? String(g.inv.count(id)) : ''),
          el('span', { class: 'slot-name' }, itemDef(id)?.name ?? ''),
        );
      }),
    );
    const stations = g.stations();
    const recipes =
      mode === 'survival'
        ? el(
            'div',
            { class: 'recipes' },
            el('h3', {}, 'Fabriquer'),
            el(
              'p',
              { class: 'muted' },
              stations.size
                ? `À côté de toi : ${[...stations].map((s) => STATION_LABEL[s]).join(' et ')}.`
                : 'Pose un établi près de toi pour fabriquer des outils.',
            ),
            ...RECIPES.map((r) => {
              const problem = g.inv.craftProblem(r, stations);
              const out = el('canvas', { class: 'slot-icon small' });
              drawIcon(out, g.atlas, r.out[0]);
              return el(
                'div',
                { class: `recipe${problem ? ' locked' : ''}` },
                out,
                el(
                  'div',
                  { class: 'recipe-text' },
                  el('strong', {}, `${r.out[1]} × ${itemDef(r.out[0])?.name ?? ''}`),
                  el(
                    'span',
                    {},
                    r.needs.map(([i, n]) => `${n} ${itemDef(i)?.name ?? ''}`).join(' + ') +
                      (r.station ? ` · ${STATION_LABEL[r.station]}` : ''),
                  ),
                ),
                el(
                  'button',
                  {
                    class: 'craft',
                    type: 'button',
                    title: problem ?? 'Fabriquer',
                    disabled: !!problem,
                    onclick: () => {
                      if (g.inv.craft(r, g.stations())) {
                        sfx.crafted();
                        toast(`Fabriqué : ${r.out[1]} × ${itemDef(r.out[0])?.name ?? ''}`);
                        g.save();
                        refresh();
                      }
                    },
                  },
                  'Fabriquer',
                ),
              );
            }),
          )
        : el(
            'p',
            { class: 'muted' },
            'Créatif : choisis un cube, il va dans la case choisie de ta barre.',
          );
    panel.replaceChildren(
      el(
        'div',
        { class: 'panel', role: 'dialog', 'aria-label': 'Sac' },
        el(
          'header',
          {},
          el('h2', {}, mode === 'survival' ? '🎒 Ton sac' : '🎨 Tous les cubes'),
          el('button', { class: 'tool', type: 'button', onclick: () => closePanel() }, '✕'),
        ),
        el(
          'p',
          { class: 'muted' },
          items.length
            ? `Clique sur un objet pour le mettre dans la case ${g.inv.selected + 1} de ta barre.`
            : 'Ton sac est vide : coupe un arbre (clic maintenu sur un tronc) pour commencer.',
        ),
        grid,
        recipes,
      ),
    );
  }

  function renderMenu() {
    panel.replaceChildren(
      el(
        'div',
        { class: 'panel narrow', role: 'dialog', 'aria-label': 'Menu' },
        el(
          'header',
          {},
          el('h2', {}, '☰ Menu'),
          el('button', { class: 'tool', type: 'button', onclick: () => closePanel() }, '✕'),
        ),
        el(
          'button',
          { class: 'menu-btn', type: 'button', onclick: () => closePanel() },
          '▶ Reprendre',
        ),
        el(
          'button',
          {
            class: 'menu-btn',
            type: 'button',
            onclick: () => {
              g.respawn();
              closePanel();
            },
          },
          '🏠 Revenir au départ (si tu es coincé)',
        ),
        el(
          'button',
          {
            class: 'menu-btn',
            type: 'button',
            onclick: () => {
              g.autoStep = !g.autoStep;
              toast(
                g.autoStep
                  ? 'Marche automatique : on monte seul une marche.'
                  : 'Marche automatique désactivée.',
              );
              renderMenu();
            },
          },
          `🦶 Marche automatique : ${g.autoStep ? 'oui' : 'non'}`,
        ),
        el(
          'button',
          {
            class: 'menu-btn',
            type: 'button',
            onclick: () => {
              stats.hidden = !stats.hidden;
              closePanel();
            },
          },
          '📊 Mesures (images par seconde, poids)',
        ),
        el(
          'button',
          {
            class: 'menu-btn',
            type: 'button',
            onclick: () => {
              setSoundEnabled(!soundEnabled());
              renderMenu();
            },
          },
          `🔊 Bruitages : ${soundEnabled() ? 'oui' : 'non'}`,
        ),
        mode === 'creative'
          ? el(
              'button',
              { class: 'menu-btn', type: 'button', onclick: () => g.undo() },
              '↶ Annuler (Ctrl+Z)',
            )
          : null,
        el(
          'button',
          {
            class: 'menu-btn',
            type: 'button',
            onclick: () => {
              g.save();
              startScreen();
            },
          },
          '🔀 Changer de mode',
        ),
        mode === 'survival'
          ? el(
              'button',
              {
                class: 'menu-btn',
                type: 'button',
                onclick: () => {
                  g.looked = 0;
                  g.walked = 0;
                  tuto = { step: 0, done: false };
                  writeTuto(tuto);
                  shownStep = -1;
                  closePanel();
                },
              },
              '📘 Revoir le tutoriel',
            )
          : null,
        el(
          'button',
          {
            class: 'menu-btn danger',
            type: 'button',
            onclick: () => {
              if (confirm('Effacer ce monde et recommencer ? Tes constructions seront perdues.')) {
                g.restart();
                closePanel();
              }
            },
          },
          '🗑 Recommencer ce monde',
        ),
        el(
          'a',
          { class: 'menu-btn', href: '../jouer/', onclick: () => g.save() },
          '← Retour au Hub',
        ),
      ),
    );
  }

  function showPanel(p: 'bag' | 'menu') {
    openPanel = p;
    g.keys.clear();
    g.mining = false;
    if (document.pointerLockElement) document.exitPointerLock();
    if (p === 'bag') renderBag();
    else renderMenu();
  }

  function closePanel() {
    openPanel = null;
    panel.replaceChildren();
  }

  // ---- Clavier (mêmes touches que les jeux de cubes les plus connus).
  let lastForward = 0;
  let lastJump = 0;
  const onKey = (e: KeyboardEvent) => {
    if (!game || game !== g) return;
    const down = e.type === 'keydown';
    if (down && e.code === 'Escape') {
      if (openPanel) closePanel();
      else if (!document.pointerLockElement) showPanel('menu');
      return;
    }
    if (down && e.code === 'KeyE') {
      if (openPanel === 'bag') closePanel();
      else showPanel('bag');
      e.preventDefault();
      return;
    }
    if (openPanel) return;
    if (down && /^Digit[1-9]$/.test(e.code)) {
      g.inv.selected = Number(e.code.slice(5)) - 1;
      refresh();
    }
    if (down && (e.code === 'KeyV' || e.code === 'F5')) {
      e.preventDefault();
      toggleView();
    }
    // Double appui sur « avancer » : on court ; double Espace en créatif : on vole.
    if (down && !e.repeat && (e.code === 'KeyW' || e.code === 'ArrowUp')) {
      if (performance.now() - lastForward < 300) g.sprintLatch = true;
      lastForward = performance.now();
    }
    if (!down && (e.code === 'KeyW' || e.code === 'ArrowUp')) g.sprintLatch = false;
    if (down && !e.repeat && e.code === 'Space' && mode === 'creative') {
      if (performance.now() - lastJump < 300) {
        g.fly = !g.fly;
        toast(g.fly ? 'Vol : Espace pour monter, Maj pour descendre.' : 'Vol arrêté.');
        refresh();
      }
      lastJump = performance.now();
    }
    if (down && e.code === 'KeyF' && mode === 'creative') {
      g.fly = !g.fly;
      refresh();
    }
    if (down && e.code === 'KeyR' && g.view === 'iso') g.rotateIso(e.shiftKey ? -1 : 1);
    if (down && e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      g.undo();
      e.preventDefault();
      return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
    // ZQSD (clavier français) : les touches physiques W, A, S, D sont lues par leur position.
    if (down) g.keys.add(e.code);
    else g.keys.delete(e.code);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => g.keys.clear());

  // ---- Boucle légère de l'interface : barre de creusage, aide, mesures.
  const jsKo = Math.round(
    performance
      .getEntriesByType('resource')
      .filter((r) => /\.js(\?|$)/.test(r.name))
      .reduce((n, r) => n + ((r as PerformanceResourceTiming).encodedBodySize || 0), 0) / 1024,
  );
  const tick = () => {
    if (game !== g) return;
    bar.classList.toggle('on', g.progress > 0);
    (bar.firstChild as HTMLElement).style.width = `${Math.round(g.progress * 100)}%`;
    lockHint.hidden = coarse || g.view !== 'first' || !!document.pointerLockElement || !!openPanel;
    // Tutoriel : on passe à l'étape suivante dès que la consigne est faite.
    if (mode === 'survival' && !tuto.done) {
      const step = currentStep(tutoState, tuto.step);
      if (step !== shownStep) {
        if (shownStep >= 0) sfx.crafted();
        shownStep = step ?? TUTORIAL.length;
        if (step !== null && step !== tuto.step) {
          tuto = { step, done: false };
          writeTuto(tuto);
        }
        renderTuto(step);
      }
    }
    if (!stats.hidden) {
      const s = g.stats();
      stats.textContent = `${s.fps} images/s · ${s.triangles.toLocaleString('fr-FR')} triangles · ${s.calls} dessins · JavaScript chargé : ${jsKo} Ko`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  refresh();
  if (mode === 'creative')
    toast('Créatif : tous les cubes sont dans ta barre et dans le sac (E). F pour voler.');
  else if (tuto.done) toast('Content de te revoir ! Ta partie a été gardée.');
}

/** Manette tactile : joystick, saut, creuser, poser, changer de vue. */
function touchControls(g: SandboxGame, refresh: () => void) {
  const knob = el('span', { class: 'knob' });
  const stick = el('div', { class: 'stick' }, knob);
  let id: number | null = null;
  let c = { x: 0, y: 0 };
  stick.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const max = 44;
    let dx = e.clientX - c.x;
    let dy = e.clientY - c.y;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    g.move = { x: dx / max, y: -dy / max };
  });
  const release = () => {
    id = null;
    knob.style.transform = '';
    g.move = { x: 0, y: 0 };
  };
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);

  const hold = (label: string, on: () => void, off: () => void, title: string) => {
    const b = el('button', { class: 'pad', type: 'button', 'aria-label': title }, label);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      on();
    });
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    return b;
  };
  const jump = hold(
    '⤒',
    () => (g.jumpHeld = true),
    () => (g.jumpHeld = false),
    'Sauter',
  );
  const dig = hold(
    '⛏',
    () => {
      if (g.view === 'iso') g.touchTool = 'dig';
      else g.mining = true;
      refresh();
    },
    () => {
      if (g.view === 'first') g.mining = false;
    },
    'Creuser',
  );
  const put = el(
    'button',
    {
      class: 'pad',
      type: 'button',
      'aria-label': 'Poser',
      onclick: () => {
        if (g.view === 'iso') g.touchTool = 'place';
        else g.placeOrUse();
        refresh();
      },
    },
    '🧱',
  );
  const rootEl = el('div', { class: 'touch' }, stick, el('div', { class: 'pads' }, dig, put, jump));
  return {
    root: rootEl,
    refresh() {
      const iso = g.view === 'iso';
      dig.classList.toggle('active', iso && g.touchTool === 'dig');
      put.classList.toggle('active', iso && g.touchTool === 'place');
    },
  };
}

// Outil de test (URL avec ?debug) : accès à la partie en cours, rien de plus que dans la page.
if (new URLSearchParams(location.search).has('debug'))
  (window as unknown as Record<string, unknown>).__chantier = () => game;

startScreen();
