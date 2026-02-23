/**
 * Humanized input simulation utilities.
 *
 * All functions are pure and accept an optional RNG for deterministic testing.
 */

export type TypingDelayOptions = {
  /** Base delay per character (ms). Default: 80 */
  baseDelayMs?: number;
  /** Random variance added to base (ms). Default: 120 */
  varianceMs?: number;
  /** Min chars between "thinking pauses". Default: 4 */
  pauseEveryMin?: number;
  /** Max chars between "thinking pauses". Default: 8 */
  pauseEveryMax?: number;
  /** Minimum thinking pause duration (ms). Default: 200 */
  pauseMinMs?: number;
  /** Maximum thinking pause duration (ms). Default: 400 */
  pauseMaxMs?: number;
};

/**
 * Generate a per-character delay array for typing simulation.
 *
 * Returns one delay value per character in `text`. Inserts longer
 * "thinking pauses" every 4-8 characters to simulate natural typing rhythm.
 */
export function generateTypingDelays(
  text: string,
  opts?: TypingDelayOptions,
  rng: () => number = Math.random,
): readonly number[] {
  const baseDelayMs = opts?.baseDelayMs ?? 80;
  const varianceMs = opts?.varianceMs ?? 120;
  const pauseEveryMin = opts?.pauseEveryMin ?? 4;
  const pauseEveryMax = opts?.pauseEveryMax ?? 8;
  const pauseMinMs = opts?.pauseMinMs ?? 200;
  const pauseMaxMs = opts?.pauseMaxMs ?? 400;

  const delays: number[] = [];
  let nextPauseAt = pauseEveryMin + Math.floor(rng() * (pauseEveryMax - pauseEveryMin + 1));

  for (let i = 0; i < text.length; i++) {
    let delay = baseDelayMs + rng() * varianceMs;

    if (i > 0 && i % nextPauseAt === 0) {
      delay += pauseMinMs + rng() * (pauseMaxMs - pauseMinMs);
      nextPauseAt = i + pauseEveryMin + Math.floor(rng() * (pauseEveryMax - pauseEveryMin + 1));
    }

    delays.push(Math.round(delay));
  }

  return delays;
}

export type MouseTrajectoryOptions = {
  /** Minimum number of intermediate steps. Default: 8 */
  stepsMin?: number;
  /** Maximum number of intermediate steps. Default: 16 */
  stepsMax?: number;
  /**
   * Target offset as fraction of element dimensions.
   * The click target is center ± offsetFraction * dimension.
   * Default: 0.3
   */
  offsetFraction?: number;
};

export type Point = { x: number; y: number };
export type BoundingRect = { cx: number; cy: number; width: number; height: number };
export type TrajectoryPoint = { x: number; y: number; delayMs: number };

/**
 * Generate a sequence of mouse move positions along a quadratic Bezier curve
 * with one random control point, simulating a natural mouse trajectory.
 *
 * `from` is the starting pixel coordinate.
 * `to` describes the target element's center and dimensions.
 *
 * Returns 8-16 intermediate points plus the final target point.
 */
export function generateMouseTrajectory(
  from: Point,
  to: BoundingRect,
  opts?: MouseTrajectoryOptions,
  rng: () => number = Math.random,
): readonly TrajectoryPoint[] {
  const stepsMin = opts?.stepsMin ?? 8;
  const stepsMax = opts?.stepsMax ?? 16;
  const offsetFraction = opts?.offsetFraction ?? 0.3;

  const steps = stepsMin + Math.floor(rng() * (stepsMax - stepsMin + 1));

  // Randomize click target within the element bounds
  const targetX = to.cx + (rng() - 0.5) * 2 * offsetFraction * to.width;
  const targetY = to.cy + (rng() - 0.5) * 2 * offsetFraction * to.height;

  // Random control point for the Bezier curve — offset perpendicular to the line
  const midX = (from.x + targetX) / 2;
  const midY = (from.y + targetY) / 2;
  const dx = targetX - from.x;
  const dy = targetY - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular offset scaled to distance
  const perpScale = (rng() - 0.5) * dist * 0.4;
  const controlX = midX + (-dy / dist) * perpScale;
  const controlY = midY + (dx / dist) * perpScale;

  const points: TrajectoryPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    // Quadratic Bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const x = invT * invT * from.x + 2 * invT * t * controlX + t * t * targetX;
    const y = invT * invT * from.y + 2 * invT * t * controlY + t * t * targetY;
    // Delay increases slightly toward the end (deceleration)
    const baseDelay = 8 + rng() * 12;
    const deceleration = t > 0.7 ? 1 + (t - 0.7) * 3 : 1;
    points.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      delayMs: Math.round(baseDelay * deceleration),
    });
  }

  return points;
}
