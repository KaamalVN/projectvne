import type { BuiltinPluginDefinition } from '../types';

export const builtinVariablesPlugin: BuiltinPluginDefinition = {
  id: 'variables',
  source: `
api.register({
  manifest: {
    id: 'variables',
    version: '1.0.0',
    name: 'Variables',
    description: 'Applies set-variable actions to story facts.',
    author: 'ProjectVNE',
    capabilities: [
      { kind: 'ir.read', scope: ['variables'] },
      { kind: 'ir.write', scope: ['variables'] }
    ],
    handledBlockTypes: ['setVariable']
  },
  engineHandlers: {
    setVariable: function (ctx) {
      var op = ctx.data.operation || 'set';
      var value = ctx.data.value;
      var current = ctx.getVariable(ctx.data.variableId);
      var next = value;
      if (typeof current === 'number' && typeof value === 'number') {
        if (op === 'add') next = current + value;
        else if (op === 'subtract') next = current - value;
        else if (op === 'multiply') next = current * value;
        else if (op === 'divide') next = current / value;
      }
      ctx.setVariable(ctx.data.variableId, next);
    }
  }
});
`,
};