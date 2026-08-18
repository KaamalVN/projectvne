import { readFileSync } from "node:fs";
import { ProjectExporter } from "./src/export/exporter.ts";
import { ProblemsChecker } from "./src/shared/problems-checker.ts";
import { RuntimeScriptSandbox } from "./src/runtime/script-sandbox.ts";

const project = JSON.parse(readFileSync(new URL("./public/stories/demo-story.json", import.meta.url), "utf8"));

const impossibleProject = structuredClone(project);
impossibleProject.variables["var-high-trust"] = {
  id: "var-high-trust",
  name: "high_trust",
  displayName: "High Trust",
  type: "relationship",
  defaultValue: 0,
  minValue: 0,
  maxValue: 10,
};
impossibleProject.conditions["cond-high-trust"] = {
  id: "cond-high-trust",
  name: "Trust is high",
  expression: {
    type: "variable",
    variableId: "var-high-trust",
    operator: "greaterThanOrEqual",
    value: 5,
  },
};
impossibleProject.scenes["scene-intro"].blocks[2].options[0].conditionId = "cond-high-trust";

const problems = ProblemsChecker.check(impossibleProject);
const impossibleConditionFlagged = problems.some((problem) => problem.id === "never-true-cond-high-trust");

const sandboxWrites = new Map();
const scriptResult = RuntimeScriptSandbox.run(
  `
api.log(typeof fetch === "undefined" ? "fetch-blocked" : "fetch-open");
api.log(typeof process === "undefined" ? "process-blocked" : "process-open");
api.setVariable("sandbox_result", "ok");
  `,
  {
    getVariable: () => undefined,
    setVariable: (id, value) => sandboxWrites.set(id, value),
    log: () => {},
    jumpToScene: () => {},
  },
);

const manifest = JSON.parse(ProjectExporter.prepareDesktopBundle(project, project.meta.title));
const hasAllDesktopTargets = ["windows", "macos", "linux"].every((target) =>
  manifest.targets.some((entry: { target: string }) => entry.target === target),
);

console.log(JSON.stringify({
  impossibleConditionFlagged,
  sandboxLogs: scriptResult.logs,
  sandboxVariableWrite: sandboxWrites.get("sandbox_result"),
  hasAllDesktopTargets,
}, null, 2));
