import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  selectedProvider: string;
  selectedModel: string;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      selectedProvider: 'qwen',
      selectedModel: 'qwen3.5-plus',
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      setSelectedModel: (model) => set({ selectedModel: model }),
    }),
    { name: 'chamate-settings' }
  )
);
