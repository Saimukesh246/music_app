import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type EqBand = 0 | 1 | 2 | 3 | 4;

export const EQ_FREQUENCIES = [
  { band: 0, label: "60 Hz", sublabel: "Sub-Bass" },
  { band: 1, label: "230 Hz", sublabel: "Bass" },
  { band: 2, label: "910 Hz", sublabel: "Mids" },
  { band: 3, label: "3.6 kHz", sublabel: "Presence" },
  { band: 4, label: "14 kHz", sublabel: "Air" },
] as const;

export type PresetName =
  | "Flat"
  | "Bass Boost"
  | "Vocal Clarity"
  | "Treble Boost"
  | "Acoustic"
  | "Electronic"
  | "Rock"
  | "Custom";

export const EQ_PRESETS: Record<Exclude<PresetName, "Custom">, [number, number, number, number, number]> = {
  Flat: [0, 0, 0, 0, 0],
  "Bass Boost": [5, 3, 0, 0, -1],
  "Vocal Clarity": [-2, 1, 4, 3, 1],
  "Treble Boost": [-1, 0, 1, 4, 6],
  Acoustic: [2, 1, 0, 2, 3],
  Electronic: [5, 2, -1, 2, 4],
  Rock: [4, 2, -2, 3, 4],
};

const STORAGE_KEY = "@aura_eq_settings";

interface EqualizerState {
  bands: [number, number, number, number, number];
  selectedPreset: PresetName;
  bitPerfect: boolean;
  setBand: (bandIndex: EqBand, gainDb: number) => void;
  setPreset: (preset: PresetName) => void;
  setBitPerfect: (enabled: boolean) => void;
  resetEq: () => void;
  hydrateEqualizer: () => Promise<void>;
}

function clampGain(val: number): number {
  return Math.max(-12, Math.min(12, Math.round(val)));
}

export const useEqualizerStore = create<EqualizerState>((set, get) => ({
  bands: [0, 0, 0, 0, 0],
  selectedPreset: "Flat",
  bitPerfect: false,

  hydrateEqualizer: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.bands) && parsed.bands.length === 5) {
          set({
            bands: parsed.bands.map(clampGain) as [number, number, number, number, number],
            selectedPreset: parsed.selectedPreset || "Custom",
            bitPerfect: Boolean(parsed.bitPerfect),
          });
        }
      }
    } catch {
      // Ignored
    }
  },

  setBand: (bandIndex: EqBand, gainDb: number) => {
    const clamped = clampGain(gainDb);
    const nextBands = [...get().bands] as [number, number, number, number, number];
    nextBands[bandIndex] = clamped;

    set({ bands: nextBands, selectedPreset: "Custom" });

    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bands: nextBands,
        selectedPreset: "Custom",
        bitPerfect: get().bitPerfect,
      })
    ).catch(() => undefined);
  },

  setPreset: (preset: PresetName) => {
    if (preset === "Custom") {
      set({ selectedPreset: "Custom" });
      return;
    }

    const presetGains = EQ_PRESETS[preset];
    if (!presetGains) return;

    const nextBands = [...presetGains] as [number, number, number, number, number];
    set({ bands: nextBands, selectedPreset: preset });

    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bands: nextBands,
        selectedPreset: preset,
        bitPerfect: get().bitPerfect,
      })
    ).catch(() => undefined);
  },

  setBitPerfect: (enabled: boolean) => {
    set({ bitPerfect: enabled });
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bands: get().bands,
        selectedPreset: get().selectedPreset,
        bitPerfect: enabled,
      })
    ).catch(() => undefined);
  },

  resetEq: () => {
    const flat: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    set({ bands: flat, selectedPreset: "Flat" });
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bands: flat,
        selectedPreset: "Flat",
        bitPerfect: get().bitPerfect,
      })
    ).catch(() => undefined);
  },
}));
