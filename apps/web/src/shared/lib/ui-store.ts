'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface Preferences {
  locale: 'id' | 'en';
  research: boolean;
  paper: boolean;
  setLocale: (locale: 'id' | 'en') => void;
  setResearch: (research: boolean) => void;
  setPaper: (paper: boolean) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      locale: 'id',
      research: false,
      paper: false,
      setLocale: (locale) => set({ locale }),
      setResearch: (research) => set({ research }),
      setPaper: (paper) => set({ paper }),
    }),
    { name: 'naskah-preferences-v1', skipHydration: true },
  ),
);
