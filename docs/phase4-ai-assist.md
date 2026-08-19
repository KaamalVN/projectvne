# Phase 4 — AI-Assisted Editing

> Implemented per `projectvne-build-spec.md` §4. Built on top of Phases 0–3.5 (all
> preserved; the IR gained one additive field below). Everything the assistant can
> do goes through the existing command layer — there is no private IR mutation path.

## What was implemented

### 1. Provider abstraction (`src/ai/`)
- `AiAdapter.send(request) → AiResponse` is the single contract. Adapters included:
  - **Anthropic** Claude (tool-use blocks) — BYOK
  - **OpenAI** (function calling) — BYOK
  - **Google Gemini** (`generateContent` + functionDeclarations) — BYOK
  - **Ollama** (local, `{endpoint}/api/chat`, tools) — no key
  - **Mock (offline demo)** — deterministic responses so the full review workflow is
    usable with zero network access. Default provider for first-run exploration.
- Switching providers is a registry lookup (`getAdapter(providerId)`) — no code
  change or restart (verified by switching mock ↔ Ollama in the UI and seeing the
  panel/provider label update instantly).

### 2. Context + capabilities (`src/ai/service.ts`)
- `buildAiContext` assembles the model context from the IR: project title, scenes
  (id + title + block count, marking the current scene), characters, variables, and
  the **Problems-panel output** (via `ProblemsChecker`, filtered by scope). Scope is
  **Scene** or **Project**.
- System prompt is generated from that context and enforces the tool contract
  ("only exact IDs from context", "edits are tool calls, prose is for the author",
  "every edit is reviewed before applied").
- Capabilities map to the spec:
  - **Propose commands as diffs** — 8 mutation tools (`add_scene`, `delete_scene`,
    `add_dialogue_block`, `add_choice_block`, `add_show_character_block`,
    `create_character`, `create_variable`, `create_asset`) map to real
    `IRCommand` instances.
  - **Generate dialogue text** — `add_dialogue_block` carries the written line.
  - **Check continuity/reachability** — `check_continuity` tool + a one-click quick
    action; resolved locally with `ProblemsChecker`, same taxonomy/language as the
    Problems panel.
  - **Explain branch reachability in plain language** — `explain_branch` tool +
    quick action; resolved locally with `evaluateChoiceAvailability` /
    `findNeverSatisfiedConditions` / `buildDefaultVariableState`.

### 3. Review workflow — diff cards
- Every AI mutation becomes a **named, reviewable diff card** (title + human
  description, e.g. `Add dialogue to "Introduction" — Alex: "…"`).
- Per-card **Accept** / **Reject**, plus **Accept all** for multi-proposal batches.
- **Accepted** cards are applied through `CommandInvoker.execute` (validate →
  execute → undo stack), so they are undoable exactly like manual edits.
- **Rejected/ignored** cards are discarded; nothing is applied on panel close.
- An AI-proposed edit that fails validation (e.g. unknown scene id) is rejected by
  the **same error path as a manual invalid command** — `CommandInvoker.validate`
  returns the error, the card is marked `failed`, and the console logs it.

### 4. Keys & privacy
- API keys go through `src/ai/keychain.ts`: in the **Tauri shell** they are stored in
  the **OS keychain** via new Rust commands (`ai_get_secret` / `ai_set_secret` /
  `ai_delete_secret`, backed by the `keyring` crate — `cargo check` passes); in the
  plain web build they fall back to browser storage. Keys are **never written into
  the project IR/JSON**.
- **No network calls while idle.** Providers only fire on an explicit send.
  Verified by asserting zero resource entries for any provider host after enabling
  AI and idling.
- **Off by default, per-project opt-in.** The IR gained `ai: { enabled: boolean }`
  (default `false`). The toggle lives in Settings and in the AI panel itself.
  Disabling it removes every AI control (toolbar icon, AI tab, panel) from the UI.

### 5. UI surfaces
- **Dockable AI panel** — an `AI` tab in the right-sidebar tab row (right next to
  Problems and Debugger) plus a `Sparkles` toolbar icon; the sidebar widens while the
  panel is open. Same visual family as Inspector/Problems, not a separate window.
- **Shared settings surface** — one `AiSettings` component (provider, model, key,
  Ollama endpoint, per-project enable) is reused by **both** the AI panel's expanded
  settings and the general **Settings** modal. The general Settings modal (theme +
  AI section) is opened from a new gear icon in the top nav.

## IR & migration
- `SchemaVersion` `1 → 2`; `createEmptyProject()` now emits `ai: { enabled: false }`.
- `MigrationRunner` gained `migrateV1ToV2` (adds `ai` when missing, normalizes it),
  `CURRENT_SCHEMA_VERSION = 2`. v0 → v1 → v2 and v1 → v2 paths verified by the
  existing migration/integration test scripts.
- Status bar reports `IR v2` after opening a v1 demo project.

## Verification
- `pnpm build` (tsc + vite) — clean.
- `cargo check` (src-tauri, keyring added) — clean.
- `npx tsx src/migrations/test.migration.ts` and `src/integration.test.ts` — pass.
- `npx tsx verify-phase3.mts` — all Phase 3 invariants still hold.
- Playwright e2e over the production preview build (system Edge, Mock provider) —
  **18/18 checks pass**: IR v2 migration display; AI UI absent when disabled; opt-in
  default off and toggleable from Settings; toolbar icon + AI tab appear after
  opt-in; quick continuity + branch explain notes; named diff card with per-card
  Accept/Reject; accepted edit applied via command layer (+1 block); Accept all on a
  2-card batch (+2 blocks); undo through the normal undo stack; invalid proposal
  rejected via the same validation path (state unchanged); provider switch without
  restart; no provider network calls while idle; disabling removes all AI UI.

## Limitations / notes
- Real Anthropic/OpenAI/Google/Ollama adapters are implemented to their current
  tool-calling contracts but **could not be exercised end-to-end** in this sandbox
  (no outbound network). The full workflow was verified with the Mock provider;
  the real adapters should be smoke-tested once a network + key is available.
- Default provider is `mock` (offline demo) so the feature is explorable immediately;
  a user picks their real provider in Settings.
- Keys entered in the web build live in browser storage (Tauri keychain requires the
  desktop shell). Neither is ever embedded in the project file.
- The Rust side compiles (`cargo check`) but a full `tauri dev`/bundle run was not
  performed here.