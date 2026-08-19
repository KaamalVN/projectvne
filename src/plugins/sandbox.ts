// Plugin sandbox. First-party plugin code is evaluated here, the same way the
// Phase 3 Script Node sandbox evaluates story scripts: a `new Function` whose
// scope has ambient capabilities blocked. This is the swappable boundary a
// QuickJS-WASM host (Phase 6 hardening) can substitute behind.
import type { PluginRegistration } from './types';

const BLOCKED_GLOBALS = [
  'window',
  'document',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'process',
  'require',
  'File',
  'FileReader',
  'Blob',
  'URL',
  'alert',
  'confirm',
  'prompt',
];

export interface PluginSandboxApi {
  register: (registration: PluginRegistration) => void;
}

export class PluginSandbox {
  static run(source: string, api: PluginSandboxApi): void {
    const prelude = BLOCKED_GLOBALS.map((name) => `const ${name} = undefined;`).join('\n');
    const runner = new Function(
      'api',
      `"use strict"; ${prelude}\nconst globalThis = undefined;\n(function () { ${source}\n})();`,
    );
    runner(api);
  }
}