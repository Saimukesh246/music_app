import { parseLrc } from "./lrc";

describe("parseLrc", () => {
  it("parses a single timestamp per line", () => {
    const lrc = "[00:12.34]First line\n[00:17.50]Second line";
    expect(parseLrc(lrc)).toEqual([
      { timeSec: 12.34, text: "First line" },
      { timeSec: 17.5, text: "Second line" },
    ]);
  });

  it("supports a colon as the fractional-second separator", () => {
    const lrc = "[00:12:34]Colon variant";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 12.34, text: "Colon variant" }]);
  });

  it("expands multiple timestamps on one line into separate entries", () => {
    const lrc = "[00:10.00][00:40.00]Repeated chorus";
    expect(parseLrc(lrc)).toEqual([
      { timeSec: 10, text: "Repeated chorus" },
      { timeSec: 40, text: "Repeated chorus" },
    ]);
  });

  it("ignores metadata tags that are not timestamps", () => {
    const lrc = "[ar:Some Artist]\n[ti:Some Title]\n[00:05.00]Actual lyric";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 5, text: "Actual lyric" }]);
  });

  it("handles minutes beyond 59 correctly", () => {
    const lrc = "[75:30.00]Long track line";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 75 * 60 + 30, text: "Long track line" }]);
  });

  it("returns lines sorted by time", () => {
    const lrc = "[00:30.00]Later\n[00:10.00]Earlier";
    expect(parseLrc(lrc).map((l) => l.text)).toEqual(["Earlier", "Later"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseLrc("")).toEqual([]);
  });

  it("returns an empty array when there are no timestamped lines", () => {
    expect(parseLrc("[ar:Artist]\n[ti:Title]")).toEqual([]);
  });
});
