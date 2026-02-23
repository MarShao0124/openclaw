/**
 * Cloudflare challenge detection utilities.
 *
 * Detection-only — no auto-solving. Provides heuristics to identify
 * whether a page is showing a Cloudflare challenge/block and a wait
 * helper that polls until the challenge auto-resolves or times out.
 */

import type { Page } from "playwright-core";

export type CfChallengeKind =
  | "js-challenge"
  | "managed-challenge"
  | "interactive"
  | "blocked"
  | "none";

export type CfChallengeResult = {
  kind: CfChallengeKind;
  indicators: readonly string[];
};

export type CfDetectionState = {
  title: string;
  selectors: {
    challengeRunning: boolean;
    challengeStage: boolean;
    cfTurnstile: boolean;
    cfChallengeIframe: boolean;
    cfBlockPage: boolean;
  };
};

/**
 * Detect the type of Cloudflare challenge from page state.
 *
 * This is a pure function that takes pre-queried page state
 * so it can be tested without a real browser.
 */
export function detectCfChallenge(state: CfDetectionState): CfChallengeResult {
  const indicators: string[] = [];
  const title = state.title.toLowerCase();
  const s = state.selectors;

  // Blocked page
  if (s.cfBlockPage || title.includes("access denied") || title.includes("attention required")) {
    if (s.cfBlockPage) {
      indicators.push("#cf-error-details present");
    }
    if (title.includes("access denied")) {
      indicators.push('title contains "Access denied"');
    }
    if (title.includes("attention required")) {
      indicators.push('title contains "Attention Required"');
    }
    return { kind: "blocked", indicators };
  }

  // JS challenge (automatic, non-interactive)
  const isChallengeTitle =
    title.includes("just a moment") || title.includes("checking your browser");
  if (isChallengeTitle && (s.challengeRunning || s.challengeStage)) {
    if (isChallengeTitle) {
      indicators.push('title matches "Just a moment"');
    }
    if (s.challengeRunning) {
      indicators.push("#challenge-running present");
    }
    if (s.challengeStage) {
      indicators.push("#challenge-stage present");
    }
    return { kind: "js-challenge", indicators };
  }

  // Managed/Turnstile challenge (may require interaction)
  if (s.cfTurnstile || s.cfChallengeIframe) {
    if (s.cfTurnstile) {
      indicators.push(".cf-turnstile present");
    }
    if (s.cfChallengeIframe) {
      indicators.push('iframe[src*="challenges.cloudflare.com"] present');
    }

    // If the title also matches, it's likely auto-solving; otherwise interactive
    if (isChallengeTitle) {
      indicators.push('title matches "Just a moment"');
      return { kind: "managed-challenge", indicators };
    }
    return { kind: "interactive", indicators };
  }

  // Title match alone (fallback for partial loading states)
  if (isChallengeTitle) {
    indicators.push('title matches "Just a moment"');
    return { kind: "js-challenge", indicators };
  }

  return { kind: "none", indicators: [] };
}

/**
 * Query the current page state for Cloudflare challenge indicators.
 */
async function queryPageCfState(page: Page): Promise<CfDetectionState> {
  const title = await page.title().catch(() => "");
  const selectors = await page
    .evaluate(() => ({
      challengeRunning: !!document.querySelector("#challenge-running"),
      challengeStage: !!document.querySelector("#challenge-stage"),
      cfTurnstile: !!document.querySelector(".cf-turnstile"),
      cfChallengeIframe: !!document.querySelector('iframe[src*="challenges.cloudflare.com"]'),
      cfBlockPage: !!document.querySelector("#cf-error-details"),
    }))
    .catch(() => ({
      challengeRunning: false,
      challengeStage: false,
      cfTurnstile: false,
      cfChallengeIframe: false,
      cfBlockPage: false,
    }));

  return { title, selectors };
}

/**
 * Wait for a Cloudflare challenge to resolve.
 *
 * Polls every `pollIntervalMs` (default 1s) until:
 * - The challenge disappears → returns "resolved"
 * - An interactive challenge is detected → returns "interactive" immediately
 * - Timeout is reached → returns "timeout"
 */
export async function waitForCfChallenge(
  page: Page,
  opts?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  },
): Promise<"resolved" | "timeout" | "interactive"> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const pollIntervalMs = opts?.pollIntervalMs ?? 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await queryPageCfState(page);
    const result = detectCfChallenge(state);

    if (result.kind === "none") {
      return "resolved";
    }
    if (result.kind === "interactive") {
      return "interactive";
    }
    if (result.kind === "blocked") {
      return "timeout";
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    await new Promise((r) => setTimeout(r, Math.min(pollIntervalMs, remaining)));
  }

  return "timeout";
}
