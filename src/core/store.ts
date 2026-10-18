/** Petit conteneur d'état observable, partagé entre le jeu et l'interface. */
export class Store<T> {
  private listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const l of [...this.listeners]) l(next);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
