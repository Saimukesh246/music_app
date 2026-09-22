import type { FetchLike } from "./musicbrainz";

export async function getFrontCoverUrl(
  fetchFn: FetchLike,
  releaseMbid: string
): Promise<string | null> {
  const url = `https://coverartarchive.org/release/${releaseMbid}/front`;

  let response;
  try {
    response = await fetchFn(url, { headers: { Accept: "image/*" } });
  } catch {
    return null;
  }

  return response.ok ? url : null;
}
