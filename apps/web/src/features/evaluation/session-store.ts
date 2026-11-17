export interface Review {
  id: string;
  initials: string;
  profession: string;
  date: string;
  project: string;
  ratings?: number[][];
  notes?: string[];
  sus?: { answers: number[]; feedback: string[]; score: number };
}
export interface Session {
  id: string;
  name: string;
  reviews: Review[];
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sreques-research-sessions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function sessions(): Promise<Session[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('sessions').objectStore('sessions').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.transaction!.oncomplete = () => db.close();
  });
}
export async function update(id: string, change: (current: Session | undefined) => Session | null) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite'),
      store = tx.objectStore('sessions');
    let failure: unknown;
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        const next = change(request.result);
        if (next) store.put(next);
        else store.delete(id);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(failure ?? tx.error);
    };
  });
}
