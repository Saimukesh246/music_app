import { ensureColumn } from "./database";

interface FakeDb {
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
}

function fakeDb(existingColumns: string[]): FakeDb {
  return {
    getAllAsync: jest.fn().mockResolvedValue(existingColumns.map((name) => ({ name }))),
    execAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe("ensureColumn", () => {
  it("adds the column when it is missing", async () => {
    const db = fakeDb(["id", "title"]);
    await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
    expect(db.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE albums ADD COLUMN musicbrainz_id TEXT"
    );
  });

  it("does nothing when the column already exists", async () => {
    const db = fakeDb(["id", "title", "musicbrainz_id"]);
    await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
    expect(db.execAsync).not.toHaveBeenCalled();
  });
});
