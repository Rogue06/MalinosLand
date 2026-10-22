/**
 * Progression sur le compte (lot A) : objectifs et secrets trouvés suivent le joueur connecté
 * sur tous ses appareils. Le navigateur garde sa copie (visiteurs, hors ligne) ; dès qu'on est
 * connecté, la base réunit les deux (`merge_my_progress`) et renvoie le total, qu'on reprend ici.
 * Rien n'est jamais retiré, sauf « Recommencer » les objectifs (`reset_my_quests`).
 */
import { accountStore, load } from './account';
import {
  parseProgress,
  parseSecrets,
  progressStore,
  resetProgress,
  secretsStore,
} from './progress';

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
/** Dernier état envoyé et confirmé par la base (pour ne rien renvoyer d'inutile). */
let lastSynced = '';

const snapshot = () =>
  JSON.stringify([[...progressStore.get()].sort(), [...secretsStore.get()].sort()]);
const signedIn = () => accountStore.get().status === 'signed-in';
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

async function sync(): Promise<void> {
  if (!signedIn()) return;
  if (running) {
    schedule(1000);
    return;
  }
  if (snapshot() === lastSynced) return;
  running = true;
  try {
    const { db } = await load();
    const { data, error } = await db.rpc('merge_my_progress', {
      p_quests: progressStore.get(),
      p_secrets: secretsStore.get(),
    });
    if (error) return;
    const row = (Array.isArray(data) ? data[0] : data) as
      { quests?: unknown; secrets?: unknown } | undefined;
    // On ajoute ce que la base connaît (trouvé sur un autre appareil), sans rien retirer.
    const quests = union(progressStore.get(), parseProgress(row?.quests));
    const secrets = union(secretsStore.get(), parseSecrets(row?.secrets));
    if (quests.length !== progressStore.get().length) progressStore.set(quests);
    if (secrets.length !== secretsStore.get().length) secretsStore.set(secrets);
    lastSynced = snapshot();
  } catch {
    // Réessayé au prochain changement : la copie du navigateur reste la référence en attendant.
  } finally {
    running = false;
  }
}

function schedule(ms: number): void {
  if (!signedIn()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sync(), ms);
}

/** À appeler une fois au démarrage du jeu. */
export function startProgressSync(): void {
  accountStore.subscribe((s) => {
    if (s.status === 'signed-in') schedule(0);
    else lastSynced = '';
  });
  progressStore.subscribe(() => schedule(1500));
  secretsStore.subscribe(() => schedule(1500));
  schedule(0);
}

/** « Recommencer » les objectifs : ici et, pour un compte, dans la base. */
export async function restartQuests(): Promise<void> {
  if (signedIn()) {
    try {
      // D'abord la base, sinon la synchronisation ramènerait aussitôt les objectifs.
      const { db } = await load();
      await db.rpc('reset_my_quests');
      lastSynced = '';
    } catch {
      // Au pire, les objectifs reviendront à la prochaine synchronisation.
    }
  }
  resetProgress();
}
