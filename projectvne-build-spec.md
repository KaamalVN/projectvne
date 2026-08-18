# PROJECTVNE - Visual Novel Engine — Project Specification

## 1. Vision

A visual novel authoring tool where a person builds a complete branching story by arranging story concepts — scenes, characters, dialogue, choices, conditions — without needing to write or read code. The default surface is a storyboard of cards; an advanced flow-graph view sits underneath for readers who think in maps and branches; a scripting escape hatch exists for the small fraction of logic that genuinely needs it, but it is never required to finish a project.

**Product sentence:** *Make a visual novel by arranging a story, not by programming an engine.*

**Primary users, in priority order:**
1. Hobbyist writers who want to build a branching story without learning a scripting language.
2. Small teams who want to co-author a story visually.
3. Technical users who want visual speed for most of the work and a real code escape hatch for the rest.
4. Later: third-party plugin and asset developers extending the tool.

**North-star test:** a first-time user, given no documentation, can create a five-scene branching story, preview it, and export it in one sitting. If they ask "what is a node?" or "where do I connect this?", the product has failed at its core promise.

---

## 2. Product Principles

- **Story concepts over programming concepts.** Node and action labels read as "Show Alex — Happy — Right" or "If relationship with Alex is 5 or higher," never as "Image → Transform → Layer" or "Get variable → Compare → Branch."
- **Progressive complexity.** The beginner surface is intentionally small. Deeper controls exist and are reachable, but nothing forces a beginner into them.
- **The graph is a map, not a programming language.** It communicates story structure — which scenes lead where — not low-level data flow. A user should never have to manually wire together more than a handful of nodes to do something ordinary, like adding a choice.
- **One source of truth.** The editor reads and writes a single versioned story model. Nothing else (a generated script, a second file format, UI-only state) is allowed to become an alternate source of truth.
- **Fast feedback.** Any scene, branch, or change should be previewable in seconds, not through a full build/export cycle.
- **Small core, expandable shell.** Core covers the universal authoring loop. Everything else — scripting, plugins, marketplace, cloud services — is additive and built on top of a stable foundation, not load-bearing for the core loop.
- **Export is part of design, not an afterthought,** but a target is only *promised* to users once its real platform constraints (storage limits, asset size, codecs, signing) are actually solved, not merely architecturally possible.

---

## 3. Technical Foundation

### 3.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Desktop/mobile shell | **Tauri v2** (Rust core) | Desktop targets (Windows/macOS/Linux) are the primary, production target for the editor. Mobile targets exist in Tauri but are not an editor priority. |
| Editor UI | **React + TypeScript**, Tailwind for styling | No heavyweight component kit. Editor is desktop-first, built as a web frontend inside the Tauri shell. |
| Graph editor | **React Flow (`@xyflow/react`)** | Native React integration, MIT licensed, built-in support for auto-layout engines (Dagre/ELK), minimap, undo-friendly state model, and heavy custom-node styling — used specifically because the graph is one editing surface among several, not a generic dev-tool canvas, and needs to be fully reskinned to read as story cards rather than wired boxes. |
| Runtime (the actual game engine that plays a story) | **TypeScript + PixiJS v8** | WebGL rendering with automatic WebGPU upgrade path where available. Scoped to what a VN needs: sprites, text, layers, transitions, audio hooks — not a general 2D/3D engine. |
| Packaging | **Tauri**, wrapping the runtime | The runtime is a small web application; each platform target is the same runtime wrapped by Tauri (desktop) or run directly (a plain web build). One runtime, not N platform-specific reimplementations. |
| Project/story data format | **Versioned JSON** | Never a binary or proprietary format. Every serialized graph carries a `schemaVersion` field from day one. |
| Future scripting sandbox (architecture decided now, not exposed to users until Phase 3) | **QuickJS compiled to WebAssembly** | Isolation is enforced by WASM's linear memory model rather than JS-level proxy tricks — the right sandboxing approach for eventually running untrusted user/plugin script code. Do not use `vm2` under any circumstance; it has an established history of critical, repeatedly-recurring sandbox-escape vulnerabilities and is not an acceptable dependency for executing untrusted code. |
| License | **MIT** | Applies to the core engine and editor. Every third-party dependency's license must be confirmed compatible with permissive redistribution before it's added — this includes UI, rendering, and graph libraries specifically. |

