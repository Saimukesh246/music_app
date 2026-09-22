import * as FileSystem from "expo-file-system";
import { searchRelease, getFrontCoverUrl, createThrottle } from "@aura/shared";
import type { LibraryDb } from "../library/database";

export interface EnrichmentResult {
  enriched: number;
  skipped: number;
}

const throttled = createThrottle(1000);

async function cacheArtwork(url: string, releaseMbid: string): Promise<string | undefined> {
  try {
    const dir = `${FileSystem.cacheDirectory}artwork/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const dest = `${dir}${releaseMbid}.jpg`;
    const result = await FileSystem.downloadAsync(url, dest);
    return result.status === 200 ? result.uri : undefined;
  } catch {
    return undefined;
  }
}

export async function enrichLibrary(db: LibraryDb): Promise<EnrichmentResult> {
  const pending = await db.getAlbumsPendingEnrichment();
  let enriched = 0;
  let skipped = 0;

  for (const album of pending) {
    try {
      const match = await throttled(() => searchRelease(fetch, album.artistName, album.title));
      if (!match) {
        skipped += 1;
        continue;
      }

      let artworkUrl: string | undefined;
      const coverUrl = await throttled(() => getFrontCoverUrl(fetch, match.releaseMbid));
      if (coverUrl) {
        artworkUrl = await cacheArtwork(coverUrl, match.releaseMbid);
      }

      await db.setAlbumEnrichment(album.id, {
        musicbrainzId: match.releaseMbid,
        releaseDate: match.releaseDate,
        artworkUrl,
      });
      await db.setArtistMusicBrainzId(album.artistId, match.artistMbid);
      enriched += 1;
    } catch {
      skipped += 1;
    }
  }

  return { enriched, skipped };
}
