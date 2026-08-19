import type { IRCommand } from '../commands/command-types';
import type { ProjectIR } from '../shared/types';

export type AiProviderId = 'anthropic' | 'openai' | 'google' | 'ollama' | 'mock';

export type AiScope = 'scene' | 'project';

// The context we hand to a provider: what the assistant is allowed to know about.
export interface AiContext {
  scope: AiScope;
  project: ProjectIR;
  sceneId: string | null;
  problems: Array<{ severity: string; message: string; fixSuggestion?: string }>;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// JSON-schema flavoured tool definition (provider adapters translate this).
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AiRequest {
  providerId: AiProviderId;
  model: string;
  system: string;
  messages: AiMessage[];
  tools: AiToolDefinition[];
  apiKey?: string;
  ollamaEndpoint?: string;
  context: AiContext;
}

export interface AiResponse {
  text?: string;
  toolCalls: AiToolCall[];
}

// A provider adapter. Everything goes through this interface so switching a
// provider never touches the editor UI or the command pipeline.
export interface AiAdapter {
  id: AiProviderId;
  label: string;
  requiresKey: boolean;
  defaultModel: string;
  modelHint: string;
  send(request: AiRequest): Promise<AiResponse>;
}

export type AiProposalKind =
  | 'addScene'
  | 'deleteScene'
  | 'addDialogue'
  | 'addChoice'
  | 'showCharacter'
  | 'createCharacter'
  | 'createVariable'
  | 'createAsset';

// A reviewable AI-proposed edit. The command is built but NOT executed until the
// user accepts it, and execution always goes through the normal command layer
// (validate -> execute -> undo stack).
export interface AiProposal {
  id: string;
  kind: AiProposalKind;
  title: string;
  description: string;
  command: IRCommand;
}

export interface AiTurnResult {
  text?: string;
  proposals: AiProposal[];
  notes: string[];
  errors: string[];
}