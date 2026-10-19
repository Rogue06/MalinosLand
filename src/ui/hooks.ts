import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../core/store';

/** Abonne un composant à un Store. */
export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}
