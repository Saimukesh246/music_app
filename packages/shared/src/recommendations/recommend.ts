import type { AudioFeatures, Track } from "@aura/types";

function toVector(f: AudioFeatures): number[] {
  return [f.acousticness, f.danceability, f.energy, f.instrumentalness, f.valence, f.tempo / 250];
}

function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function centroid(vectors: number[][]): number[] {
  const dims = vectors[0].length;
  const sums = new Array(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i++) sums[i] += vector[i];
  }
  return sums.map((sum) => sum / vectors.length);
}

export function recommendTracks(candidates: Track[], seeds: Track[], count: number): Track[] {
  const seedVectors = seeds
    .filter((t): t is Track & { audioFeatures: AudioFeatures } => Boolean(t.audioFeatures))
    .map((t) => toVector(t.audioFeatures));
  if (seedVectors.length === 0) return [];

  const target = centroid(seedVectors);
  const seedIds = new Set(seeds.map((t) => t.id));

  return candidates
    .filter(
      (t): t is Track & { audioFeatures: AudioFeatures } =>
        Boolean(t.audioFeatures) && !seedIds.has(t.id)
    )
    .map((t) => ({ track: t, dist: distance(toVector(t.audioFeatures), target) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map((s) => s.track);
}
