import type { BuiltinPluginDefinition } from '../types';

export const builtinDialoguePlugin: BuiltinPluginDefinition = {
  id: 'dialogue',
  source: `
api.register({
  manifest: {
    id: 'dialogue',
    version: '1.0.0',
    name: 'Dialogue',
    description: 'Base dialogue rendering. Reimplements the default dialogue behavior as a first-party plugin.',
    author: 'ProjectVNE',
    capabilities: [
      { kind: 'engine' },
      { kind: 'ir.read', scope: ['characters'] }
    ],
    handledBlockTypes: ['dialogue']
  },
  engineHandlers: {
    dialogue: function (ctx) {
      var characterId = ctx.data.characterId || null;
      var speaker = characterId ? (ctx.getCharacterName(characterId) || 'Narrator') : 'Narrator';
      ctx.showDialogue(speaker, String(ctx.data.text || ''));
      return { waitForInput: true };
    }
  }
});
`,
};