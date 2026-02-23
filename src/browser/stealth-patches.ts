import type { CDPSession } from "playwright-core";

export type StealthPatchOptions = {
  /** Patch navigator.webdriver, navigator.plugins, navigator.languages, chrome.runtime. Default: true */
  navigator?: boolean;
  /** Patch Permissions.query for notifications. Default: true */
  permissions?: boolean;
  /** Patch WebGL vendor/renderer to Intel HD. Default: false */
  webgl?: boolean;
};

/**
 * Build a JS script string that patches browser globals to reduce
 * automation fingerprinting surface. Designed for injection via
 * `Page.addScriptToEvaluateOnNewDocument`.
 */
export function buildStealthPatchScript(opts?: StealthPatchOptions): string {
  const navigator = opts?.navigator !== false;
  const permissions = opts?.permissions !== false;
  const webgl = opts?.webgl === true;

  const chunks: string[] = [];

  if (navigator) {
    // navigator.webdriver → undefined
    chunks.push(`
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true,
});`);

    // navigator.plugins — inject standard Chrome plugins if empty
    chunks.push(`
if (navigator.plugins.length === 0) {
  const pluginData = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
  ];
  const pluginArray = Object.create(PluginArray.prototype);
  const mimeArray = Object.create(MimeTypeArray.prototype);
  for (let i = 0; i < pluginData.length; i++) {
    const d = pluginData[i];
    const plugin = Object.create(Plugin.prototype, {
      name: { value: d.name, enumerable: true },
      filename: { value: d.filename, enumerable: true },
      description: { value: d.description, enumerable: true },
      length: { value: 0, enumerable: true },
    });
    Object.defineProperty(pluginArray, i, { value: plugin, enumerable: true });
  }
  Object.defineProperty(pluginArray, 'length', { value: pluginData.length, enumerable: true });
  Object.defineProperty(navigator, 'plugins', { get: () => pluginArray, configurable: true });
  Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeArray, configurable: true });
}`);

    // navigator.languages — ensure non-empty
    chunks.push(`
if (!navigator.languages || navigator.languages.length === 0) {
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true,
  });
}`);

    // window.chrome.runtime — ensure present
    chunks.push(`
if (!window.chrome) { window.chrome = {}; }
if (!window.chrome.runtime) { window.chrome.runtime = {}; }`);
  }

  if (permissions) {
    // Permissions.query — return 'prompt' for notifications (headless returns 'denied')
    chunks.push(`
{
  const originalQuery = window.Permissions.prototype.query;
  window.Permissions.prototype.query = function(descriptor) {
    if (descriptor && descriptor.name === 'notifications') {
      return Promise.resolve({ state: 'prompt', onchange: null });
    }
    return originalQuery.call(this, descriptor);
  };
}`);
  }

  if (webgl) {
    // WebGL vendor/renderer — override to common Intel HD values
    chunks.push(`
{
  const getParameterProto = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 0x9245) return 'Intel Inc.';          // UNMASKED_VENDOR_WEBGL
    if (param === 0x9246) return 'Intel HD Graphics';   // UNMASKED_RENDERER_WEBGL
    return getParameterProto.call(this, param);
  };
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const getParameter2Proto = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 0x9245) return 'Intel Inc.';
      if (param === 0x9246) return 'Intel HD Graphics';
      return getParameter2Proto.call(this, param);
    };
  }
}`);
  }

  return chunks.join("\n");
}

/**
 * Apply stealth patches to a page via its CDP session.
 * Injects the patch script via `Page.addScriptToEvaluateOnNewDocument` so it
 * runs before any other page scripts on every navigation.
 */
export async function applyStealthPatches(
  cdpSession: CDPSession,
  opts?: StealthPatchOptions,
): Promise<void> {
  const source = buildStealthPatchScript(opts);
  if (!source.trim()) {
    return;
  }
  await cdpSession.send("Page.addScriptToEvaluateOnNewDocument", { source });
}