### 3.2 Story Data Model

The story model (referred to below as the **IR**, intermediate representation) is the canonical project format. The editor, runtime, validator, and exporter all read and write this same structure. No other representation of the story is allowed to exist independently.

Conceptual shape:

```
Project
├─ meta (schemaVersion, id, title, created/modified timestamps)
├─ characters (id, name, portraits/expressions, default position)
├─ assets (id, type, tags, variants, file reference)
├─ variables ("story facts": number, boolean, text, relationship, inventory, counter — each with a stable id and a friendly display name)
├─ scenes
│   └─ each scene: id, title, background, ordered list of story blocks
│       block types: Dialogue | ShowCharacter | HideCharacter | Choice | Condition | SetVariable | PlayAudio | Transition | Comment
├─ flow (scene-to-scene transitions/branches — the project-level map)
├─ ui (theme, dialogue box style, choice presentation — minimal in early phases)
├─ localization (empty/deferred until relevant phase)
└─ exportProfiles (per-target build settings)
```

Requirements on the IR itself:
- Every object (scene, block, character, variable, asset) has a **stable id** that never changes when a display name changes.
- All references between objects (a choice pointing at a destination scene, a condition referencing a variable) are explicit id references, never name-based lookups.
- Serialization is deterministic — the same in-memory state always serializes to the same JSON — so the format is diff-friendly under version control.
- A migration runner ships as a core module before the first usable build, not retrofitted later. Every schema change is accompanied by a migration and a version bump.

### 3.3 The Command/Mutation System

All changes to the IR — whether initiated by the user through the UI, by an internal tool, or (in later phases) by a plugin or an AI integration — go through a single **command layer**, not direct object mutation. This is a foundational piece of the architecture and must exist from the first working build, because everything downstream depends on it:

- Every command is a structured, named operation with a defined payload (e.g. `addChoice(sceneId, prompt, destinationSceneIds)`, `setCharacterExpression(blockId, characterId, expression)`), not a raw state patch.
- Every command is invertible — the command layer is what powers undo/redo, not a generic state snapshot stack.
- Every command can be validated before it's applied, and a failed validation returns a human-readable reason.
- Every command is loggable, which is what later powers an audit trail for AI-proposed edits and plugin-proposed edits.

Building this properly early avoids a costly retrofit later — undo/redo, validation, plugin mutation, and any future AI integration all reuse this same layer rather than each inventing its own.

### 3.4 Node & Action Design Rule

This is the most important UX rule in the product and applies to every node, action, or control surfaced to a non-advanced user.

| Don't show this | Show this instead |
|---|---|
| Set-variable node → arithmetic node → compare node → branch node | "If relationship with Alex is 5 or higher" condition card |
| Image node → transform node → layer node | "Show Alex — Happy — Right side" character action |
| Audio-player node → mixer node → fade node | "Start evening music" action, with an optional fade toggle |
| Jump → label → call → return | "Go to scene: Festival" destination card |

Internally, these can compile to multiple lower-level operations. The user never needs to see the decomposition unless they explicitly opt into an advanced view.

Common actions must never require manual wiring of more than one thing. "Add Choice" creates the choice and its destination placeholders in one step. "Show Character" attaches the asset, position, and expression in one step, with sensible defaults, not a blank node the user must fill in from scratch.

### 3.5 Editing Surfaces

Two editing surfaces exist over the same IR, and neither is a second source of truth:

1. **Storyboard (default).** A linear, card-based view of a scene: background, character entrances, dialogue, choices, in reading order. No visible wires unless a scene actually branches.
2. **Flow graph (advanced).** A project-level map (scenes and their connections) and a per-scene graph view (for scenes with more complex branching than the storyboard reads well), built on React Flow, restyled so it never looks like a generic node-editor tool. Auto-layout is the default; manual arrangement is optional.

