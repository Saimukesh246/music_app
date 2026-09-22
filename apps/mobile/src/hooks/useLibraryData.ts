import { useCallback, useEffect, useState } from "react";
import type { Album, Track } from "@aura/types";
import { getLibraryDb } from "../providers";
import { useLibraryVersionStore } from "../store/libraryVersionStore";

export function useLibraryData() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const version = useLibraryVersionStore((s) => s.version);

  const reload = useCallback(() => {
    setLoading(true);
    void getLibraryDb()
      .then(async (db) => {
        const [nextTracks, nextAlbums] = await Promise.all([
          db.getAllTracks(),
          db.getAlbums(),
        ]);
        setTracks(nextTracks);
        setAlbums(nextAlbums);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload, version]);

  return { tracks, albums, loading, reload };
}
