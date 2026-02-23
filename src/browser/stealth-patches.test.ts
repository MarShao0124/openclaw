import { describe, expect, it } from "vitest";
import { buildStealthPatchScript } from "./stealth-patches.js";

describe("buildStealthPatchScript", () => {
  it("returns non-empty JS string with defaults", () => {
    const script = buildStealthPatchScript();
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(0);
  });

  it("includes navigator.webdriver patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).toContain("navigator");
    expect(script).toContain("webdriver");
    expect(script).toContain("Object.defineProperty");
  });

  it("includes navigator.plugins patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).toContain("PluginArray");
    expect(script).toContain("Chrome PDF Plugin");
  });

  it("includes navigator.languages patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).toContain("languages");
    expect(script).toContain("en-US");
  });

  it("includes chrome.runtime patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).toContain("chrome.runtime");
  });

  it("includes Permissions.query patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).toContain("Permissions.prototype.query");
    expect(script).toContain("notifications");
    expect(script).toContain("prompt");
  });

  it("omits navigator patches when navigator: false", () => {
    const script = buildStealthPatchScript({ navigator: false });
    expect(script).not.toContain("navigator.webdriver");
    expect(script).not.toContain("PluginArray");
    expect(script).not.toContain("chrome.runtime");
  });

  it("omits permissions patch when permissions: false", () => {
    const script = buildStealthPatchScript({ permissions: false });
    expect(script).not.toContain("Permissions.prototype.query");
  });

  it("omits WebGL patch by default", () => {
    const script = buildStealthPatchScript();
    expect(script).not.toContain("UNMASKED_VENDOR_WEBGL");
    expect(script).not.toContain("0x9245");
  });

  it("includes WebGL patch when webgl: true", () => {
    const script = buildStealthPatchScript({ webgl: true });
    expect(script).toContain("0x9245");
    expect(script).toContain("0x9246");
    expect(script).toContain("Intel Inc.");
    expect(script).toContain("Intel HD Graphics");
    expect(script).toContain("WebGLRenderingContext");
  });

  it("produces minimal output when all options are off", () => {
    const script = buildStealthPatchScript({
      navigator: false,
      permissions: false,
      webgl: false,
    });
    expect(script.trim()).toBe("");
  });
});
