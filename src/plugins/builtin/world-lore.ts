import type { BuiltinPluginDefinition } from '../types';

// First-party demo of a plugin-provided PANEL: a read-only summary rendered in
// the Plugins tab of the right sidebar.
export const builtinWorldLorePlugin: BuiltinPluginDefinition = {
  id: 'world-lore',
  source: `
api.register({
  manifest: {
    id: 'world-lore',
    version: '1.0.0',
    name: 'World Lore',
    description: 'First-party example of a plugin-provided panel. Summarizes the world of the current project.',
    author: 'ProjectVNE',
    capabilities: [{ kind: 'ir.read', scope: 'all' }],
    contributedPanels: ['world-lore']
  },
  panels: {
    'world-lore': {
      title: 'World Lore',
      view: function (project) {
        var characterCount = project.characters ? Object.keys(project.characters).length : 0;
        var assetCount = project.assets ? Object.keys(project.assets).length : 0;
        var sceneCount = project.scenes ? Object.keys(project.scenes).length : 0;
        return {
          kind: 'note',
          text: 'A cast of ' + characterCount + ', ' + sceneCount + ' scene(s), and ' + assetCount + ' asset(s) tell this story so far.'
        };
      }
    }
  }
});
`,
};