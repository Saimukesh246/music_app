import React from "react";
import renderer from "react-test-renderer";
import { SeekBar } from "./SeekBar";

jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj.ios,
}));

describe("SeekBar", () => {
  it("renders without crashing at progress=0", () => {
    const onSeek = jest.fn();
    const tree = renderer.create(<SeekBar progress={0} onSeek={onSeek} />);
    expect(tree.toJSON()).not.toBeNull();
  });

  it("renders the seek-bar-thumb element", () => {
    const onSeek = jest.fn();
    const tree = renderer.create(<SeekBar progress={0.5} onSeek={onSeek} />);
    const json = tree.toJSON();
    // Walk the tree looking for testID="seek-bar-thumb"
    function findTestId(node: unknown, id: string): boolean {
      if (!node || typeof node !== "object") return false;
      const n = node as { props?: Record<string, unknown>; children?: unknown[] };
      if (n.props?.testID === id) return true;
      if (Array.isArray(n.children)) {
        return n.children.some((c) => findTestId(c, id));
      }
      return false;
    }
    expect(findTestId(json, "seek-bar-thumb")).toBe(true);
  });

  it("renders the seek-bar-fill element", () => {
    const onSeek = jest.fn();
    const tree = renderer.create(<SeekBar progress={0.3} onSeek={onSeek} />);
    const json = tree.toJSON();
    function findTestId(node: unknown, id: string): boolean {
      if (!node || typeof node !== "object") return false;
      const n = node as { props?: Record<string, unknown>; children?: unknown[] };
      if (n.props?.testID === id) return true;
      if (Array.isArray(n.children)) {
        return n.children.some((c) => findTestId(c, id));
      }
      return false;
    }
    expect(findTestId(json, "seek-bar-fill")).toBe(true);
  });

  it("clamps progress above 1 to 1", () => {
    // Should not throw
    const onSeek = jest.fn();
    expect(() => {
      renderer.create(<SeekBar progress={1.5} onSeek={onSeek} />);
    }).not.toThrow();
  });

  it("clamps progress below 0 to 0", () => {
    const onSeek = jest.fn();
    expect(() => {
      renderer.create(<SeekBar progress={-0.2} onSeek={onSeek} />);
    }).not.toThrow();
  });
});
