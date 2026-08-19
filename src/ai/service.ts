import type { ProjectIR } from '../shared/types';
import { ProblemsChecker } from '../shared/problems-checker';
import {
  evaluateChoiceAvailability,
  buildDefaultVariableState,
  findNeverSatisfiedConditions,
} from '../shared/story-logic';
import { getAdapter } from './adapters';
import { buildProposalsFromToolCalls, allTools } from './tools';
import type { AiContext, AiMessage, AiProposal, AiScope, AiTurnResult, AiProviderId } from './types';

export function buildAiContext(project: ProjectIR, scope: AiScope, sceneId: string | null): AiContext {
  const problems = ProblemsChecker.check(project)
    .filter(p => (scope === 'scene' && sceneId ? p.sceneId === sceneId : true))
    .map(p => ({ severity: p.severity, message: p.message, fixSuggestion: p.fixSuggestion }));
  return { scope, project, sceneId, problems };
}

function buildSystemPrompt(context: AiContext): string {
  const { project, sceneId } = context;

  const sceneLines = Object.entries(project.scenes).map(([id, s]) => {
    const blockCount = s.blocks.length;
    return `- "${s.title}" (id: ${id}, ${blockCount} block(s))${id === sceneId ? ' [CURRENT SCENE]' : ''}`;
  });

  const charLines = Object.entries(project.characters).map(([id, c]) => `- ${c.name} (id: ${id})`);
  const varLines = Object.entries(project.variables).map(([id, v]) => `- ${v.displayName || v.name} (id: ${id}, type: ${v.type}, default: ${JSON.stringify(v.defaultValue)})`);

  const problemLines = context.problems.length
    ? context.problems.map(p => `- [${p.severity}] ${p.message}${p.fixSuggestion ? ` (${p.fixSuggestion})` : ''}`)
    : ['- None'];

  return `You are the AI editing assistant inside ProjectVNE, a visual-novel studio. You help the author write story content and keep the story healthy.

CONTEXT — current story:
Title: ${project.meta.title}
Scenes:
${sceneLines.length ? sceneLines.join('\n') : '(none yet)'}

Characters:
${charLines.length ? charLines.join('\n') : '(none yet)'}

Variables:
${varLines.length ? varLines.join('\n') : '(none yet)'}

Integrity problems (from the Problems panel):
${problemLines.join('\n')}

RULES:
1. Only reference IDs that appear in the context above. Never invent IDs.
2. To make ANY story edit, use one of the tool calls. Never paste raw JSON into your reply.
3. Your free-text reply is just prose for the author; every edit is a tool call.
4. Proposals are reviewed by the author before being applied, so keep edits small, named, and easy to approve.
5. Use check_continuity or explain_branch when asked about problems or reachability instead of guessing.
6. Write in the same language as the author's latest message.`;
}

export interface AiTurnInput {
  project: ProjectIR;
  scope: AiScope;
  sceneId: string | null;
  providerId: AiProviderId;
  model: string;
  apiKey?: string;
  ollamaEndpoint?: string;
  messages: AiMessage[];
}

export async function runAiTurn(input: AiTurnInput): Promise<AiTurnResult> {
  const context = buildAiContext(input.project, input.scope, input.sceneId);
  const adapter = getAdapter(input.providerId);

  let response;
  try {
    response = await adapter.send({
      providerId: input.providerId,
      model: input.model,
      system: buildSystemPrompt(context),
      messages: input.messages,
      tools: allTools,
      apiKey: input.apiKey,
      ollamaEndpoint: input.ollamaEndpoint,
      context,
    });
  } catch (err) {
    return { proposals: [], notes: [], errors: [err instanceof Error ? err.message : 'Provider request failed'] };
  }

  const { proposals, errors } = buildProposalsFromToolCalls(response.toolCalls, input.project);

  const notes: string[] = [];
  for (const call of response.toolCalls) {
    if (call.name === 'check_continuity') notes.push(checkContinuityText(input.project, input.scope, input.sceneId));
    if (call.name === 'explain_branch') notes.push(explainBranchText(input.project, String(call.args.sceneId ?? input.sceneId ?? '')));
  }

  return { text: response.text, proposals, notes, errors };
}

export function checkContinuityText(project: ProjectIR, scope: AiScope, sceneId: string | null): string {
  const problems = ProblemsChecker.check(project).filter(p => (scope === 'scene' && sceneId ? p.sceneId === sceneId : true));
  if (problems.length === 0) {
    return 'Continuity check passed — no problems found.';
  }
  const lines = problems.map(p => `• [${p.severity}] ${p.message}${p.fixSuggestion ? ` — ${p.fixSuggestion}` : ''}`);
  return `Continuity issues found (${problems.length}):\n${lines.join('\n')}`;
}

export function explainBranchText(project: ProjectIR, sceneId: string | null): string {
  const scene = sceneId ? project.scenes[sceneId] : null;
  if (!scene) return 'That scene does not exist.';

  const snapshot = buildDefaultVariableState(project);
  const lines: string[] = [`Branch reachability for "${scene.title}":`];
  const choices = scene.blocks.filter(b => b.type === 'choice');

  if (choices.length === 0) {
    lines.push('This scene has no choice branches.');
  }

  for (const block of choices) {
    const choice = block as any;
    lines.push(`• "${choice.prompt}"`);
    for (const opt of choice.options || []) {
      const availability = evaluateChoiceAvailability(opt, project, snapshot);
      const target = opt.destinationSceneId ? project.scenes[opt.destinationSceneId]?.title || opt.destinationSceneId : 'continue in scene';
      const state = availability.available ? 'reachable' : 'hidden';
      const why = availability.explanation ? ` — ${availability.explanation}` : '';
      lines.push(`  - ${state}: "${opt.text}" → ${target}${why}`);
    }
  }

  const never = findNeverSatisfiedConditions(project);
  if (never.length) {
    lines.push(`Conditions that can never be satisfied: ${never.map(n => n.reason).join('; ')}`);
  }

  return lines.join('\n');
}

export function summarizeProposals(proposals: AiProposal[]): string {
  if (proposals.length === 0) return '';
  return proposals.map(p => `• ${p.title}`).join('\n');
}