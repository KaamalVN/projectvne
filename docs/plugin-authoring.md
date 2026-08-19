# Authoring a ProjectVNE plugin (public docs)

> This is the documentation a third-party plugin developer is given. Following
> it — and only it — must be enough to build and ship a working plugin (a new
> node type, asset importer, or panel) with no private support channel (Phase 6
> AC1). The plugin API is stable and versioned (manifest `PLUGIN_MANIFEST_VERSION
> = 1`). `docs/plugin-api.md` is the reference for the types referenced here.

## What a plugin can contribute

- **A new node type** — a new story block that appears in the Node Library and
  the storyboard, stored in the IR as `{ type: "plugin", pluginType, data }`.
- **A panel** — read-only content rendered in the editor's Plugins tab.
- **An asset importer** — a new option in the Import Asset flow that turns a
  chosen file into one or more assets.

A plugin runs inside a sandbox and can only use capabilities it declares. Nothing
is ambient.

## The shape of a plugin

A plugin is a plain JavaScript object:

```ts
{ id: string; source: string }
```

`source` is a script that calls `api.register({ ... })` exactly once. The host
loads it through the sandbox and indexes what you register.

### Minimal example — a new node type

```js
api.register({
  manifest: {
    id: 'whisper',
    version: '1.0.0',
    name: 'Whisper',
    description: 'A soft, dimmed aside that does not pause the scene.',
    author: 'You',
    capabilities: [{ kind: 'engine' }],
    handledBlockTypes: ['whisper'],
    contributedNodeTypes: ['whisper']
  },
  engineHandlers: {
    whisper: function (ctx) {
      ctx.showDialogue('Narrator', String(ctx.data.text || ''));
      return { waitForInput: true };
    }
  },
  nodeTypes: {
    whisper: {
      blockType: 'whisper',
      title: 'Whisper',
      icon: '🤫',
      category: 'Dialogue',
      description: 'Shows a dimmed aside from the narrator.',
      createData: function () { return { text: '...' }; },
      toViewModel: function (block) {
        return { kind: 'kv', rows: [{ label: 'Text', value: String(block.data.text || '') }] };
      }
    }
  }
});
```

### A panel

```js
api.register({
  manifest: {
    id: 'scene-count',
    version: '1.0.0',
    name: 'Scene Count',
    description: 'Counts the scenes in the project.',
    author: 'You',
    capabilities: [{ kind: 'ir.read', scope: ['scenes'] }],
    contributedPanels: ['scene-count']
  },
  panels: {
    'scene-count': {
      title: 'Scene Count',
      view: function (project) {
        var n = project.scenes ? Object.keys(project.scenes).length : 0;
        return { kind: 'note', text: n + ' scene(s).' };
      }
    }
  }
});
```

### An asset importer

```js
api.register({
  manifest: {
    id: 'my-importer',
    version: '1.0.0',
    name: 'My Importer',
    description: 'Imports assets from a TSV file.',
    author: 'You',
    capabilities: [{ kind: 'ir.write', scope: ['assets'] }],
    contributedImporters: ['my-importer']
  },
  assetImporters: {
    'my-importer': {
      title: 'TSV manifest',
      description: 'Import assets from a tab-separated file.',
      accepts: ['.tsv'],
      import: function (input) {
        return { assets: [{ name: 'demo', type: 'other', fileReference: 'assets/demo.tsv' }] };
      }
    }
  }
});
```

## Capabilities

Every handler call is gated. You must declare what you use:

| Call | Capability |
| --- | --- |
| `getVariable` / `setVariable` | `ir.read` / `ir.write: variables` |
| `getCharacterName` | `ir.read: characters` |
| `showDialogue` / `showCharacter` / `presentChoices` / `showFlashback` / `jumpToScene` / `advance` | `engine` |
| `runScript` | `engine` + `ir.read/write: variables` |
| `log` | none |

`ir.read`/`ir.write` take a scope: `'all'` or an array like `['characters','assets']`.
`network` and `filesystem` can be declared, but the current sandbox does not
expose either.

See `docs/plugin-api.md` for the full `PluginEngineContext` and `NodeViewModel`
shapes.

## Shipping a plugin

1. Give your plugin a unique `id` (stable, never reused).
2. Deliver the `{ id, source }` object through the marketplace (see the
   Marketplace tab in the editor). Installing stores your source as data; the
   plugin host loads it at startup alongside first-party plugins — you never
   modify the editor or engine source.
3. Your plugin participates in enable/disable, the capability model, and
   missing-capability reporting exactly like first-party plugins.

## Rules of the road

- **Declare every capability you use.** An undeclared call fails with a clear
  "missing capability" error, never a silent break.
- **Do not access the DOM.** The only way to render into the editor is the
  `NodeViewModel` (`kv` / `list` / `note`) or the engine adapter calls.
- **No network or filesystem** in the current sandbox.
- **Keep the manifest stable** — `PLUGIN_MANIFEST_VERSION` only bumps on breaking
  changes, and the manifest format is what a compatible version checks against.