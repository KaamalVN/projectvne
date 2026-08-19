// Shared types for the internal plugin architecture.
// These types describe the versioned plugin manifest, the capability-scoped
// permission model, and the typed API a plugin registers against.
import type {
  AssetType,
  CharacterPosition,
  ChoiceOption,
  ID,
  ProjectIR,
} from '../shared/types';

// Version of the plugin manifest format itself (not the IR schema version).
export const PLUGIN_MANIFEST_VERSION = 1;

// The parts of the IR a plugin may read or write, explicitly and individually.
export type PluginIRScope =
  | 'characters'
  | 'assets'
  | 'variables'
  | 'scenes'
  | 'conditions'
  | 'flow'
  | 'ui'
  | 'meta';

// Capability model: every capability a plugin may use must be declared up
// front. Nothing is ambient. `network` and `filesystem` can be declared, but
// the current sandbox does not expose either, so a declaration is explicit
// intent rather than a granted hole.
export type PluginCapability =
  | { kind: 'ir.read'; scope: 'all' | PluginIRScope[] }
  | { kind: 'ir.write'; scope: 'all' | PluginIRScope[] }
  | { kind: 'engine' }
  | { kind: 'network' }
  | { kind: 'filesystem' };

export interface PluginManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  author?: string;
  capabilities: PluginCapability[];
  // Block types this plugin can handle at runtime.
  handledBlockTypes?: string[];
  // Declared contributions (informational, matching the registered shapes below).
  contributedNodeTypes?: string[];
  contributedPanels?: string[];
  contributedImporters?: string[];
}

// A plugin-provided view model. This is the only shape a plugin may render into
// the editor chrome: key/value rows, a list, or a note. No raw JSX/DOM.
export type NodeViewModel =
  | { kind: 'kv'; rows: Array<{ label: string; value: string }> }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; text: string };

// A new node type a plugin contributes to the editor (storyboard + node library).
export interface PluginNodeTypeDefinition {
  blockType: string;
  title: string;
  icon?: string;
  category?: string;
  description?: string;
  createData: () => Record<string, unknown>;
  toViewModel: (block: { data: Record<string, unknown> }, project: ProjectIR) => NodeViewModel;
}

// A panel a plugin contributes to the editor's Plugins tab.
export interface PluginPanelDefinition {
  title: string;
  view: (project: ProjectIR) => NodeViewModel;
}

// A new asset importer a plugin contributes to the Import Asset flow.
export interface AssetImportDraft {
  name: string;
  type: AssetType;
  fileReference: string;
  tags?: string[];
  variants?: Record<string, string>;
}

export interface AssetImportInput {
  fileName: string;
  fileText: string;
  project: ProjectIR;
}

export interface AssetImportResult {
  assets?: AssetImportDraft[];
  logs?: string[];
  error?: string;
}

export interface PluginAssetImporterDefinition {
  title: string;
  description?: string;
  accepts: string[];
  import: (input: AssetImportInput) => AssetImportResult;
}

// Runtime payload shapes.
export interface FlashbackPayload {
  title?: string;
  text?: string;
  tint?: string;
}

export interface RunScriptResult {
  jumpToSceneId?: string;
}

export interface PluginHandlerResult {
  waitForInput?: boolean;
  jumpToSceneId?: string;
}

// The typed, capability-gated API a plugin handler receives.
export interface PluginEngineContext {
  blockType: string;
  data: Record<string, unknown>;
  getVariable: (id: string) => unknown;
  setVariable: (id: string, value: unknown) => void;
  showDialogue: (speaker: string, text: string) => void;
  presentChoices: (prompt: string, options: ChoiceOption[]) => void;
  showCharacter: (characterId: ID, expression: string, position: CharacterPosition) => void;
  hideCharacter: (characterId: ID) => void;
  showFlashback: (payload: FlashbackPayload) => void;
  hideFlashback: () => void;
  getCharacterName: (characterId: ID) => string | null;
  jumpToScene: (sceneId: ID) => void;
  runScript: (code: string, label: string) => RunScriptResult;
  log: (message: string) => void;
  advance: () => void;
}

// The adapter the engine implements so plugins can drive presentation/state
// without touching engine internals.
export interface PluginEngineAdapter {
  showDialogue: (speaker: string, text: string) => void;
  presentChoices: (prompt: string, options: ChoiceOption[]) => void;
  showCharacter: (characterId: ID, expression: string, position: CharacterPosition) => void;
  hideCharacter: (characterId: ID) => void;
  showFlashback: (payload: FlashbackPayload) => void;
  hideFlashback: () => void;
  getVariable: (id: string) => unknown;
  setVariable: (id: string, value: unknown) => void;
  getCharacterName: (characterId: ID) => string | null;
  jumpToScene: (sceneId: ID) => void;
  runScript: (code: string, label: string) => RunScriptResult;
  log: (message: string) => void;
  advance: () => void;
}

export interface PluginEngineHandler {
  (ctx: PluginEngineContext): PluginHandlerResult | void;
}

// Everything a plugin registers via api.register(...).
export interface PluginRegistration {
  manifest: PluginManifest;
  engineHandlers?: Record<string, PluginEngineHandler>;
  nodeTypes?: Record<string, PluginNodeTypeDefinition>;
  panels?: Record<string, PluginPanelDefinition>;
  assetImporters?: Record<string, PluginAssetImporterDefinition>;
}

export interface PluginInvokeResult {
  handled: boolean;
  missingCapability?: string;
  waitForInput?: boolean;
  jumpToSceneId?: string;
}

// A loaded plugin instance inside the host.
export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  loadError?: string;
  registration?: PluginRegistration;
}

// First-party plugin delivery format: source code evaluated in the plugin sandbox.
export interface BuiltinPluginDefinition {
  id: string;
  source: string;
}