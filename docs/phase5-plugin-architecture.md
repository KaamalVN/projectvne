# Phase 5 — Internal Plugin Architecture

> Implemented per `projectvne-build-spec.md` §Phase 5. Built on top of Phases
> 0–4. The IR gained one additive block type and the schema bumped to 3; Phase 4
> AI behavior is untouched and re-verified below.

## Design decision

Plugin code runs in a **sandboxed `new Function`** behind a swappable
`PluginSandbox` interface (QuickJS-WASM is a documented Phase-6 hardening item).
Capabilities are declared up front and enforced by the host — nothing ambient.
This choice kept the runtime dependency-free and let the whole architecture be
verified end-to-end in this sandbox.

## What was implemented

### 1. Plugin core (`src/plugins/`)
- `types.ts` — manifest (v1), capability model (`ir.read`/`ir.write` scoped,
  `engine`, `network`/`filesystem` declared-not-exposed), `NodeViewModel` (the
  only shape plugins may render), context, adapter, registration, invoke result.
- `sandbox.ts` — `PluginSandbox.run(source, { register })` with the Phase-3
  blocked globals plus `File`, `FileReader`, `Blob`, `URL`, `alert`, `confirm`,
  `prompt`.
- `plugin-state.ts` — per-plugin enablement in `localStorage`
  (`projectvne.plugins.disabled`; empty = all enabled). The initial empty-list
  semantics bug was caught by the smoke test and fixed by inverting to a
  **disabled-list**.
- `registry.ts` — `PluginHost`: loads source plugins, captures registration,
  indexes handlers/nodeTypes/panels/importers keyed by block type, enforces the
  capability gate, `invoke(block, adapter)`, `getUnavailableBlockTypes`,
  `getMissingCapabilities(project)`, `runImporter`, `createDefaultPluginHost`.

### 2. First-party plugins (`src/plugins/builtin/`)
Eight built-ins: `dialogue`, `characters`, `choices`, `variables`, `script`,
`flashback` (node type), `world-lore` (panel), `json-manifest` (asset importer).
`dialogue` declares `ir.read: characters` because its handler resolves the
speaker via `getCharacterName` — this requirement was missed initially, caught by
the smoke test, and fixed.

### 3. IR & migration
- `PluginBlock { type: "plugin"; pluginType; label?; pluginId?; data }` added to
  the `StoryBlock` union (extends `IRObject`, not `BaseBlock`, so narrowing on
  core blocks still works).
- `SchemaVersion 2 → 3`; `createEmptyProject()` emits v3; `migrateV2ToV3` bumps
  the version. The demo project (v1) migrates to v3 on open (status bar: `IR v3`).
- `AddPluginBlockCommand` — new IR command; plugin blocks are undoable like any
  other edit.

### 4. Engine (`src/runtime/engine.ts`)
- `PixiVisualNovelEngine implements PluginEngineAdapter`; constructor takes an
  optional `pluginHost` (defaults to the builtin host, so `runtime/main.ts` and
  the exporter are unchanged).
- Dispatch is type-based: core `block.type` or `pluginType` for plugin blocks.
- Capability gate runs in the context wrapper: an undeclared call throws
  `MissingCapabilityError`, which becomes `onPluginMissing` + a Problems warning —
  never a crash.
- New `onPluginMissing` and `onFlashback` engine events drive console logging.
- Flashback and missing-capability states render as PIXI overlays.

### 5. Editor surfaces (`src/App.tsx`, components)
- **Plugins tab** (`plugins-tab`) — `PluginManager`: installed list with
  capability chips and enable/disable toggles, **Missing Capabilities** list, and
  **Plugin Panels**.
- **Node Library → Plugins** — flashback appears; adding it opens a generic
  Add-Plugin-Node modal (string/number/boolean + textarea fields) and creates an
  undoable `PluginBlock`.
- **Storyboard** — plugin cards render via `toViewModel`; a disabled plugin shows
  an amber "Missing capability" card inline.
- **Inspector** — selecting a plugin block shows its view model.
- **Import Asset modal** — "Import via plugin" rows feed the file to
  `runImporter` and apply drafts via `CreateAssetCommand` (undoable, logged).
- Right-sidebar tab row is now scrollable (`overflow-x-auto`) to fit 7 tabs.

## Verification

- `pnpm build` (tsc + vite) — clean.
- `npx tsx src/integration.test.ts` — v0 → v1 → v2 → v3 migration + commands + undo pass.
- `npx tsx verify-phase3.mts` — Phase 3 invariants still hold.
- **Plugin smoke test (18/18)**: builtin registration, enablement default,
  dialogue handler dispatch + wait-for-input + text delivery, flashback handler +
  node type, world-lore panel, json-manifest importer (success + bad-JSON error),
  rogue plugin blocked by the capability gate, disabled plugin → named missing
  capability, unavailable block types surfaced.
- **Playwright e2e over the production preview (20/20)**: IR v3 on open; 8
  installed plugins; world-lore panel note; create scene + add flashback node;
  storyboard render; **engine plays the flashback** (console log); inspector view
  model; json-manifest import of 3 assets; disable dialogue → Plugins tab +
  Problems panel flag it, engine logs `onPluginMissing`, editor stays usable, no
  page errors; re-enable clears the state; Phase 4 AI regression (tab hidden when
  off, appears + panel works when on, hides again when off).

## Limitations / notes
- Network and filesystem capabilities are declared-but-not-exposed; builtins avoid
  network entirely (the browser page has no outbound network in this sandbox).
- `PluginSandbox` uses `new Function`; swapping to QuickJS-WASM is deferred to
  Phase 6 and is covered by `docs/plugin-api.md`.
- Only the flashback node type ships as a plugin node (base block types remain
  core), so there is no duplicate-UI risk in the Node Library.
- The Rust side is unchanged this phase (`cargo check` remained clean from
  Phase 4).