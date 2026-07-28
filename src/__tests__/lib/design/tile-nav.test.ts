import { nextTile, type NavRect } from "@/lib/design/tile-nav";

//  ┌──────┬──────┐
//  │  A   │  B   │
//  ├──────┼──────┤
//  │  C   │  D   │
//  └──────┴──────┘
const grid: NavRect[] = [
  { ticker: "A", x: 0, y: 0, w: 100, h: 100 },
  { ticker: "B", x: 100, y: 0, w: 100, h: 100 },
  { ticker: "C", x: 0, y: 100, w: 100, h: 100 },
  { ticker: "D", x: 100, y: 100, w: 100, h: 100 },
];

describe("nextTile", () => {
  it.each([
    ["A", "ArrowRight", "B"],
    ["B", "ArrowLeft", "A"],
    ["A", "ArrowDown", "C"],
    ["C", "ArrowUp", "A"],
    ["D", "ArrowLeft", "C"],
    ["B", "ArrowDown", "D"],
  ])("from %s, %s goes to %s", (from, key, expected) => {
    expect(nextTile(grid, from, key)).toBe(expected);
  });

  it("stays put at an edge rather than wrapping", () => {
    expect(nextTile(grid, "A", "ArrowLeft")).toBe("A");
    expect(nextTile(grid, "D", "ArrowDown")).toBe("D");
  });

  it("picks the nearest candidate when tiles are misaligned", () => {
    // Both candidates sit one row down, so `along` ties and the perpendicular
    // offset decides. FAR is placed far enough right that its centre is
    // unambiguously further from BIG's than NEAR's is — with the two only
    // ~5px apart the winner would be an accident of the fixture, not a
    // statement about the ranking rule.
    const ragged: NavRect[] = [
      { ticker: "BIG", x: 0, y: 0, w: 200, h: 100 },
      { ticker: "NEAR", x: 60, y: 100, w: 40, h: 60 },
      { ticker: "FAR", x: 400, y: 100, w: 50, h: 60 },
    ];
    expect(nextTile(ragged, "BIG", "ArrowDown")).toBe("NEAR");
  });

  it("ignores keys it does not handle", () => {
    expect(nextTile(grid, "A", "Tab")).toBeNull();
  });

  it("returns null when the current tile is unknown", () => {
    expect(nextTile(grid, "ZZZ", "ArrowRight")).toBeNull();
  });
});
