export interface LyricLine {
  timeSec: number;
  text: string;
}

const TIMESTAMP = /\[(\d+):(\d+)[.:](\d+)\]/g;

export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const rawLine of text.split("\n")) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP)];
    if (timestamps.length === 0) continue;

    const lineText = rawLine.replace(TIMESTAMP, "").trim();

    for (const match of timestamps) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = parseInt(match[3], 10);
      const timeSec = minutes * 60 + seconds + fraction / 100;
      lines.push({ timeSec, text: lineText });
    }
  }

  return lines.sort((a, b) => a.timeSec - b.timeSec);
}
