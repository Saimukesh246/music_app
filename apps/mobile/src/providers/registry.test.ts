// ---------------------------------------------------------------------------
// Static mocks — declared before any imports so Jest hoists them
// ---------------------------------------------------------------------------

const mockAsyncStorage = {
  _store: {} as Record<string, string>,
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return mockAsyncStorage._store[key] ?? null;
  }),
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    mockAsyncStorage._store[key] = value;
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete mockAsyncStorage._store[key];
  }),
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock("expo-sqlite", () => ({}));
jest.mock("expo-file-system", () => ({}));
jest.mock("react-native-track-player", () => ({
  default: {},
  Event: {},
  State: {},
  RepeatMode: {},
}));
jest.mock("../library/database", () => ({
  openLibrary: jest.fn().mockResolvedValue({}),
}));
jest.mock("../library/localProvider", () => ({
  createLocalProvider: jest.fn().mockReturnValue({ id: "local" }),
}));
jest.mock("@aura/shared", () => ({
  InternetArchiveProvider: class {
    readonly id = "internet-archive";
  },
}));

// Now import the module under test (static mocks above apply)
import {
  getActiveProvider,
  setActiveProvider,
  getActiveProviderId,
  getRegisteredProviders,
  getProvider,
} from "./registry";

// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear the in-memory store between tests
  mockAsyncStorage._store = {};
  mockAsyncStorage.getItem.mockClear();
  mockAsyncStorage.setItem.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Provider registry", () => {
  it("getRegisteredProviders returns both local and internet-archive", () => {
    const entries = getRegisteredProviders();
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("local");
    expect(ids).toContain("internet-archive");
    expect(entries.length).toBe(2);
  });

  it("getProvider() delegates to getActiveProvider() (backwards compat)", async () => {
    const p1 = await getProvider();
    const p2 = await getActiveProvider();
    expect(p1.id).toBe(p2.id);
  });

  it("setActiveProvider stores the id so getActiveProviderId reflects it immediately", async () => {
    await setActiveProvider("internet-archive");
    expect(getActiveProviderId()).toBe("internet-archive");
    await setActiveProvider("local");
    expect(getActiveProviderId()).toBe("local");
  });

  it("setActiveProvider updates getActiveProviderId immediately", async () => {
    await setActiveProvider("internet-archive");
    expect(getActiveProviderId()).toBe("internet-archive");
  });

  it("getActiveProvider returns internet-archive after setActiveProvider", async () => {
    await setActiveProvider("internet-archive");
    const provider = await getActiveProvider();
    expect(provider.id).toBe("internet-archive");
  });

  it("getActiveProvider returns local after switching back", async () => {
    await setActiveProvider("internet-archive");
    await setActiveProvider("local");
    const provider = await getActiveProvider();
    expect(provider.id).toBe("local");
  });
});
