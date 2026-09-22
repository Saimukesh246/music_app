import type { MusicProvider } from "@aura/shared";
import { openLibrary, type LibraryDb } from "../library/database";
import { createLocalProvider } from "../library/localProvider";

let dbPromise: Promise<LibraryDb> | null = null;
let providerPromise: Promise<MusicProvider> | null = null;

export function getLibraryDb(): Promise<LibraryDb> {
  if (!dbPromise) dbPromise = openLibrary();
  return dbPromise;
}

export function getProvider(): Promise<MusicProvider> {
  if (!providerPromise) {
    providerPromise = getLibraryDb().then(createLocalProvider);
  }
  return providerPromise;
}
