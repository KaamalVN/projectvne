# Plugin API (internal, first-party)

> Phase 5. The contract a plugin registers against. Written to be usable by a
> third-party author today, though current delivery is first-party source strings
> evaluated in a sandbox.

## 1. Big picture

Plugins contribute **behavior and chrome** to the editor and the runtime engine:

- **Engine handlers** — implement new story-block types (e.g. `flashback`) that
  run in the preview engine and drive presentation through a small adapter API.
- **Node types** — appear in the Node Library and render in the storyboard,
  backed by a block stored in the IR as `{ type: "plugin", pluginType, data }`.
- **Panels** — render read-only content in the Plugins tab.
- **Asset importers** — appear in the Import Asset modal and turn a chosen file
  into one or more `CreateAssetCommand` calls.

A plugin **declares capabilities** (what it may read/write/call) and the host
**enforces** them. Nothing is ambient; a block whose plugin is disabled becomes a
visible "missing capability" state, never a crash.

## 2. Capability model

```ts
type PluginCapability =
  | { kind: 'ir.read';  scope: 'all' | PluginIRScope[] }
  | { kind: 'ir.write'; scope: 'all' | PluginIRScope[] }
  | { kind: 'engine' }
  | { kind: 'network' }
  | { kind: 'filesystem' };
```

- `ir.read` / `ir.write` gate access to IR state. `PluginIRScope` =
  `characters | assets | variables | scenes | conditions | flow | ui | meta`.
  A handler call like `ctx.getCharacterName` requires `ir.read: characters`.
- `engine` gates presentation calls (`showDialogue`, `presentChoices`,
  `showCharacter`, `showFlashback`, `advance`, …).
- `network` / `filesystem` may be **declared** but the current sandbox does not
  expose either — a declaration is explicit intent, not a granted hole.

Enforcement point: `PluginHost` wraps every handler context and throws
`MissingCapabilityError` when a handler calls something it did not declare.
The engine catches this and surfaces `onPluginMissing` + a Problems-panel
warning; the story never crashes.

## 3. Registration

A plugin runs `api.register(...)` exactly once:

```ts
interface PluginRegistration {
  manifest: PluginManifest;              // required
  engineHandlers?: Record<string, (ctx: PluginEngineContext) => PluginHandlerResult | void>;
  nodeTypes?:     Record<string, PluginNodeTypeDefinition>;
  panels?:        Record<string, PluginPanelDefinition>;
  assetImporters?: Record<string, PluginAssetImporterDefinition>;
}
```

### Manifest

```ts
{
  id: string;                // unique, used everywhere (enablement, dispatch, errors)
  version: string;           // semver string, informational
  name: string;              // display name
  description: string;
  author?: string;
  capabilities: PluginCapability[];
  handledBlockTypes?: string[];   // block types this plugin's engineHandlers cover
  contributedNodeTypes?: string[];  // informational, must match nodeTypes keys
  contributedPanels?: string[];      // informational, must match panels keys
  contributedImporters?: string[];   // informational, must match assetImporters keys
}
```

### Handler context (`PluginEngineContext`)

| Call | Capability required |
| --- | --- |
| `getVariable(id)` | `ir.read: variables` |
| `setVariable(id, value)` | `ir.write: variables` |
| `getCharacterName(id)` | `ir.read: characters` |
| `showDialogue(speaker, text)` | `engine` |
| `presentChoices(prompt, options)` | `engine` |
| `showCharacter(id, expr, pos)` / `hideCharacter(id)` | `engine` |
| `showFlashback(payload)` / `hideFlashback()` | `engine` |
| `jumpToScene(id)` | `engine` |
| `runScript(code, label)` | `engine` + `ir.read: variables` + `ir.write: variables` |
| `log(message)` | none |
| `advance()` | `engine` |

A handler returns `{ waitForInput?: boolean; jumpToSceneId?: string }` or void.

## 4. Node types

```ts
interface PluginNodeTypeDefinition {
  blockType: string;   // must equal the key
  title: string;
  icon?: string;       // small glyph shown in storyboard + node library
  category?: string;
  description?: string;
  createData: () => Record<string, unknown>;           // defaults for the Add modal
  toViewModel: (block: { data }, project: ProjectIR) => NodeViewModel;
}
```

`NodeViewModel` is the only rendering shape plugins may emit into the editor:
`{ kind: 'kv', rows: [{label, value}] }`, `{ kind: 'list', items }`, or
`{ kind: 'note', text }`. No raw DOM.

## 5. Panels

```ts
interface PluginPanelDefinition {
  title: string;
  view: (project: ProjectIR) => NodeViewModel;
}
```

Rendered in the Plugins tab under "Plugin Panels". Read-only by construction;
a thrown view becomes an inline error box.

## 6. Asset importers

```ts
interface PluginAssetImporterDefinition {
  title: string;
  description?: string;
  accepts: string[];   // e.g. ['.json']
  import: (input: { fileName; fileText; project }) => {
    assets?: AssetImportDraft[];  // { name, type, fileReference, tags?, variants? }
    logs?: string[];
    error?: string;
  };
}
```

The editor feeds the chosen file's text in, applies the returned drafts through
`CreateAssetCommand` (so they are undoable), and logs each `logs` line.

## 7. Dispatch

- For core blocks the dispatch type is the IR block `type` (`dialogue`, `choice`,
  …). For plugin blocks it is `pluginType`.
- Block types are keyed globally: `handledBlockTypes`/`nodeTypes` from every
  plugin share one namespace. The engine asks the host for the handler by type;
  the host answers with the handler of the plugin that declared it.
- When the owning plugin is disabled: the handler is not indexed, `nodeTypeFor`
  returns nothing (storyboard shows an amber "Missing capability" card), the
  Problems panel reports it, and a runtime `onPluginMissing` event fires — all
  without crashing.

## 8. Enablement

Per-plugin enablement is **app-level**, stored in `localStorage` under
`projectvne.plugins.disabled` as a JSON array of disabled ids. Empty/absent means
"everything enabled" (the default). Toggling re-creates the plugin host and the
engine, so a disable takes effect immediately and reversibly.

## 9. Sandbox

Builtin plugins ship as source strings evaluated by `PluginSandbox` with the
Phase-3 blocked-global list plus `File`, `FileReader`, `Blob`, `URL`, `alert`,
`confirm`, `prompt`. `PluginSandbox` is a small swappable interface; swapping the
`new Function` runner for QuickJS-WASM is a documented Phase-6 hardening item and
requires no change to the plugin-facing types above.

## 10. First-party plugins

| id | contributes | capability set |
| --- | --- | --- |
| `dialogue` | engine handler for `dialogue` | `engine`, `ir.read: characters` |
| `characters` | handlers for `showCharacter`/`hideCharacter` | `engine` |
| `choices` | handler for `choice` | `engine` |
| `variables` | handler for `setVariable` | `engine`, `ir.read/write: variables` |
| `script` | handler for `script` (arbitrary JS + optional jump) | `engine`, `ir.read/write: variables` |
| `flashback` | handler + node type `flashback` | `engine` |
| `world-lore` | panel | `ir.read: all` |
| `json-manifest` | asset importer | `ir.read/write: assets`, `filesystem` (declared) |

These are the only built-ins; the Node Library's "Plugins" section therefore shows
only `flashback` (no duplication with core add buttons).