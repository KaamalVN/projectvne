import type { IRCommand } from '../commands/command-types';
import { AddSceneCommand } from '../commands/add-scene-command';
import { DeleteSceneCommand } from '../commands/delete-scene-command';
import { AddDialogueBlockCommand } from '../commands/add-dialogue-block-command';
import { AddChoiceBlockCommand } from '../commands/add-choice-block-command';
import { AddShowCharacterBlockCommand } from '../commands/add-show-character-block-command';
import { CreateCharacterCommand } from '../commands/create-character-command';
import { CreateVariableCommand } from '../commands/create-variable-command';
import { CreateAssetCommand } from '../commands/create-asset-command';
import type { ProjectIR, CharacterPosition, VariableType } from '../shared/types';
import type { AiToolDefinition, AiToolCall, AiProposal } from './types';

const json = (schema: Record<string, unknown>): Record<string, unknown> => ({
  type: 'object',
  properties: schema,
  additionalProperties: false,
});

// The mutation tools a provider may call. Every call becomes a reviewable diff card.
export const mutationTools: AiToolDefinition[] = [
  {
    name: 'add_scene',
    description: 'Create a new scene.',
    parameters: json({ title: { type: 'string', description: 'Scene title, e.g. "chapter_one".' } }),
  },
  {
    name: 'delete_scene',
    description: 'Delete an existing scene.',
    parameters: json({ sceneId: { type: 'string', description: 'ID of the scene to delete (use an exact ID from the context).' } }),
  },
  {
    name: 'add_dialogue_block',
    description: 'Append (or insert) a dialogue line to a scene.',
    parameters: json({
      sceneId: { type: 'string', description: 'Target scene ID (use an exact ID from the context).' },
      characterId: { type: ['string', 'null'], description: 'Speaker character ID, or null for narrator.' },
      text: { type: 'string', description: 'The dialogue text.' },
      insertAtIndex: { type: ['number', 'null'], description: 'Optional block index to insert at; omit to append.' },
    }),
  },
  {
    name: 'add_choice_block',
    description: 'Add a choice branch to a scene.',
    parameters: json({
      sceneId: { type: 'string', description: 'Target scene ID.' },
      prompt: { type: 'string', description: 'The question/choice prompt shown to the player.' },
      options: {
        type: 'array',
        items: json({
          text: { type: 'string', description: 'Option text.' },
          destinationSceneId: { type: ['string', 'null'], description: 'Optional destination scene ID or null to continue.' },
        }),
      },
    }),
  },
  {
    name: 'add_show_character_block',
    description: 'Place a character on stage with an expression and position.',
    parameters: json({
      sceneId: { type: 'string', description: 'Target scene ID.' },
      characterId: { type: 'string', description: 'Character ID to show (use an exact ID from the context).' },
      expression: { type: 'string', description: 'Expression key, e.g. "happy".' },
      position: { type: 'string', enum: ['left', 'center', 'right'], description: 'Stage position.' },
    }),
  },
  {
    name: 'create_character',
    description: 'Add a new character to the cast.',
    parameters: json({
      name: { type: 'string', description: 'Character name, e.g. "Luna".' },
      defaultPosition: { type: ['string', 'null'], enum: ['left', 'center', 'right'], description: 'Default stage position.' },
    }),
  },
  {
    name: 'create_variable',
    description: 'Add a new story variable.',
    parameters: json({
      name: { type: 'string', description: 'Identifier, e.g. "player_trust".' },
      displayName: { type: 'string', description: 'Human-readable label.' },
      type: { type: 'string', enum: ['number', 'boolean', 'text', 'relationship', 'counter', 'tagCollection'] },
      defaultValue: { type: ['number', 'boolean', 'string', 'array', 'null'], description: 'Default value.' },
      minValue: { type: ['number', 'null'], description: 'Optional min for counter/relationship.' },
      maxValue: { type: ['number', 'null'], description: 'Optional max for counter/relationship.' },
      allowedTags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Optional allowed tags for tagCollection.' },
    }),
  },
  {
    name: 'create_asset',
    description: 'Register a background/portrait asset reference.',
    parameters: json({
      name: { type: 'string', description: 'Asset name.' },
      type: { type: 'string', enum: ['background', 'portrait', 'music', 'sfx', 'other'] },
      fileReference: { type: 'string', description: 'Path or URL.' },
    }),
  },
];

