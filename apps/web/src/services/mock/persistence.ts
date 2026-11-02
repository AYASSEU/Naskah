import { get, set, clear } from 'idb-keyval';
import type { PersistencePort } from '../ports';
import { PortError } from '../ports';
export const persistence: PersistencePort = {
  async get<T>(key: string) {
    try {
      return await get<T>(`naskah:v1:${key}`);
    } catch {
      throw new PortError('storage_unavailable', true, 'storageError');
    }
  },
  async set<T>(key: string, value: T) {
    try {
      await set(`naskah:v1:${key}`, value);
    } catch {
      throw new PortError('storage_full', true, 'storageError');
    }
  },
  async clear() {
    await clear();
  },
};
