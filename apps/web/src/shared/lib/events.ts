type Events = { devtools: undefined; documentSaved: { projectId: string } };
type Listener<K extends keyof Events> = (data: Events[K]) => void;
const listeners = new Map<keyof Events, Set<(data: never) => void>>();
export const appEvents = {
  on<K extends keyof Events>(name: K, callback: Listener<K>) {
    const callbacks = listeners.get(name) || new Set();
    callbacks.add(callback as (data: never) => void);
    listeners.set(name, callbacks);
    return () => {
      callbacks.delete(callback as (data: never) => void);
    };
  },
  emit<K extends keyof Events>(name: K, data: Events[K]) {
    listeners.get(name)?.forEach((callback) => callback(data as never));
  },
};
