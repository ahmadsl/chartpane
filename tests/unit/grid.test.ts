import { describe, it, expect } from "vitest";
import { calculateColumns } from "../../shared/grid.js";

describe("calculateColumns", () => {
  it("returns 1 for a single chart", () => {
    expect(calculateColumns(1)).toBe(1);
  });

  it("returns 2 for 2 charts", () => {
    expect(calculateColumns(2)).toBe(2);
  });

  it("returns 2 for 3 charts", () => {
    expect(calculateColumns(3)).toBe(2);
  });

  it("returns 2 for 4 charts", () => {
    expect(calculateColumns(4)).toBe(2);
  });

  it("returns 3 for 5 charts", () => {
    expect(calculateColumns(5)).toBe(3);
  });

  it("returns 3 for 6 charts", () => {
    expect(calculateColumns(6)).toBe(3);
  });

  it("returns 3 for 10 charts", () => {
    expect(calculateColumns(10)).toBe(3);
  });

  it("uses explicit override when provided", () => {
    expect(calculateColumns(6, 1)).toBe(1);
    expect(calculateColumns(2, 4)).toBe(4);
    expect(calculateColumns(10, 2)).toBe(2);
  });
});
