/**
 * Bus d'événements typé minimal. Il relie le jeu (Phaser) et l'interface
 * (Preact) sans qu'aucun des deux ne connaisse l'autre.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as (payload: never) => void);
    return () => set.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as (p: Events[K]) => void)(payload);
      } catch (err) {
        console.error(`[eventBus] erreur dans un abonné à « ${String(type)} »`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
