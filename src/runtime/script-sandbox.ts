export interface ScriptSandboxApi {
  getVariable: (id: string) => unknown;
  setVariable: (id: string, value: unknown) => void;
  log: (message: string) => void;
  jumpToScene: (sceneId: string) => void;
}

export interface ScriptSandboxResult {
  logs: string[];
  jumpToSceneId?: string;
}

const BLOCKED_GLOBALS = [
  "window",
  "document",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
  "process",
  "require",
];

export class RuntimeScriptSandbox {
  static run(code: string, api: ScriptSandboxApi): ScriptSandboxResult {
    const logs: string[] = [];
    let jumpToSceneId: string | undefined;

    const wrappedApi: ScriptSandboxApi = {
      getVariable: api.getVariable,
      setVariable: api.setVariable,
      log: (message) => {
        logs.push(message);
        api.log(message);
      },
      jumpToScene: (sceneId) => {
        jumpToSceneId = sceneId;
        api.jumpToScene(sceneId);
      },
    };

    const prelude = BLOCKED_GLOBALS.map((name) => `const ${name} = undefined;`).join("\n");
    const runner = new Function(
      "api",
      `"use strict"; ${prelude}\nconst globalThis = undefined;\nreturn (function () { ${code}\n})();`,
    );

    runner(wrappedApi);
    return { logs, jumpToSceneId };
  }
}
