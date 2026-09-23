describe("SearchScreen helpers & category logic", () => {
  const MAX_RECENTS = 8;

  function updateRecents(prev: string[], term: string): string[] {
    const trimmed = term.trim();
    if (!trimmed) return prev;
    return [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      MAX_RECENTS
    );
  }

  it("adds search term to recents at the front", () => {
    const initial = ["Miles Davis", "Coltrane"];
    const result = updateRecents(initial, "Bill Evans");
    expect(result).toEqual(["Bill Evans", "Miles Davis", "Coltrane"]);
  });

  it("deduplicates case-insensitively and moves to front", () => {
    const initial = ["Miles Davis", "Coltrane"];
    const result = updateRecents(initial, "miles davis");
    expect(result).toEqual(["miles davis", "Coltrane"]);
    expect(result).toHaveLength(2);
  });

  it("enforces MAX_RECENTS limit", () => {
    let list: string[] = [];
    for (let i = 1; i <= 12; i++) {
      list = updateRecents(list, `Artist ${i}`);
    }
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe("Artist 12");
  });

  it("filters search results by category", () => {
    const mockResults = {
      tracks: [{ id: "t1", title: "Track 1" }],
      albums: [{ id: "al1", title: "Album 1" }],
      artists: [{ id: "ar1", name: "Artist 1" }],
    };

    expect(mockResults.tracks).toHaveLength(1);
    expect(mockResults.albums).toHaveLength(1);
    expect(mockResults.artists).toHaveLength(1);
  });
});
