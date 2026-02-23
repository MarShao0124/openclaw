import { describe, expect, it } from "vitest";
import { type CfDetectionState, detectCfChallenge } from "./cf-challenge.js";

function makeState(
  overrides: {
    title?: string;
    selectors?: Partial<CfDetectionState["selectors"]>;
  } = {},
): CfDetectionState {
  return {
    title: overrides.title ?? "",
    selectors: {
      challengeRunning: false,
      challengeStage: false,
      cfTurnstile: false,
      cfChallengeIframe: false,
      cfBlockPage: false,
      ...overrides.selectors,
    },
  };
}

describe("detectCfChallenge", () => {
  it('returns "none" for a normal page', () => {
    const result = detectCfChallenge(makeState({ title: "Example Domain" }));
    expect(result.kind).toBe("none");
    expect(result.indicators).toHaveLength(0);
  });

  it('detects "js-challenge" with "Just a moment" title + #challenge-running', () => {
    const result = detectCfChallenge(
      makeState({
        title: "Just a moment...",
        selectors: { challengeRunning: true },
      }),
    );
    expect(result.kind).toBe("js-challenge");
    expect(result.indicators.length).toBeGreaterThan(0);
    expect(result.indicators.some((i) => i.includes("Just a moment"))).toBe(true);
    expect(result.indicators.some((i) => i.includes("#challenge-running"))).toBe(true);
  });

  it('detects "js-challenge" with #challenge-stage', () => {
    const result = detectCfChallenge(
      makeState({
        title: "Just a moment...",
        selectors: { challengeStage: true },
      }),
    );
    expect(result.kind).toBe("js-challenge");
  });

  it('detects "js-challenge" with title alone', () => {
    const result = detectCfChallenge(
      makeState({ title: "Checking your browser before accessing" }),
    );
    expect(result.kind).toBe("js-challenge");
  });

  it('detects "managed-challenge" with Turnstile + challenge title', () => {
    const result = detectCfChallenge(
      makeState({
        title: "Just a moment...",
        selectors: { cfTurnstile: true },
      }),
    );
    expect(result.kind).toBe("managed-challenge");
    expect(result.indicators.some((i) => i.includes(".cf-turnstile"))).toBe(true);
  });

  it('detects "managed-challenge" with challenge iframe + title', () => {
    const result = detectCfChallenge(
      makeState({
        title: "Just a moment...",
        selectors: { cfChallengeIframe: true },
      }),
    );
    expect(result.kind).toBe("managed-challenge");
  });

  it('detects "interactive" with Turnstile but no challenge title', () => {
    const result = detectCfChallenge(
      makeState({
        title: "My Website",
        selectors: { cfTurnstile: true },
      }),
    );
    expect(result.kind).toBe("interactive");
  });

  it('detects "blocked" with #cf-error-details', () => {
    const result = detectCfChallenge(
      makeState({
        title: "Access denied",
        selectors: { cfBlockPage: true },
      }),
    );
    expect(result.kind).toBe("blocked");
    expect(result.indicators.some((i) => i.includes("#cf-error-details"))).toBe(true);
  });

  it('detects "blocked" with "Access denied" title', () => {
    const result = detectCfChallenge(makeState({ title: "Access denied | example.com" }));
    expect(result.kind).toBe("blocked");
  });

  it('detects "blocked" with "Attention Required" title', () => {
    const result = detectCfChallenge(makeState({ title: "Attention Required! | Cloudflare" }));
    expect(result.kind).toBe("blocked");
  });

  it("blocked takes priority over js-challenge selectors", () => {
    const result = detectCfChallenge(
      makeState({
        title: "Access denied",
        selectors: { cfBlockPage: true, challengeRunning: true },
      }),
    );
    expect(result.kind).toBe("blocked");
  });
});