A plain-language "Problems" panel runs continuously in the background and surfaces issues in human language, with a fix action where possible — e.g. "This choice leads nowhere. Connect it to a scene," "Alex's happy portrait is missing. Choose another or locate the file," "This ending can never be reached because the required flag is never set."

### 3.6 Editor Shell: Startup, Navigation & Chrome

This subsection was missing from earlier revisions of this document. It is being added retroactively because Phases 0–3 shipped without a specified startup experience, and the app currently boots directly into the last-opened project's flow graph. That is not a design decision anyone made on purpose — it's what's left when nobody specified the shell around the editing surfaces. It is corrected in **Phase 3.5** below, but the standing rule lives here so every future phase is built against it.

**Startup / project launcher.** Launching the app (`pnpm tauri dev` or the packaged build) with no project open must show a launcher, not a canvas:
- Recent projects, each as a card with a thumbnail (auto-generated from the project's first scene's background), title, and last-modified time.
- "New Project" (name, folder, optional starter template — e.g. blank, one-scene demo) and "Open Project" (file browser).
- No IR is loaded, no engine/runtime is initialized, and no flow-graph or storyboard chrome (node library, inspector, console) is present at this screen. This is a distinct, lightweight view, the same way Figma, Unity Hub, and Unreal all separate "which project" from "editing a project."
- From inside a project, a clearly clickable app icon/logo (not just decorative) or a "Projects" menu item returns to the launcher without quitting the app.

**Default editing surface.** Per §3.5, the storyboard is the default surface and the flow graph is the advanced one. Opening a scene must open the storyboard card view first. The flow graph is reached by explicit navigation (a tab/toggle), never the landing view for a scene or project. The current build's "always boot into the graph" behavior is a spec violation, not a valid alternate interpretation — it inverts the beginner-first promise in §2.

**Global chrome rules (apply to every editing surface):**
- **One way to do one thing.** Where a sidebar/library already offers "add Dialogue" / "add Choice," the toolbar must not duplicate the same action with a second, differently-styled entry point. Pick the primary location for each action and remove the rest.
- **Debug-looking surfaces are opt-in, not default.** A raw timestamped log console (`INFO`, `Loaded:`, etc.) reads as a developer tool and contradicts the "story concepts, not programming concepts" principle for the primary user. The Console is collapsed by default on the storyboard surface; it can stay open by default only in the flow graph / advanced views, and its content should be human-readable ("Started scene: Introduction") rather than raw log-line formatting.
- **No redundant miniature views.** A canvas minimap and a separate live preview panel sitting adjacent to each other, both small and both showing a version of "the story so far," compete for attention and read as clutter. Preview (what the player sees) and minimap (where you are in the graph) serve different jobs and should be visually distinguished — different panel treatment, not two same-sized boxes side by side — or the minimap should collapse to an icon that expands on demand.
- **Every floating control needs a legible purpose.** Canvas-corner icon clusters (zoom in/out, fit-to-screen, lock) must have hover labels/tooltips at minimum; a padlock icon with no label is a support ticket waiting to happen. If a control's only user is power users, it can live in a collapsed "canvas settings" popover instead of being permanently on-canvas.
- **Naming stays consistent between the spec and the UI.** The plain-language "Problems panel" described in §3.5 and the "Issues" tab in the inspector must be the same feature with the same name in code, docs, and UI — not two names for one thing.
- **Empty states teach, not just state absence.** "— none selected —" / "Click a node to inspect it" is acceptable for the Inspector, but any first-run empty state (empty scene, empty project) should include a one-line action ("Add your first line of dialogue"), not just silence.

---

## 4. Explicit Non-Goals

To keep the product's core promise intact, the following are deliberately excluded from early phases and must not be pulled forward without a documented reason:

- No user-facing scripting surface (expression fields, Script Nodes) before Phase 3.
- No public plugin SDK or marketplace before Phase 5/6.
- No AI/MCP integration before Phase 4.
- No real-time multiplayer collaboration at any phase covered by this document.
- No general-purpose 3D or physics engine features.
- No custom-built rendering engine — PixiJS is the renderer for the lifetime of this specification.
- No promising Web, Android, or iOS as supported end-user export targets before their specific platform constraints (storage limits, asset size, audio/video codec behavior, signing) are validated — see Phase 4 and Phase 6.

