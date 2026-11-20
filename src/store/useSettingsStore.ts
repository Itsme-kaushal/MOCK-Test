import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TestLanguage } from '../types/schema';

interface SettingsState {
  darkMode: boolean;
  claudeApiKey: string;
  claudeModel: string;
  defaultLanguage: TestLanguage;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setClaudeApiKey: (key: string) => void;
  setClaudeModel: (model: string) => void;
  setDefaultLanguage: (lang: TestLanguage) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      claudeApiKey: '',
      claudeModel: 'claude-3-5-sonnet-latest',
      defaultLanguage: 'bilingual',
      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next);
          }
          return { darkMode: next };
        }),
      setDarkMode: (dark) =>
        set(() => {
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', dark);
          }
          return { darkMode: dark };
        }),
      setClaudeApiKey: (claudeApiKey) => set({ claudeApiKey }),
      setClaudeModel: (claudeModel) => set({ claudeModel }),
      setDefaultLanguage: (defaultLanguage) => set({ defaultLanguage }),
    }),
    {
      name: 'mocktest-studio-settings',
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', state.darkMode);
        }
      },
    }
  )
);
