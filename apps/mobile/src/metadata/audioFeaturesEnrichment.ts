import { searchTrack, getAudioFeatures, createThrottle } from "@aura/shared";
import type { LibraryDb } from "../library/database";

export interface AudioFeaturesEnrichmentResult {
  enriched: number;
  skipped: number;
}

const throttled = createThrottle(1000);

export async function enrichAudioFeatures(db: LibraryDb): Promise<AudioFeaturesEnrichmentResult> {
  const pending = await db.getTracksPendingAudioFeatures();
  let enriched = 0;
  let skipped = 0;

  for (const track of pending) {
    try {
      const reccobeatsId = await throttled(() =>
        searchTrack(fetch, track.title, track.artistName)
      );
      if (!reccobeatsId) {
        skipped += 1;
        continue;
      }

      const features = await throttled(() => getAudioFeatures(fetch, [reccobeatsId]));
      const trackFeatures = features.get(reccobeatsId);
      if (!trackFeatures) {
        skipped += 1;
        continue;
      }

      await db.setTrackAudioFeatures(track.id, { reccobeatsId, ...trackFeatures });
      enriched += 1;
    } catch {
      skipped += 1;
    }
  }

  return { enriched, skipped };
}
