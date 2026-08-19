import type { BuiltinPluginDefinition } from '../types';

export const builtinScriptPlugin: BuiltinPluginDefinition = {
  id: 'script',
  source: `
api.register({
  manifest: {
    id: 'script',
    version: '1.0.0',
    name: 'Script',
    description: 'Runs sandboxed script blocks for advanced story logic.',
    author: 'ProjectVNE',
    capabilities: [
      { kind: 'engine' },
      { kind: 'ir.read', scope: 'all' },
      { kind: 'ir.write', scope: 'all' }
    ],
    handledBlockTypes: ['script']
  },
  engineHandlers: {
    script: function (ctx) {
      var result = ctx.runScript(String(ctx.data.code || ''), String(ctx.data.label || 'script'));
      if (result && result.jumpToSceneId) return { jumpToSceneId: result.jumpToSceneId };
    }
  }
});
`,
};