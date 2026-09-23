jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: jest.fn(async (key: string): Promise<string | null> => {
      return store[key] ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string): Promise<void> => {
      delete store[key];
    }),
    clear: jest.fn(async (): Promise<void> => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
  return {
    __esModule: true,
    default: mockStorage,
    ...mockStorage,
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEqualizerStore, EQ_PRESETS } from "./equalizerStore";

beforeEach(async () => {
  await AsyncStorage.clear();
  useEqualizerStore.setState({
    bands: [0, 0, 0, 0, 0],
    selectedPreset: "Flat",
    bitPerfect: false,
  });
});

describe("useEqualizerStore", () => {
  it("initializes with Flat preset and all 0 dB bands", () => {
    const { bands, selectedPreset, bitPerfect } = useEqualizerStore.getState();
    expect(bands).toEqual([0, 0, 0, 0, 0]);
    expect(selectedPreset).toBe("Flat");
    expect(bitPerfect).toBe(false);
  });

  it("applies Bass Boost preset correctly", () => {
    useEqualizerStore.getState().setPreset("Bass Boost");
    const { bands, selectedPreset } = useEqualizerStore.getState();
    expect(bands).toEqual(EQ_PRESETS["Bass Boost"]);
    expect(selectedPreset).toBe("Bass Boost");
  });

  it("clamps band gain between -12 and +12 and switches to Custom", () => {
    useEqualizerStore.getState().setBand(0, 20); // Above +12
    expect(useEqualizerStore.getState().bands[0]).toBe(12);
    expect(useEqualizerStore.getState().selectedPreset).toBe("Custom");

    useEqualizerStore.getState().setBand(1, -25); // Below -12
    expect(useEqualizerStore.getState().bands[1]).toBe(-12);
  });

  it("toggles Bit-Perfect mode", () => {
    useEqualizerStore.getState().setBitPerfect(true);
    expect(useEqualizerStore.getState().bitPerfect).toBe(true);

    useEqualizerStore.getState().setBitPerfect(false);
    expect(useEqualizerStore.getState().bitPerfect).toBe(false);
  });

  it("resets EQ to Flat 0 dB", () => {
    useEqualizerStore.getState().setPreset("Rock");
    expect(useEqualizerStore.getState().selectedPreset).toBe("Rock");

    useEqualizerStore.getState().resetEq();
    const { bands, selectedPreset } = useEqualizerStore.getState();
    expect(bands).toEqual([0, 0, 0, 0, 0]);
    expect(selectedPreset).toBe("Flat");
  });

  it("hydrates from AsyncStorage", async () => {
    await AsyncStorage.setItem(
      "@aura_eq_settings",
      JSON.stringify({
        bands: [3, 2, 1, 0, -1],
        selectedPreset: "Custom",
        bitPerfect: true,
      })
    );

    await useEqualizerStore.getState().hydrateEqualizer();
    const { bands, selectedPreset, bitPerfect } = useEqualizerStore.getState();
    expect(bands).toEqual([3, 2, 1, 0, -1]);
    expect(selectedPreset).toBe("Custom");
    expect(bitPerfect).toBe(true);
  });
});