// Informational tools — resolved locally (no mutation, no diff card).
export const infoTools: AiToolDefinition[] = [
  {
    name: 'check_continuity',
    description: 'Check the story for continuity/reachability problems using the project integrity checker.',
    parameters: json({}),
  },
  {
    name: 'explain_branch',
    description: 'Explain branch reachability of a scene in plain language.',
    parameters: json({ sceneId: { type: 'string', description: 'Scene ID to explain (use an exact ID from the context).' } }),
  },
];

export const allTools: AiToolDefinition[] = [...mutationTools, ...infoTools];

const MUTATION_NAMES = new Set(mutationTools.map(t => t.name));

export interface ProposalBuildResult {
  proposals: AiProposal[];
  errors: string[];
}

export function buildProposalsFromToolCalls(calls: AiToolCall[], project: ProjectIR): ProposalBuildResult {
  const proposals: AiProposal[] = [];
  const errors: string[] = [];

  for (const call of calls) {
    if (!MUTATION_NAMES.has(call.name)) continue;
    const built = buildProposal(call, project);
    if (built.ok) {
      proposals.push(built.proposal);
    } else {
      errors.push(`Tool "${call.name}": ${built.error}`);
    }
  }

  return { proposals, errors };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const maybeStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const maybeNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function sceneTitle(project: ProjectIR, id: string): string {
  return project.scenes[id]?.title || id;
}

function buildProposal(call: AiToolCall, project: ProjectIR): { ok: true; proposal: AiProposal } | { ok: false; error: string } {
  const args = call.args || {};
  const id = `ai-${call.id || call.name}`;

  switch (call.name) {
    case 'add_scene': {
      const title = str(args.title);
      if (!title.trim()) return { ok: false, error: 'add_scene requires a non-empty "title".' };
      const command: IRCommand = new AddSceneCommand({ title, backgroundAssetId: null });
      return { ok: true, proposal: { id, kind: 'addScene', title: `Add scene "${title}"`, description: 'Create a new, empty scene that you can build out.', command } };
    }

    case 'delete_scene': {
      const sceneId = str(args.sceneId);
      if (!sceneId) return { ok: false, error: 'delete_scene requires a "sceneId".' };
      const command: IRCommand = new DeleteSceneCommand({ sceneId });
      return { ok: true, proposal: { id, kind: 'deleteScene', title: `Delete scene "${sceneTitle(project, sceneId)}"`, description: 'Remove this scene and everything in it.', command } };
    }

    case 'add_dialogue_block': {
      const sceneId = str(args.sceneId);
      const text = str(args.text);
      if (!sceneId) return { ok: false, error: 'add_dialogue_block requires a "sceneId".' };
      if (!text.trim()) return { ok: false, error: 'add_dialogue_block requires non-empty "text".' };
      const characterId = maybeStr(args.characterId) || null;
      const command: IRCommand = new AddDialogueBlockCommand({
        sceneId,
        characterId,
        text,
        insertAtIndex: maybeNum(args.insertAtIndex),
      });
      const speaker = characterId ? project.characters[characterId]?.name || characterId : 'Narrator';
      const snippet = text.length > 60 ? text.slice(0, 60) + '…' : text;
      return { ok: true, proposal: { id, kind: 'addDialogue', title: `Add dialogue to "${sceneTitle(project, sceneId)}"`, description: `${speaker}: "${snippet}"`, command } };
    }

    case 'add_choice_block': {
      const sceneId = str(args.sceneId);
      const prompt = str(args.prompt);
      const options = Array.isArray(args.options) ? args.options : [];
      if (!sceneId) return { ok: false, error: 'add_choice_block requires a "sceneId".' };
      if (!prompt.trim()) return { ok: false, error: 'add_choice_block requires a non-empty "prompt".' };
      if (options.length === 0) return { ok: false, error: 'add_choice_block requires at least one option.' };
      const normalized = options.map(o => ({
        text: str((o as any)?.text),
        destinationSceneId: maybeStr((o as any)?.destinationSceneId) || null,
      }));
      const command: IRCommand = new AddChoiceBlockCommand({ sceneId, prompt, options: normalized });
      const snippet = prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt;
      return { ok: true, proposal: { id, kind: 'addChoice', title: `Add choice to "${sceneTitle(project, sceneId)}"`, description: `"${snippet}" with ${normalized.length} option(s).`, command } };
    }

    case 'add_show_character_block': {
      const sceneId = str(args.sceneId);
      const characterId = str(args.characterId);
      const expression = str(args.expression) || 'happy';
      const position = (str(args.position) as CharacterPosition) || 'center';
      if (!sceneId) return { ok: false, error: 'add_show_character_block requires a "sceneId".' };
      if (!characterId) return { ok: false, error: 'add_show_character_block requires a "characterId".' };
      const command: IRCommand = new AddShowCharacterBlockCommand({ sceneId, characterId, expression, position });
      const name = project.characters[characterId]?.name || characterId;
      return { ok: true, proposal: { id, kind: 'showCharacter', title: `Show ${name} in "${sceneTitle(project, sceneId)}"`, description: `${expression} at ${position}.`, command } };
    }

    case 'create_character': {
      const name = str(args.name);
      if (!name.trim()) return { ok: false, error: 'create_character requires a non-empty "name".' };
      const command: IRCommand = new CreateCharacterCommand({
        name,
        defaultPosition: (str(args.defaultPosition) as CharacterPosition) || 'center',
      });
      return { ok: true, proposal: { id, kind: 'createCharacter', title: `Create character "${name}"`, description: 'Adds a new member to the cast.', command } };
    }

    case 'create_variable': {
      const name = str(args.name);
      const displayName = str(args.displayName) || name;
      if (!name.trim()) return { ok: false, error: 'create_variable requires a non-empty "name".' };
      const type = (str(args.type) as VariableType) || 'number';
      let defaultValue: unknown = args.defaultValue;
      if (type === 'number' || type === 'relationship' || type === 'counter') defaultValue = Number(args.defaultValue) || 0;
      if (type === 'boolean') defaultValue = Boolean(args.defaultValue);
      if (type === 'tagCollection') defaultValue = Array.isArray(args.defaultValue) ? (args.defaultValue as string[]) : [];
      const command: IRCommand = new CreateVariableCommand({
        name,
        displayName,
        type,
        defaultValue: defaultValue as never,
        minValue: maybeNum(args.minValue),
        maxValue: maybeNum(args.maxValue),
        allowedTags: Array.isArray(args.allowedTags) ? (args.allowedTags as string[]) : undefined,
      });
      return { ok: true, proposal: { id, kind: 'createVariable', title: `Create variable "${name}"`, description: `A ${type} variable that the story can track.`, command } };
    }

    case 'create_asset': {
      const name = str(args.name);
      const fileReference = str(args.fileReference);
      if (!name.trim()) return { ok: false, error: 'create_asset requires a non-empty "name".' };
      if (!fileReference.trim()) return { ok: false, error: 'create_asset requires a non-empty "fileReference".' };
      const type = (str(args.type) as 'background') || 'background';
      const command: IRCommand = new CreateAssetCommand({ name, type, fileReference });
      return { ok: true, proposal: { id, kind: 'createAsset', title: `Register asset "${name}"`, description: `Maps ${fileReference} as a ${type} asset.`, command } };
    }

    default:
      return { ok: false, error: `Unsupported tool "${call.name}".` };
  }
}