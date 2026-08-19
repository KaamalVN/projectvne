// Shared TypeScript types for the IR (Intermediate Representation)
// This file is shared between the editor, runtime, validator, and exporter

export type SchemaVersion = 3;

// Unique identifiers - string with ID alias
export type ID = string;

// Helper to create IDs
export function createID(value: string): ID {
  return value;
}

// Base interface for all IR objects
export interface IRObject {
  id: ID;
}

// Project metadata
export interface ProjectMeta {
  schemaVersion: SchemaVersion;
  id: ID;
  title: string;
  createdAt: string; // ISO 8601
  modifiedAt: string; // ISO 8601
}

// Character definition
export interface Character extends IRObject {
  name: string;
  portraits: Record<string, AssetRef>; // expression -> asset reference
  defaultPosition: CharacterPosition;
}

export type CharacterPosition = 'left' | 'center' | 'right';

export interface AssetRef {
  assetId: ID;
  variant?: string;
}

// Asset definition
export interface Asset extends IRObject {
  name: string;
  type: AssetType;
  tags: string[];
  variants: Record<string, string>; // variant name -> file path/url
  fileReference: string; // path or URL
}

export type AssetType = 'background' | 'portrait' | 'music' | 'sfx' | 'other';

// Story variables (story facts)
export interface Variable extends IRObject {
  name: string;
  type: VariableType;
  defaultValue: VariableValue;
  displayName: string;
  description?: string;
  // Extended properties for advanced types
  minValue?: number; // for counter/relationship
  maxValue?: number; // for counter/relationship
  allowedTags?: string[]; // for tag/collection
  inventoryItems?: Record<string, number>; // for inventory (item -> count)
}

export type VariableType = 'number' | 'boolean' | 'text' | 'relationship' | 'inventory' | 'counter' | 'tagCollection';
export type VariableValue = number | boolean | string | string[] | Record<string, number>;

// Scene definition
export interface Scene extends IRObject {
  title: string;
  background: AssetRef | null;
  blocks: StoryBlock[];
}

// Story block types (union)
export type StoryBlock =
  | DialogueBlock
  | ShowCharacterBlock
  | HideCharacterBlock
  | ChoiceBlock
  | ScriptBlock
  | ConditionBlock
  | SetVariableBlock
  | PlayAudioBlock
  | TransitionBlock
  | CommentBlock
  | PluginBlock;

export type BlockType = StoryBlock['type'];

interface BaseBlock extends IRObject {
  type: BlockType;
}

// Dialogue block
export interface DialogueBlock extends BaseBlock {
  type: 'dialogue';
  characterId: ID | null; // null for narrator
  text: string;
  expression?: string;
}

// Show character block
export interface ShowCharacterBlock extends BaseBlock {
  type: 'showCharacter';
  characterId: ID;
  expression: string;
  position: CharacterPosition;
  transition?: TransitionType;
}

// Hide character block
export interface HideCharacterBlock extends BaseBlock {
  type: 'hideCharacter';
  characterId: ID;
  transition?: TransitionType;
}

// Choice block
export interface ChoiceBlock extends BaseBlock {
  type: 'choice';
  prompt: string;
  options: ChoiceOption[];
}

export interface ChoiceOption {
  id: ID;
  text: string;
  destinationSceneId: ID | null;
  conditionId: ID | null; // optional condition that must be true for this option to appear
  conditionExpression?: string | null;
}

export interface ScriptBlock extends BaseBlock {
  type: 'script';
  label: string;
  code: string;
}

// Condition block
export interface ConditionBlock extends BaseBlock {
  type: 'condition';
  conditionId: ID;
  thenBlocks: StoryBlock[];
  elseBlocks: StoryBlock[];
}

// Set variable block
export interface SetVariableBlock extends BaseBlock {
  type: 'setVariable';
  variableId: ID;
  operation: SetVariableOperation;
  value: VariableValue;
}

export type SetVariableOperation = 'set' | 'add' | 'subtract' | 'multiply' | 'divide';