---

## 5. Build Phases

Each phase has a goal, required deliverables, and acceptance criteria. A phase is complete only when its acceptance criteria pass, not merely when its deliverables are present.

### Phase 0 — Foundation & Runtime Spike

**Goal:** prove the core architectural bet (one runtime, wrapped per platform, driven by a JSON IR) before investing in editor UI.

**Deliverables:**
- Project scaffolding: Tauri v2 shell, React + TypeScript + Tailwind frontend, PixiJS-based runtime package, shared TypeScript types for the IR.
- A minimal, hand-written static JSON file representing a linear scene: one background, one character show/hide, one dialogue line, one choice branching to two hardcoded scenes.
- The runtime plays this file correctly as a plain web page and inside the Tauri desktop shell, from the same bundle.
- The command/mutation system (§3.3) scaffolded with at least `addScene`, `addDialogueBlock`, `addChoice`, each with undo/redo and basic validation.
- Migration runner scaffolded with `schemaVersion: 1` on the IR.

**Acceptance criteria:**
- The hardcoded scene runs identically (same visuals, same choice behavior) as a browser tab and inside the Tauri desktop shell, from the same bundle.
- Every command issued through the command layer can be undone and redone correctly.
- An invalid command (e.g. a choice pointing at a non-existent scene id) is rejected with a specific, readable error, not a silent failure or crash.

---

### Phase 1 — Core Authoring Loop

**Goal:** a non-technical person can build and export a small branching story without opening a text editor.

**Deliverables:**
- Storyboard (card) view for building scenes: add/edit dialogue, show/hide characters with expression and position, add choices, add simple variables (boolean/number/text) and conditions on choices.
- Character and asset management: import images/audio, assign roles (background, portrait, music, sfx), basic tagging.
- Save/load of the project as the versioned JSON IR, on disk, human-readable.
- Instant preview: "Play from here" on any scene, without a full export/build cycle.
- Problems panel with at least these checks live: unreachable/missing destination scene, missing asset reference, unreferenced variable in a condition.
- Windows export: a static, runnable build produced from the IR via the PixiJS runtime wrapped in Tauri.

**Explicitly out of scope for this phase:** flow graph view, Script Nodes, expression fields, localization, plugins, any export target besides Windows.

**Acceptance criteria:**
- A tester with no prior exposure to the tool can build a 5-scene story with at least one branching choice and one condition, entirely in the storyboard view, without external help.
- The same project can be closed and reopened with no data loss.
- The project exports to a working Windows build that plays identically to the in-editor preview.
- Deleting a scene that's referenced by an existing choice surfaces a Problems-panel warning rather than silently breaking the choice.

---

### Phase 2 — Visual Scripting Completeness

**Goal:** add the flow-graph view and the remaining core story-logic building blocks, without changing the underlying IR's source-of-truth status.

**Deliverables:**
- Project-level flow graph (scenes as cards, connections as branches/transitions) and per-scene graph view, both built on React Flow, both fully restyled to match the product's visual language (no default node-editor look).
- Auto-layout as the default arrangement; manual dragging supported but never required.
- Additional story-fact types beyond the Phase 1 basics: relationship, inventory, counter, tag/collection.
- Reusable scene blocks / sequences (a block of story content that can be referenced from multiple places without duplication).
- Deeper condition editor: sentence-like rule builder ("if [relationship] with [Alex] is [5 or higher]") supporting compound conditions.
- Debugger/state inspector: current variable values, why a given choice is or isn't currently available, branch-reachability explanation.

**Acceptance criteria:**
- The same 5-scene demo from Phase 1 can be fully rebuilt in the flow graph view and produces an identical exported build to the storyboard-built version.
- A story with a condition that can never be true (because the underlying flag is never set anywhere in the project) is flagged by the Problems panel with a specific explanation, not just "unreachable."
- A non-technical tester, shown the flow graph for the first time without instruction, can correctly explain what at least one branch in their own project does.

---

