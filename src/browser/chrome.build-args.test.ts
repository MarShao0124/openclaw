import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChromeArgs } from "./chrome.js";

// Suppress log.warn calls from stealth warnings
vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("buildChromeArgs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const base = {
    cdpPort: 9222,
    userDataDir: "/tmp/test-profile",
    headless: false,
    noSandbox: false,
    stealth: true,
    platform: "darwin" as NodeJS.Platform,
    extraArgs: [] as readonly string[],
  };

  it("includes base Chrome flags", () => {
    const args = buildChromeArgs(base);
    expect(args).toContain("--remote-debugging-port=9222");
    expect(args).toContain("--user-data-dir=/tmp/test-profile");
    expect(args).toContain("--no-first-run");
    expect(args).toContain("--no-default-browser-check");
    expect(args).toContain("--disable-sync");
    expect(args).toContain("--password-store=basic");
    expect(args).toContain("--disable-blink-features=AutomationControlled");
    expect(args[args.length - 1]).toBe("about:blank");
  });

  it("includes stealth flags when stealth is enabled", () => {
    const args = buildChromeArgs(base);
    expect(args).toContain("--disable-infobars");
    expect(args).toContain("--disable-default-apps");
    expect(args).toContain("--disable-component-extensions-with-background-pages");
    expect(args).toContain("--enable-features=NetworkService,NetworkServiceInProcess");
    expect(args).toContain("--window-size=1920,1080");
  });

  it("omits stealth-specific flags when stealth is disabled", () => {
    const args = buildChromeArgs({ ...base, stealth: false });
    expect(args).not.toContain("--disable-infobars");
    expect(args).not.toContain("--disable-default-apps");
    expect(args).not.toContain("--disable-component-extensions-with-background-pages");
    expect(args).not.toContain("--enable-features=NetworkService,NetworkServiceInProcess");
    expect(args).not.toContain("--window-size=1920,1080");
    // Should still have the non-stealth automation flag
    expect(args).toContain("--disable-blink-features=AutomationControlled");
  });

  it("skips default --window-size when user provides one via extraArgs", () => {
    const args = buildChromeArgs({
      ...base,
      extraArgs: ["--window-size=1280,720"],
    });
    expect(args).not.toContain("--window-size=1920,1080");
    expect(args).toContain("--window-size=1280,720");
  });

  it("adds headless flags", () => {
    const args = buildChromeArgs({ ...base, headless: true });
    expect(args).toContain("--headless=new");
    expect(args).toContain("--disable-gpu");
  });

  it("adds noSandbox flags", () => {
    const args = buildChromeArgs({ ...base, noSandbox: true });
    expect(args).toContain("--no-sandbox");
    expect(args).toContain("--disable-setuid-sandbox");
  });

  it("adds Linux-specific flags", () => {
    const args = buildChromeArgs({ ...base, platform: "linux" });
    expect(args).toContain("--disable-dev-shm-usage");
  });

  it("does not add Linux flags on macOS", () => {
    const args = buildChromeArgs({ ...base, platform: "darwin" });
    expect(args).not.toContain("--disable-dev-shm-usage");
  });

  it("appends extraArgs after stealth flags", () => {
    const args = buildChromeArgs({
      ...base,
      extraArgs: ["--user-agent=Custom"],
    });
    expect(args).toContain("--user-agent=Custom");
    // extraArgs should appear before "about:blank"
    const uaIndex = args.indexOf("--user-agent=Custom");
    const blankIndex = args.indexOf("about:blank");
    expect(uaIndex).toBeLessThan(blankIndex);
  });
});
