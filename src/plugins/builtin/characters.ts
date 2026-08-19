import type { BuiltinPluginDefinition } from '../types';

export const builtinCharactersPlugin: BuiltinPluginDefinition = {
  id: 'characters',
  source: `
api.register({
  manifest: {
    id: 'characters',
    version: '1.0.0',
    name: 'Characters',
    description: 'Places and hides character sprites on stage. Reimplements the default sprite display as a first-party plugin.',
    author: 'ProjectVNE',
    capabilities: [{ kind: 'engine' }],
    handledBlockTypes: ['showCharacter', 'hideCharacter']
  },
  engineHandlers: {
    showCharacter: function (ctx) {
      ctx.showCharacter(
        String(ctx.data.characterId || ''),
        String(ctx.data.expression || 'happy'),
        ctx.data.position || 'center'
      );
    },
    hideCharacter: function (ctx) {
      ctx.hideCharacter(String(ctx.data.characterId || ''));
    }
  }
});
`,
};