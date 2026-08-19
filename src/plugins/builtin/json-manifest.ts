import type { BuiltinPluginDefinition } from '../types';

// First-party demo of a plugin-provided ASSET IMPORTER: imports one or more
// assets from a JSON manifest selected by the user.
export const builtinJsonManifestPlugin: BuiltinPluginDefinition = {
  id: 'json-manifest',
  source: `
api.register({
  manifest: {
    id: 'json-manifest',
    version: '1.0.0',
    name: 'JSON Asset Manifest',
    description: 'First-party example of a plugin-provided asset importer. Imports assets from a JSON manifest.',
    author: 'ProjectVNE',
    capabilities: [
      { kind: 'ir.read', scope: ['assets'] },
      { kind: 'ir.write', scope: ['assets'] },
      { kind: 'filesystem' }
    ],
    contributedImporters: ['json-manifest']
  },
  assetImporters: {
    'json-manifest': {
      title: 'JSON asset manifest',
      description: 'Import assets from a JSON object with an "assets" array.',
      accepts: ['.json'],
      import: function (input) {
        var parsed = null;
        try {
          parsed = JSON.parse(input.fileText);
        } catch (err) {
          return { error: 'The selected file is not valid JSON.' };
        }
        var list = [];
        if (parsed && Array.isArray(parsed.assets)) list = parsed.assets;
        else if (parsed && Array.isArray(parsed)) list = parsed;
        if (list.length === 0) {
          return { error: 'No assets found. Expected a JSON object with an "assets" array.' };
        }
        var validTypes = { background: 1, portrait: 1, music: 1, sfx: 1, other: 1 };
        var assets = [];
        var logs = [];
        for (var i = 0; i < list.length; i++) {
          var entry = list[i];
          if (!entry || typeof entry !== 'object') continue;
          var type = validTypes[entry.type] ? entry.type : 'other';
          var asset = {
            name: String(entry.name || ('asset_' + (i + 1))),
            type: type,
            fileReference: String(entry.file || entry.path || ''),
            tags: Array.isArray(entry.tags) ? entry.tags.map(String) : []
          };
          if (entry.variants && typeof entry.variants === 'object') {
            asset.variants = entry.variants;
          }
          if (!asset.fileReference) {
            return { error: 'Asset "' + asset.name + '" is missing a file or path field.' };
          }
          assets.push(asset);
          logs.push('Imported ' + asset.type + ' "' + asset.name + '" from ' + asset.fileReference);
        }
        return { assets: assets, logs: logs };
      }
    }
  }
});
`,
};