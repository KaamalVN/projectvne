import type { BuiltinPluginDefinition } from '../types';

// First-party demo of a plugin-provided NODE TYPE: a full-screen flashback
// overlay block that did not exist in the core engine.
export const builtinFlashbackPlugin: BuiltinPluginDefinition = {
  id: 'flashback',
  source: `
api.register({
  manifest: {
    id: 'flashback',
    version: '1.0.0',
    name: 'Flashback',
    description: 'First-party example of a plugin-provided node type. Shows a full-screen flashback overlay.',
    author: 'ProjectVNE',
    capabilities: [{ kind: 'engine' }],
    handledBlockTypes: ['flashback'],
    contributedNodeTypes: ['flashback']
  },
  engineHandlers: {
    flashback: function (ctx) {
      ctx.showFlashback({
        title: String(ctx.data.title || 'Flashback'),
        text: String(ctx.data.text || ''),
        tint: ctx.data.tint || '#2d2a4a'
      });
      ctx.log('Flashback: ' + (ctx.data.title || 'Flashback'));
      return { waitForInput: true };
    }
  },
  nodeTypes: {
    flashback: {
      blockType: 'flashback',
      title: 'Flashback',
      icon: '📜',
      category: 'Presentation',
      description: 'Shows a full-screen flashback overlay with a title and text.',
      createData: function () {
        return { title: 'A memory surfaces', text: 'The ruined hall stretches ahead, cold and quiet.', tint: '#2d2a4a' };
      },
      toViewModel: function (block) {
        return {
          kind: 'kv',
          rows: [
            { label: 'Title', value: block.data.title || '' },
            { label: 'Text', value: block.data.text || '' },
            { label: 'Tint', value: block.data.tint || '#2d2a4a' }
          ]
        };
      }
    }
  }
});
`,
};