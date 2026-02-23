import { describe, expect, it } from "vitest";
import { generateMouseTrajectory, generateTypingDelays } from "./humanize.js";

/** Simple seeded PRNG (Mulberry32) for deterministic tests. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateTypingDelays", () => {
  it("returns one delay per character", () => {
    const delays = generateTypingDelays("hello", undefined, mulberry32(42));
    expect(delays).toHaveLength(5);
  });

  it("returns empty array for empty string", () => {
    expect(generateTypingDelays("")).toHaveLength(0);
  });

  it("all delays are >= baseDelayMs", () => {
    const baseDelayMs = 80;
    const delays = generateTypingDelays("testing delays", { baseDelayMs }, mulberry32(1));
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(baseDelayMs);
    }
  });

  it("delays have variance (not all identical)", () => {
    const delays = generateTypingDelays(
      "a quick brown fox jumps over the lazy dog",
      undefined,
      mulberry32(99),
    );
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("includes thinking pauses (some delays significantly larger)", () => {
    const text = "hello world, this is a longer text to type";
    const delays = generateTypingDelays(text, undefined, mulberry32(7));
    const baseMax = 80 + 120; // baseDelayMs + varianceMs
    const pauses = delays.filter((d) => d > baseMax);
    expect(pauses.length).toBeGreaterThan(0);
  });

  it("is deterministic with the same RNG seed", () => {
    const a = generateTypingDelays("test", undefined, mulberry32(42));
    const b = generateTypingDelays("test", undefined, mulberry32(42));
    expect(a).toEqual(b);
  });

  it("respects custom options", () => {
    const delays = generateTypingDelays("hi", { baseDelayMs: 200, varianceMs: 0 }, mulberry32(1));
    // With 0 variance, delays should be exactly baseDelayMs (plus potential pause)
    expect(delays[0]).toBeGreaterThanOrEqual(200);
  });
});

describe("generateMouseTrajectory", () => {
  const from = { x: 100, y: 100 };
  const to = { cx: 500, cy: 300, width: 100, height: 40 };

  it("returns between stepsMin and stepsMax points", () => {
    const points = generateMouseTrajectory(from, to, undefined, mulberry32(42));
    expect(points.length).toBeGreaterThanOrEqual(8);
    expect(points.length).toBeLessThanOrEqual(16);
  });

  it("last point is near the target center", () => {
    const points = generateMouseTrajectory(from, to, undefined, mulberry32(42));
    const last = points[points.length - 1];
    // Should be within the element bounds (+30% offset)
    expect(last.x).toBeGreaterThan(to.cx - to.width);
    expect(last.x).toBeLessThan(to.cx + to.width);
    expect(last.y).toBeGreaterThan(to.cy - to.height);
    expect(last.y).toBeLessThan(to.cy + to.height);
  });

  it("all points have finite coordinates", () => {
    const points = generateMouseTrajectory(from, to, undefined, mulberry32(7));
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.delayMs)).toBe(true);
    }
  });

  it("all delays are positive", () => {
    const points = generateMouseTrajectory(from, to, undefined, mulberry32(7));
    for (const p of points) {
      expect(p.delayMs).toBeGreaterThan(0);
    }
  });

  it("is deterministic with the same RNG seed", () => {
    const a = generateMouseTrajectory(from, to, undefined, mulberry32(42));
    const b = generateMouseTrajectory(from, to, undefined, mulberry32(42));
    expect(a).toEqual(b);
  });

  it("respects custom step count", () => {
    const points = generateMouseTrajectory(from, to, { stepsMin: 3, stepsMax: 3 }, mulberry32(42));
    expect(points).toHaveLength(3);
  });

  it("handles same from/to position without NaN", () => {
    const samePoint = { x: 300, y: 200 };
    const sameTo = { cx: 300, cy: 200, width: 10, height: 10 };
    const points = generateMouseTrajectory(samePoint, sameTo, undefined, mulberry32(1));
    for (const p of points) {
      expect(Number.isNaN(p.x)).toBe(false);
      expect(Number.isNaN(p.y)).toBe(false);
    }
  });
});
