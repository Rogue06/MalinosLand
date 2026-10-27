/**
 * Touches du « Chantier des mondes », réglables par le joueur (logique pure et testée). On lit
 * la **position** des touches (`KeyboardEvent.code`) : sur un clavier français, la touche à la
 * place du W américain est le Z, ce qui donne ZQSD sans réglage.
 */
export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'sneak'
  | 'inventory'
  | 'view'
  | 'fly';

export type Bindings = Record<Action, string[]>;

export const ACTIONS: ReadonlyArray<{ id: Action; label: string }> = [
  { id: 'forward', label: 'Avancer' },
  { id: 'back', label: 'Reculer' },
  { id: 'left', label: 'Aller à gauche' },
  { id: 'right', label: 'Aller à droite' },
  { id: 'jump', label: 'Sauter (et monter en vol)' },
  { id: 'sprint', label: 'Courir' },
  { id: 'sneak', label: 'S’accroupir (et descendre en vol)' },
  { id: 'inventory', label: 'Sac et fabrication' },
  { id: 'view', label: 'Changer de vue' },
  { id: 'fly', label: 'Voler (créatif)' },
];

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ControlLeft', 'ControlRight'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  inventory: ['KeyE'],
  view: ['F5', 'KeyV'],
  fly: ['KeyF'],
};

/** Touches réservées : Échap (menu), 1 à 9 (barre rapide). */
export function reserved(code: string): boolean {
  return code === 'Escape' || /^Digit[1-9]$/.test(code);
}

const CODE_RE = /^[A-Za-z0-9]{1,24}$/;

export function copyBindings(b: Bindings): Bindings {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, [...b[a.id]]])) as Bindings;
}

/** Relit des réglages sauvegardés prudemment : une action sans touche valide reprend sa touche par défaut. */
export function parseBindings(raw: unknown): Bindings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = copyBindings(DEFAULT_BINDINGS);
  const used = new Set<string>();
  for (const { id } of ACTIONS) {
    const list = Array.isArray(r[id])
      ? (r[id] as unknown[])
          .filter((c): c is string => typeof c === 'string' && CODE_RE.test(c) && !reserved(c))
          .filter((c, i, all) => !used.has(c) && all.indexOf(c) === i)
          .slice(0, 3)
      : [];
    if (list.length > 0) out[id] = list;
    for (const c of out[id]) used.add(c);
  }
  return out;
}

/**
 * Change la touche principale d'une action. Si la touche servait déjà à une autre action, les
 * deux s'échangent : aucune action ne se retrouve sans touche.
 */
export function rebind(b: Bindings, action: Action, code: string): Bindings {
  if (reserved(code) || !CODE_RE.test(code)) return b;
  const out = copyBindings(b);
  const previous = out[action][0];
  for (const { id } of ACTIONS) {
    if (id === action) continue;
    const i = out[id].indexOf(code);
    if (i < 0) continue;
    out[id].splice(i, 1);
    if (out[id].length === 0 && previous && previous !== code) out[id] = [previous];
  }
  out[action] = [code, ...out[action].filter((c) => c !== code && c !== previous)].slice(0, 3);
  return out;
}

/** L'action est-elle appuyée (une de ses touches est enfoncée) ? */
export function pressed(b: Bindings, action: Action, keys: ReadonlySet<string>): boolean {
  return b[action].some((c) => keys.has(c));
}

/** Actions déclenchées par une touche. */
export function actionsOf(b: Bindings, code: string): Action[] {
  return ACTIONS.map((a) => a.id).filter((id) => b[id].includes(code));
}

const NAMES: Record<string, string> = {
  Space: 'Espace',
  ShiftLeft: 'Maj gauche',
  ShiftRight: 'Maj droite',
  ControlLeft: 'Ctrl gauche',
  ControlRight: 'Ctrl droite',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Tab: 'Tab',
  Enter: 'Entrée',
  Backspace: 'Retour arrière',
  CapsLock: 'Verr. maj',
};

/**
 * Nom lisible d'une touche. `layout` (facultatif) : la vraie lettre gravée sur le clavier du
 * joueur (« Z » pour KeyW sur un clavier français), quand le navigateur sait la donner.
 */
export function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string {
  const real = layout?.get(code);
  if (real && real.trim()) return real.toUpperCase();
  if (NAMES[code]) return NAMES[code]!;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Pavé ${code.slice(6)}`;
  return code;
}
