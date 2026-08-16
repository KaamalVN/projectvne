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

### Phase 4 — AI-Assisted Editing

**Goal:** add AI-assisted story editing that operates exclusively through the command/mutation system built in Phase 0, so every AI-proposed change is structured, reviewable, and undoable — never a raw text or file edit.

**Deliverables:**
- An AI integration surface exposing: reading the current project/scene state, proposing a set of commands (via the Phase 0 command layer) as a reviewable diff, generating dialogue text for a given character/context/tone, checking a scene or project for continuity issues and unreachable branches, and explaining in plain language why a given branch is or isn't reachable.
- Every AI-proposed change renders in the editor as an explicit, accept/reject-per-change diff before being applied — never applied silently.
- AI features are off by default; enabling them is an explicit, visible, per-project opt-in.
- The underlying integration is built as a first-party module using the same command/mutation API any future plugin would use — it does not get a private or privileged path into the IR.

**Acceptance criteria:**
- Every AI-generated change is visible as a specific, named, reviewable operation (e.g. "Add choice: 'Apologize' → Scene: Reconciliation") before it's applied, and can be individually rejected.
- Disabling AI features removes all AI-related UI and network calls; no residual background behavior.
- An AI-proposed edit that fails validation (e.g. references a non-existent character) is rejected the same way a manually-issued invalid command would be, with the same error path.

---

### Phase 5 — Internal Plugin Architecture

**Goal:** prove the plugin model by using it internally, before exposing it publicly.

**Deliverables:**
- A versioned plugin manifest format and a capability-scoped permission model (filesystem access, network access, read/write access to specific parts of the IR — each explicit, none ambient).
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
- Optional, metered, opt-in cloud AI credits for the Phase 4 AI integration, with "bring your own key" remaining free permanently.

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
