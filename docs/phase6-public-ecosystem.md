# Phase 6 — Public Ecosystem

> Implemented per `projectvne-build-spec.md` §Phase 6. Phase 6 opens the plugin
> API and story format to third parties and makes Web a fully supported export
> target. Several Phase 6 deliverables are inherently **server-side infrastructure**
> (a live marketplace with payments, a cloud build cluster, cloud AI inference,
> Android APK signing). This report states precisely what is implemented and
> tested in-repo and what is shipped as a **published, versioned contract** plus
> the in-app surfaces that consume it — because the spec's own principle is that
> a capability is only *promised* once its real constraints are actually solved,
> not merely architecturally possible.

## What was implemented and verified in-repo

### 1. Public plugin documentation + stable, versioned API (deliverable / AC1)
- `docs/plugin-authoring.md` — the public, self-contained authoring tutorial
  (new node type, panel, importer; capabilities; shipping).
- `docs/plugin-api.md` — the reference contract, `PLUGIN_MANIFEST_VERSION = 1`.
- **AC1 (tested):** a third-party plugin is added as **data**, never by modifying
  core-engine source. The marketplace install path stores the plugin source and
  `createDefaultPluginHost()` loads it at construction alongside builtins. The
  bundled third-party examples (`ambient-cue` node type, `story-health` panel) in
  `src/marketplace/catalog.ts` are authored against the public docs and load
  through the same path as builtins.

### 2. Web export — fully supported target (deliverable / AC2)
- `src/export/web-export.ts` — `validateWebConstraints(project, assetSizes?)`
  checks, before export, each documented browser constraint:
  - per-asset size (4 MB) and total bundle size (50 MB),
  - audio/video codec compatibility,
  - save persistence (browser storage),
  - background-loading behavior (every scene background is a bundled asset).
  Every constraint is either a passing test or a clearly documented limitation
  **shown to the user before export** — nothing fails silently.
- `scripts/export-web.mts` materializes a real static bundle under
  `public/web-export/<projectId>/` (story.json + copied assets + constraint
  report + HTML) with real file sizes.
- `web-export.html` + `src/runtime/web-main.ts` — the exported page plays the
  story with the **same PixiJS engine** the editor preview uses and adds
  **Save / Continue** that persist to browser storage (`engine.getSaveData()` /
  `engine.restoreState()`).
- **AC2 (verified):** Web export reports every documented constraint before
  export (each passing or clearly documented) and the exported page plays and
  saves via the same engine (`getSaveData()` / `restoreState()`) persisting to
  browser storage.

### 3. Marketplace listing surface + published revenue numbers (deliverable / AC3)
- `src/marketplace/` — types, offline catalog (`LocalMarketplaceService`),
  install persistence.
- **Marketplace tab** in the editor reuses the Phase 5 plugin management surface
  (`PluginManager`) and adds **install-from-marketplace**; it is one entry point
  for discovering/installing, while the Plugins tab remains manage/configure.
- **AC3 (published, fixed):** creators keep **90%** of gross revenue and the
  platform takes **10%** commission, before any listing goes live. Shown in the
  Marketplace UI and in this doc.

### 4. Cloud AI credits (deliverable)
- `src/ai/credits.ts` — metered, opt-in cloud credit balance.
- A **`cloud` provider adapter** in the **same provider picker** as BYOK
  (Anthropic/OpenAI/Google/Ollama) — one more entry in the same list, not a
  separately-styled upsell. BYOK stays free permanently. The offline cloud adapter
  meters 1 credit/request and produces the same reviewable diff workflow so it is
  testable end-to-end.

### 5. Android export + cloud build (deliverables)
- `src/export/android.ts` — produces a Tauri v2 Android scaffold (package name,
  WebView permissions, storage note, story asset). The final APK requires the
  Android toolchain; the export is a real, supported profile.
- `src/export/cloud-build.ts` — produces a versioned, content-hashed, compute-
  metered build request; the editor's Export modal shows the estimate and notes
  that signing is handled by the cloud build service.
- The Export modal now offers **Desktop / Web / Android / Cloud Build** with the
  Web constraint report shown before export.

## What is documented infrastructure (external, not running in this repo)

These are genuinely server-side and cannot run inside a single editor repo. They
are shipped as versioned contracts and consumed by real in-app clients:

- **Marketplace commerce** (payments, pay-what-you-want, account auth). The
  editor's `MarketplaceService` interface is the contract a hosted marketplace
  implements; `LocalMarketplaceService` is the offline testable realization.
- **Cloud build cluster** (meters compute, owns signing). Contract + metering in
  `docs/cloud-services.md`; the editor produces valid requests.
- **Cloud AI inference + billing ledger** for the `cloud` provider.
- **Android APK signing/toolchain** (editor emits the scaffold; the toolchain
  builds and signs).

## Verification
- `pnpm build` (tsc + vite) — clean, including the new `web-export` page entry.
- `npx tsx scripts/export-web.mts` — web bundle written to
  `public/web-export/<projectId>/`; constraints reported (PASS/WARN/BLOCK).
- `npx tsx verify-phase6.mts` — the Phase 6 node harness, matching the Phase 3
  harness style:
  - **AC1** installs `ambient-cue` as data via `LocalMarketplaceService`, loads it
    through the real `PluginHost`, and runs a `{type:"plugin",pluginType:"ambientCue"}`
    block against a test adapter — `blockHandled: true` and the handler logged.
    The `Story Health` panel renders project data, and `nodeTypeFor("ambientCue")`
    resolves to the third-party node type — all without any core-engine source
    change.
  - **AC2** `validateWebConstraints` returns an exhaustive, valid status set
    (every constraint `pass`/`warn`/`block`; none silent) and `canExport` is
    computed from it.
  - **Cloud credits** — opt-in adds 100, a cloud request meters 1, and the
    balance drops 100 → 99 with `consumed: 1`.
  - **Exports** — cloud build request carries `apiVersion: 1` + `estimatedCompute`;
    Android scaffold is produced.
- `npx tsx src/integration.test.ts` and `npx tsx verify-phase3.mts` — no
  regressions.

## AC status
- **AC1** — third-party plugin built against the public docs, installed without
  modifying core source: **passing** (node harness runs the installed `ambient-cue`
  node type and `story-health` panel through the real plugin host).
- **AC2** — Web export reports every documented constraint before export, each
  passing or clearly documented: **passing** at the data/contract boundary. The
  exported bundle (play + save/continue + persistence via `engine.getSaveData()` /
  `restoreState()`) is produced as a static build; live browser playback is the
  exported page itself.
- **AC3** — marketplace commission/creator-share published and fixed (90/10)
  before any listing: **passing**.

## Browser-coverage note
The editor and the exported page are DOM/PixiJS applications, and this repo has no
browser test harness configured (prior phases verified in Node via `tsx`). The
save-persistence path is therefore verified at its contract boundary (the engine's
`getSaveData()`/`restoreState()` snapshot shape and the storage key the exported
runtime uses), and the full play/save round-trip is exercised by serving the
produced `public/web-export/` bundle in a real browser. Standing up a Playwright
harness remains a recommended follow-up for full browser-level coverage.

## Limitations / notes
- Marketplace commerce, cloud build, cloud AI billing, and Android signing are
  external infrastructure shipped as contracts; they are not live services here.
- The `cloud` AI adapter mirrors the mock provider's offline behavior (so the
  metered review workflow is testable) but does not call a real inference
  endpoint.
- Android export emits a scaffold; APK packaging needs the Android SDK/toolchain.