# Phase 3.5 — UI / Navigation / Presentation Stabilization Pass

> Scope guard: this pass is strictly UI, navigation, and presentation. The IR, the
> command/mutation system, the runtime, the QuickJS sandbox, and all completed
> Phase 0–3 functionality are intentionally untouched. Every change below is
> reversible and does not alter how a story serializes, executes, or exports.

## Why this pass exists

§3.6 (Editor Shell) was written retroactively because Phases 0–3 shipped without a
specified startup/navigation shell. The result was drift: the app booted straight
into a flow graph and several chrome rules from §3.6 were unmet. Phase 3.5 closes
that gap before Phase 4 (AI editing) builds on top of it.

## What was already done before this pass

- **Launcher screen** already existed and is shown on cold start (no IR loaded, no
  engine initialized until a project is opened).
- **Storyboard as default surface**: `openProject` already sets the view mode to
  `storyboard`.

## Changes made in this pass

### 1. Default/primary surface tab ordering (§3.6 Global chrome)
The top-nav surface switcher now leads with **Storyboard**, followed by the two
advanced flow-graph surfaces (**Scene Graph**, **Project Flow**) and **Script**.
Previously the first tab was the flow graph, which inverted the beginner-first
promise. Storyboard is now the leftmost and default surface; the flow graph is an
explicit, secondary tab.

### 2. "Issues" → "Problems" rename (§3.6 naming consistency)
The inspector tab that surfaces the plain-language problem list was relabeled from
`Issues (n)` to `Problems (n)`, and the internal tab key was renamed `properties` →
`problems` so the feature is named identically in code, UI, and (this) doc, matching
the §3.5 "Problems panel" terminology.

### 3. Console behavior (§3.6 debug-looking surfaces)
- The Console is **collapsed by default** on the storyboard (and script) surface and
  is **open by default only in the advanced flow-graph views** (Scene Graph / Project
  Flow). A first-time tester is therefore never shown a raw log console before
  opening a flow graph or explicitly expanding it.
- Log messages were rewritten to be human-readable sentences (e.g. `Started scene:
  Introduction`, `Opened project "…"`, `Presented a choice with 2 options`) instead
  of raw developer prefixes (`Loaded:`, `[Say]`, `INFO`).

### 4. Floating canvas controls (§3.6 labeled controls)
The unlabeled React Flow `<Controls>` (zoom in/out, fit-to-screen, lock) were replaced
with a custom `CanvasControls` component:
- Primary controls (zoom in, zoom out, fit to screen) carry hover **tooltips** and
  `aria-label`s.
- The power-user **lock/unlock canvas** control moved into a collapsed **Canvas
  settings** popover (gear icon) instead of sitting permanently on the canvas.

### 5. Minimap / preview redundancy (§3.6 no redundant miniature views)
The graph minimap now **collapses to an icon** (bottom-right "Map" button) by default
and expands on demand. This resolves the redundancy between the always-present live
Preview panel (bottom dock) and the canvas minimap, while keeping both available. The
expanded minimap is visibly labeled "Map" so it is distinct from the Preview panel.

### 6. Duplicate add-entry point removed (§3.6 one-way-to-do-one-thing)
The Node Library's "🖼️ Show Background" button duplicated the "+ import asset" entry
in the left tree (both opened the same asset-import action). The misleading library
entry was removed; asset import now has a single, primary location in the project
tree.

### 7. New Project launcher (§3.6 startup)
The launcher's "New Project" now opens a small modal offering a **name** field and a
**starter template** choice (Blank / One-scene demo), matching the §3.6 spec for the
project launcher. Previously it created a blank project immediately with no name.

## Verification

- `npm run build` (or `pnpm build`) compiles with no type errors introduced by this
  pass.
- Manual: cold launch shows the launcher; opening any project lands on the
  storyboard; the Console is collapsed on the storyboard; the flow-graph tabs and the
  "Problems" tab behave as described above; the minimap starts as an icon.

## Do-not-regress checklist for future AI-assisted phases

1. Do not make the flow graph the boot/default surface. Storyboard first, always.
2. Keep the "Problems" name consistent across code, UI, and docs (never reintroduce
   "Issues").
3. Console stays collapsed on the storyboard; only advanced flow views open it by
   default.
4. Canvas controls must be labeled (tooltips) and the lock must stay in the settings
   popover, not on the canvas.
5. Minimap defaults to an icon; never reintroduce a twin same-sized box next to the
   Preview panel.
6. One entry point per action — do not add a second, differently-styled trigger for an
   existing action.