### Phase 3 — Scripting Escape Hatch

**Goal:** give advanced users a real code path for the small fraction of logic that visual tools can't reasonably express, without weakening the product's beginner-first promise.

**Deliverables:**
- QuickJS-in-WebAssembly sandbox wired into the runtime and editor (architecture chosen in Phase 0/§3.1; this phase is where it's actually exposed).
- Inline expression fields on eligible node properties (e.g. a condition field defaults to the visual rule builder from Phase 2, with an explicit toggle to drop into a raw expression).
- A first-class "Script Node" that runs arbitrary TypeScript/JavaScript against a typed, documented scene-state API (read variables, read story facts, trigger a small set of engine actions) — no filesystem or network access.
- A read-only, linked text/script view of a scene: shows the scene's content as readable text, with edits made in the storyboard/graph views reflected in the text view. This view is **not** a fully independent, bidirectionally-editable representation — the IR remains the single source of truth, and the text view is generated from it, in the same spirit as how existing community Ren'Py visual tools keep code canonical and treat the graph as a synchronized view over it, just inverted (IR canonical, text view generated).
- macOS and Linux export, added to the existing Windows export pipeline.

**Acceptance criteria:**
- A project built entirely without touching a Script Node or expression field behaves identically to one before this phase — the escape hatch is additive, never required.
- Script Node code cannot access the filesystem, network, or any API outside the documented scene-state surface; this is verified with an explicit test that attempts and fails at each of these.
- The same project exports correctly to Windows, macOS, and Linux from one project file, with no manual per-platform changes.

---

### Phase 3.5 — Stabilization Pass *(required checkpoint before Phase 4 starts)*

**Goal:** close the gap between what §2/§3.5 specify and what the Phase 0–3 build actually does, before adding AI editing on top of it. This is not new scope — it's fixing drift that happened because the shell around the editing surfaces (launcher, default-surface behavior, chrome) was never written down until §3.6. Nothing already-built about scene/story data, the command layer, or the IR changes here — this phase touches presentation and navigation only.

**Deliverables:**
- Project launcher screen per §3.6 (recent projects, new/open project), shown on app start with no project loaded.
- Storyboard set as the true default view for a scene; the flow graph becomes an explicit secondary tab, not the boot target.
- Chrome pass over the existing Scene Graph / Storyboard screens per the rules in §3.6: remove duplicate add-entry-points, collapse the console by default outside the flow graph, resolve the minimap/preview redundancy, label or collapse the floating canvas controls, and rename any UI text that doesn't match the spec's terms (e.g. "Issues" → "Problems," if that's the name that ships).
- A short internal UX pass note (even a one-page doc) recording what changed and why, so future AI-assisted phases don't quietly regress it again.

**Acceptance criteria:**
- A cold app launch with zero projects open shows the launcher, never a graph or storyboard canvas.
- Opening any scene lands on the storyboard by default across a fresh install; the flow graph requires one explicit click/tab to reach.
- No action in the reworked screens has two differently-styled entry points doing the same thing.
- A first-time tester (per the Phase 1 acceptance-test format) is not shown a raw log console before they've opened the flow graph or explicitly expanded it.

---

### Phase 4 — AI-Assisted Editing

**Goal:** add AI-assisted story editing that operates exclusively through the command/mutation system built in Phase 0, so every AI-proposed change is structured, reviewable, and undoable — never a raw text or file edit. This phase also defines, concretely, what "AI" means in this product: which providers, what surface, what it can see, and what it's never allowed to touch — because "AI-assisted editing" as a one-line goal is not implementable as written; it under-specifies the exact thing a prior phase (Phase 3, §3.1) already did carefully for the scripting sandbox.

**4.1 What "AI" concretely is here**

The reference point is the model-provider pattern used by IDE AI assistants (VS Code Copilot Chat, JetBrains AI Assistant): a chat surface backed by a swappable model provider, not a single hardcoded vendor call baked into a button.

- **Provider abstraction, not a hardcoded vendor.** The integration talks to models through one internal interface (`sendMessage(context, tools) → proposedCommands | text`), with adapters for: (a) hosted providers via **bring-your-own-API-key** — Anthropic, OpenAI, and Google are the three to support at launch, matching what every major IDE assistant currently supports as its BYOK baseline; (b) a local-model adapter (e.g. an Ollama-compatible endpoint) for users who don't want to send story text to a cloud API at all. No provider is hardcoded into the UI layer — adding a fourth provider later is an adapter, not a rearchitecture.
- **Where it lives in the UI.** A dockable **AI panel** (chat-style, same visual family as the Inspector/Problems panels — not a separate window), opened from a toolbar icon next to Problems/Debugger. It has: a model/provider picker at the top (mirrors the BYOK model-picker pattern — pick provider, paste key or point at a local endpoint, pick model), a scrollable message thread, and a text input. This is the concrete answer to "where is the chat window" — it is a panel, not a popup, and it is always scoped to the currently open project.
- **API keys** are stored via the OS keychain/credential store (the same mechanism Tauri already has access to on each desktop platform), never written into the project JSON — a story file must stay shareable without leaking someone's key.
- **Context the AI can see, explicitly:** the current scene's IR (or the whole project, if the user widens scope in the panel), character and variable names/descriptions, and the Problems-panel output. It does **not** get filesystem or network access itself — every action it takes is a proposed command through the Phase 0 layer, same boundary already enforced for Script Nodes in Phase 3.

**4.2 What it can do**

- Propose commands via the Phase 0 command layer (add/edit dialogue, add a choice, set a condition, etc.) — rendered as a reviewable diff, never applied silently.
- Generate dialogue text for a given character/context/tone, inserted as a proposed `addDialogueBlock`/`editDialogueBlock` command like anything else — text generation is not a special, unreviewed path.
- Check a scene or the whole project for continuity issues and unreachable branches, surfaced through the same Problems-panel language and severity levels already defined in §3.5, not a separate AI-only issue list.
- Explain in plain language why a given branch is or isn't reachable, as a conversational answer (no command involved — read-only questions don't need diff review).

**4.3 Review UX**

- Every proposed change appears as a named, expandable diff card in the AI panel (e.g. "Add choice: 'Apologize' → Scene: Reconciliation") with **Accept** / **Reject** per card and an **Accept all** for a batch, mirroring the reviewable-diff pattern already used for Script Node changes in Phase 3's text view.
- Accepted cards apply through the normal command layer, so they're undoable exactly like a manual edit — Ctrl+Z after accepting an AI change works identically to undoing a manual one.
- Rejected or ignored proposals are discarded; nothing is applied on chat-close or timeout.

**Deliverables:**
- Provider-abstracted AI integration surface (§4.1) with adapters for at least Anthropic, OpenAI, Google (BYOK), and one local-model adapter.
- Dockable AI panel with model/provider picker, chat thread, and diff-review cards (§4.2, §4.3).
- Capabilities: propose commands as a reviewable diff, generate dialogue text, check continuity/reachability against the existing Problems-panel taxonomy, explain branch reachability in plain language.
- AI features are off by default; enabling them is an explicit, visible, per-project opt-in (a project-level setting, not just an account-level one, since a project may be shared with people who don't want AI touching it).
- The underlying integration is built as a first-party module using the same command/mutation API any future plugin would use — it does not get a private or privileged path into the IR.
- Settings surface for provider/key management, reachable from both the AI panel's own picker and the app's general Settings, not two independently-maintained copies of the same list.

**Acceptance criteria:**
- Every AI-generated change is visible as a specific, named, reviewable operation before it's applied, and can be individually rejected.
- Disabling AI features removes all AI-related UI and network calls; no residual background behavior, including no calls from a "check continuity" background job.
- An AI-proposed edit that fails validation (e.g. references a non-existent character) is rejected the same way a manually-issued invalid command would be, with the same error path.
- Switching providers (e.g. Anthropic key → local Ollama model) requires no code change and no restart beyond re-opening the AI panel; both produce proposals through the identical diff-review UI.
- With AI features enabled but no request in flight, no network calls originate from the app (verified the same way Phase 3 verified the Script Node sandbox boundary).

---

### Phase 5 — Internal Plugin Architecture

**Goal:** prove the plugin model by using it internally, before exposing it publicly.

**Deliverables:**
- A versioned plugin manifest format and a capability-scoped permission model (filesystem access, network access, read/write access to specific parts of the IR — each explicit, none ambient). This reuses the same "explicit, scoped, reviewable" spirit already established for AI proposals in Phase 4 — a plugin's declared capabilities should be inspectable the same way an AI panel's provider/scope is.
- A plugin listing/management surface in the editor (even if internal-only at this phase): installed plugins, their declared capabilities, and an enable/disable toggle per plugin — the concrete home for the "disabling a plugin doesn't crash the editor" acceptance criterion below.
- The engine's own default behavior — dialogue rendering, choice handling, base sprite display — reimplemented as first-party plugins against this same API, so the "true" core is minimal and the team is using the exact API any future third party would get.
- Plugin code (first-party, for now) runs inside the QuickJS-WASM sandbox from Phase 3, communicating with the host only through the typed API surface it explicitly exposes.
- New node types, panels, and asset importers become addable through this API, demonstrated with at least one non-trivial first-party example of each.

**Explicitly not in this phase:** public plugin documentation, a marketplace, or any third-party plugin authoring.

**Acceptance criteria:**
- With the plugin API frozen for the duration of a test, an engineer unfamiliar with the plugin implementation (but given only the same docs a third party would eventually get) can add a new node type or asset importer without modifying core-engine source.
- Disabling any one first-party plugin (e.g. the base dialogue plugin) doesn't crash the editor — it results in a specific, clear "missing capability" state.

---

### Phase 6 — Public Ecosystem

**Goal:** open the plugin API and story format to third parties, and make the remaining export targets real, supported options rather than architecturally-possible ones.

**Deliverables:**
- Public plugin documentation and a stable, versioned plugin API (per the compatibility guarantees established internally in Phase 5).
- A marketplace supporting free, paid, and pay-what-you-want plugin and asset listings, with a creator-adjustable revenue share defaulting to at least 85% to the creator.
- Web export as a fully supported target: validated against real constraints — asset size limits, browser storage behavior for saves, audio/video codec compatibility, background-loading behavior — not just "the runtime happens to run in a browser."
- Android export.
- Cloud build service (meters compute; solves signing without owning every target platform's native toolchain).
- Optional, metered, opt-in cloud AI credits for the Phase 4 AI integration, with "bring your own key" remaining free permanently — the pricing/credit model sits alongside the provider picker from §4.1, as one more entry in the same list rather than a separately-styled upsell surface.
- A public-facing plugin/marketplace listing page reusing the internal plugin management surface built in Phase 5, extended with install-from-marketplace rather than rebuilt separately.

**Acceptance criteria:**
- A third-party developer, given only the public plugin documentation, can build and ship a working plugin (a new node type, asset importer, or panel) without any private support channel.
- A project exported to Web plays correctly across the documented constraint set (asset size, save persistence, audio/video playback) without silent failures — each constraint has either a passing test or a clearly documented limitation shown to the user before export.
- The marketplace commission and creator-share numbers are published and fixed before the first public plugin listing goes live.

---

## 6. Cross-Cutting Requirements (apply to every phase)

- **Every phase's exported build must match its in-editor preview exactly.** Divergence between preview and export is treated as a blocking bug, not a known limitation.
- **Every schema change to the IR ships with a migration and a version bump**, from Phase 0 onward. Retrofitting migrations after real projects exist is out of the question.
- **Every error surfaced to the user is in plain language with a specific cause**, never a raw exception, stack trace, or generic "something went wrong."
- **The command/mutation system is the only path to modifying the IR**, for the editor UI, the AI integration, and (later) plugins alike. No feature gets a private mutation path.
- **New chrome follows §3.6.** Any phase that adds a new panel, toolbar, or entry point (the AI panel in Phase 4, the plugin manager in Phase 5, the marketplace in Phase 6) is checked against §3.6's rules before it ships — one entry point per action, labeled controls, no redundant twin panels — the same way every phase is checked against its own acceptance criteria.
