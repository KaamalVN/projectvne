// Phase 6 verification (node harness, matching verify-phase3.mts). Because the
// exported page and editor are DOM/PixiJS apps, the browser-only behaviors are
// verified at their data/contract boundaries here; the exported bundle itself is
// produced by scripts/export-web.mts and validated by validateWebConstraints.
import { readFileSync } from "node:fs";

// --- localStorage shim (modules read/write enablement + marketplace installs) ---
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

import { LocalMarketplaceService } from "./src/marketplace/service.ts";
import { createDefaultPluginHost } from "./src/plugins/registry.ts";
import type { PluginEngineAdapter } from "./src/plugins/types.ts";
import { validateWebConstraints } from "./src/export/web-export.ts";
import { prepareCloudBuildRequest } from "./src/export/cloud-build.ts";
import { prepareAndroidExport } from "./src/export/android.ts";
import { loadCredits, optIntoCloudCredits, COST_PER_CLOUD_REQUEST } from "./src/ai/credits.ts";
import { getAdapter } from "./src/ai/adapters.ts";

const project = JSON.parse(readFileSync(new URL("./public/stories/demo-story.json", import.meta.url), "utf8"));

// --- AC1: third-party plugin installed as DATA, runs via the real host ---
const service = new LocalMarketplaceService();
const install = await service.install("ambient-cue");
const host = createDefaultPluginHost();

const captured: string[] = [];
const fakeAdapter: PluginEngineAdapter = {
  showDialogue: () => {},
  presentChoices: () => {},
  showCharacter: () => {},
  hideCharacter: () => {},
  showFlashback: () => {},
  hideFlashback: () => {},
  getVariable: () => undefined,
  setVariable: () => {},
  getCharacterName: () => null,
  jumpToScene: () => {},
  runScript: () => ({ ok: true }),
  log: (m) => captured.push(m),
  advance: () => {},
};

const nodeType = host.nodeTypeFor("ambientCue");
const invoke = host.invoke(
  { type: "plugin", pluginType: "ambientCue", data: { action: "start", source: "assets/audio/forest.ogg" } },
  fakeAdapter,
);
const panel = host.getPanels().find((p) => p.def.title === "Story Health");
const storyHealthPanelSource = panel
  ? panel.def.view(project)
  : null;

// --- AC2: web constraint report is exhaustive and documented (no silent states) ---
const constraints = validateWebConstraints(project);
const statuses = constraints.map((c) => c.status);
const validStatuses = statuses.every((s) => ["pass", "warn", "block"].includes(s));
const noSilentBlock = constraints.length > 0;
const canExport = !constraints.some((c) => c.status === "block");

// --- Cloud credits metering + cloud adapter ---
const cloudAdapter = getAdapter("cloud");
const before = loadCredits();
optIntoCloudCredits(100);
const optedIn = loadCredits();
const cloudRes = await cloudAdapter.send({
  messages: [{ role: "user", content: "draft a line" }],
  context: { project, sceneId: "scene-intro", characters: [], variables: [], conditions: [] },
  toolChoice: "auto",
  providerId: "cloud",
  model: "cloud-v1",
});
const afterSpend = loadCredits();

// --- Cloud build + Android request shape ---
const buildReq = prepareCloudBuildRequest(project, "android");
const android = prepareAndroidExport(project, "Demo Story");

console.log(JSON.stringify({
  ac1: {
    installed: install.ok,
    pluginId: install.pluginId,
    nodeTypeRegistered: Boolean(nodeType),
    thirdPartyNodeType: nodeType?.def.title,
    blockHandled: invoke.handled,
    handlerLog: captured,
    storyHealthPanelText: storyHealthPanelSource?.text,
  },
  ac2: {
    constraintStatuses: statuses,
    allStatusesValid: validStatuses,
    constraintsReported: noSilentBlock,
    canExport,
  },
  cloudCredits: {
    costPerRequest: COST_PER_CLOUD_REQUEST,
    balanceBefore: before.balance,
    optedIn: optedIn.optedIn,
    balanceAfterOptIn: optedIn.balance,
    cloudRequestAccepted: cloudRes.toolCalls.length > 0,
    balanceAfterRequest: afterSpend.balance,
    consumed: afterSpend.consumed,
  },
  exports: {
    cloudRequestHasVersionedContract: buildReq.ok && buildReq.request?.apiVersion === 1 && typeof buildReq.request?.estimatedCompute === "number",
    androidScaffold: android.ok,
    androidTargets: android.ok ? android.scaffold?.targets : undefined,
  },
}, null, 2));