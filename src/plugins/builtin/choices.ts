import type { BuiltinPluginDefinition } from '../types';

export const builtinChoicesPlugin: BuiltinPluginDefinition = {
  id: 'choices',
  source: `
api.register({
  manifest: {
    id: 'choices',
    version: '1.0.0',
    name: 'Choices',
    description: 'Presents branching choices to the player. Reimplements the default choice handling as a first-party plugin.',
    author: 'ProjectVNE',
    capabilities: [{ kind: 'engine' }],
    handledBlockTypes: ['choice']
  },
  engineHandlers: {
    choice: function (ctx) {
      var prompt = String(ctx.data.prompt || '');
      var options = [];
      var raw = ctx.data.options || [];
      for (var i = 0; i < raw.length; i++) {
        options.push({
          id: raw[i].id || ('opt_' + i),
          text: String(raw[i].text || ''),
          destinationSceneId: raw[i].destinationSceneId || null,
          conditionId: raw[i].conditionId || null,
          conditionExpression: raw[i].conditionExpression || null
        });
      }
      ctx.presentChoices(prompt, options);
      return { waitForInput: true };
    }
  }
});
`,
};