// Play audio block
export interface PlayAudioBlock extends BaseBlock {
  type: 'playAudio';
  assetId: ID;
  action: AudioAction;
  volume?: number; // 0-1
  fadeDuration?: number; // milliseconds
}

export type AudioAction = 'play' | 'stop' | 'fadeIn' | 'fadeOut' | 'loop';

// Transition block
export interface TransitionBlock extends BaseBlock {
  type: 'transition';
  transitionType: TransitionType;
  duration: number; // milliseconds
}

export type TransitionType = 'fade' | 'slide' | 'instant' | 'crossfade';

// Comment block (for author notes)
export interface CommentBlock extends BaseBlock {
  type: 'comment';
  text: string;
}

// Plugin block (v3): a block contributed by a plugin node type. The IR
// discriminator stays stable ('plugin'); the plugin-specific type lives in
// `pluginType`, and the plugin's data payload lives in `data`.
export interface PluginBlock extends IRObject {
  type: 'plugin';
  pluginType: string;
  label?: string;
  pluginId?: string;
  data: Record<string, unknown>;
}

// Flow (project-level scene connections)
export interface Flow {
  entrySceneId: ID;
  connections: FlowConnection[];
}

export interface FlowConnection {
  fromSceneId: ID;
  toSceneId: ID;
  conditionId: ID | null; // optional condition for conditional transitions
}

// UI settings
export interface UISettings {
  theme: 'light' | 'dark' | 'auto';
  dialogueBoxStyle: DialogueBoxStyle;
  choicePresentation: ChoicePresentationStyle;
}

export type DialogueBoxStyle = 'classic' | 'modern' | 'minimal';
export type ChoicePresentationStyle = 'vertical' | 'horizontal' | 'grid';

// Localization (placeholder for future)
export interface Localization {
  defaultLocale: string;
  locales: Record<string, LocaleData>;
}

export interface LocaleData {
  name: string;
  translations: Record<string, string>; // key -> translated text
}

// Export profiles
export interface ExportProfile {
  id: ID;
  name: string;
  target: ExportTarget;
  settings: Record<string, unknown>;
}

export type ExportTarget = 'windows' | 'macos' | 'linux' | 'web';

// Condition definition (referenced by ID in blocks)
export interface Condition extends IRObject {
  name: string;
  expression: ConditionExpression;
}

export type ConditionExpression =
  | VariableCondition
  | CompoundCondition;

export interface VariableCondition {
  type: 'variable';
  variableId: ID;
  operator: ComparisonOperator;
  value: VariableValue;
}

export interface CompoundCondition {
  type: 'compound';
  operator: LogicalOperator;
  conditions: ConditionExpression[];
}

export type ComparisonOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'contains' | 'notContains';
export type LogicalOperator = 'and' | 'or' | 'not';

// Complete Project IR
export interface ProjectIR {
  meta: ProjectMeta;
  characters: Record<ID, Character>;
  assets: Record<ID, Asset>;
  variables: Record<ID, Variable>;
  scenes: Record<ID, Scene>;
  flow: Flow;
  ui: UISettings;
  ai: AiProjectSettings;
  localization: Localization;
  exportProfiles: Record<ID, ExportProfile>;
  conditions: Record<ID, Condition>;
}

// Per-project AI assistant settings (v2)
export interface AiProjectSettings {
  // Master switch for the AI assistant. Off by default; keys never live here.
  enabled: boolean;
}

// Utility type for creating a new project with defaults
export function createEmptyProject(): ProjectIR {
  const now = new Date().toISOString();
  const projectId = createID('project-' + Date.now().toString(36));

  return {
    meta: {
      schemaVersion: 3,
      id: projectId,
      title: 'Untitled Project',
      createdAt: now,
      modifiedAt: now,
    },
    characters: {},
    assets: {},
    variables: {},
    scenes: {},
    flow: {
      entrySceneId: createID(''),
      connections: [],
    },
    ui: {
      theme: 'auto',
      dialogueBoxStyle: 'classic',
      choicePresentation: 'vertical',
    },
    ai: {
      enabled: false,
    },
    localization: {
      defaultLocale: 'en',
      locales: {},
    },
    exportProfiles: {},
    conditions: {},
  };
}
