import type { AiAdapter, AiProviderId, AiToolCall } from './types';
import { spendCredits, COST_PER_CLOUD_REQUEST, loadCredits } from './credits';

// Every provider implements the same contract. New providers are added to the
// registry below — no editor code, command pipeline, or UI change required.

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Provider returned HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

function argsFromJson(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const anthropicAdapter: AiAdapter = {
  id: 'anthropic',
  label: 'Anthropic Claude (BYOK)',
  requiresKey: true,
  defaultModel: 'claude-sonnet-4-20250514',
  modelHint: 'e.g. claude-sonnet-4-20250514',
  async send(req) {
    if (!req.apiKey) throw new Error('Anthropic API key is missing. Add one in AI settings.');
    const body = {
      model: req.model || this.defaultModel,
      max_tokens: 4096,
      system: req.system,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      tools: req.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    };
    const data = (await postJson('https://api.anthropic.com/v1/messages', {
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    }, body)) as any;
    const text: string[] = [];
    const toolCalls: AiToolCall[] = [];
    for (const block of (data.content || []) as any[]) {
      if (block.type === 'text' && block.text) text.push(block.text);
      if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, args: block.input || {} });
    }
    return { text: text.join('\n') || undefined, toolCalls };
  },
};

const openAiAdapter: AiAdapter = {
  id: 'openai',
  label: 'OpenAI (BYOK)',
  requiresKey: true,
  defaultModel: 'gpt-4o',
  modelHint: 'e.g. gpt-4o, gpt-4o-mini',
  async send(req) {
    if (!req.apiKey) throw new Error('OpenAI API key is missing. Add one in AI settings.');
    const body = {
      model: req.model || this.defaultModel,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map(m => ({ role: m.role, content: m.content })),
      ],
      tools: req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: 'auto',
    };
    const data = (await postJson('https://api.openai.com/v1/chat/completions', {
      authorization: `Bearer ${req.apiKey}`,
    }, body)) as any;
    const message = data.choices?.[0]?.message;
    const toolCalls: AiToolCall[] = (message?.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      args: argsFromJson(tc.function?.arguments),
    }));
    return { text: typeof message?.content === 'string' ? message.content : undefined, toolCalls };
  },
};

const googleAdapter: AiAdapter = {
  id: 'google',
  label: 'Google Gemini (BYOK)',
  requiresKey: true,
  defaultModel: 'gemini-2.0-flash',
  modelHint: 'e.g. gemini-2.0-flash',
  async send(req) {
    if (!req.apiKey) throw new Error('Google API key is missing. Add one in AI settings.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model || this.defaultModel}:generateContent?key=${encodeURIComponent(req.apiKey)}`;
    const body: any = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    };
    if (req.tools.length) {
      body.tools = [{
        functionDeclarations: req.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
      }];
    }
    const data = (await postJson(url, {}, body)) as any;
    const parts: any[] = data.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => p.text).map(p => p.text).join('\n') || undefined;
    const toolCalls: AiToolCall[] = parts
      .filter(p => p.functionCall)
      .map((p, i) => ({ id: `fc-${i}`, name: p.functionCall.name, args: p.functionCall.args || {} }));
    return { text, toolCalls };
  },
};

const ollamaAdapter: AiAdapter = {
  id: 'ollama',
  label: 'Ollama (local)',
  requiresKey: false,
  defaultModel: 'llama3.1',
  modelHint: 'local model name, e.g. llama3.1',
  async send(req) {
    const endpoint = (req.ollamaEndpoint || 'http://localhost:11434').replace(/\/+$/, '');
    const body = {
      model: req.model || this.defaultModel,
      stream: false,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map(m => ({ role: m.role, content: m.content })),
      ],
      tools: req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    };
    const data = (await postJson(`${endpoint}/api/chat`, {}, body)) as any;
    const rawCalls: any[] = data.message?.tool_calls || [];
    const toolCalls: AiToolCall[] = rawCalls.map((t, i) => ({
      id: `ollama-${i}`,
      name: t.function?.name,
      args: argsFromJson(t.function?.arguments),
    }));
    return { text: typeof data.message?.content === 'string' ? data.message.content : undefined, toolCalls };
  },
};

// Offline/demo provider. Produces deterministic proposals so the whole review
// workflow can be exercised without any network access or API key.
const mockAdapter: AiAdapter = {
  id: 'mock',
  label: 'Mock (offline demo)',
  requiresKey: false,
  defaultModel: 'mock-v1',
  modelHint: 'deterministic offline responses',
  async send(req) {
    const last = req.messages[req.messages.length - 1]?.content?.toLowerCase() || '';
    const text = 'I reviewed your story and drafted the following edit(s). Review each card and accept or reject it before it is applied.';
    const ctx = req.context;
    const sceneId = ctx.sceneId || Object.keys(ctx.project.scenes)[0] || null;
    const firstChar = Object.keys(ctx.project.characters)[0] || null;
    let toolCalls: AiToolCall[] = [];

    if (last.includes('continuity')) {
      toolCalls = [{ id: 'mock-continuity', name: 'check_continuity', args: {} }];
    } else if (last.includes('branch') || last.includes('reachable')) {
      toolCalls = [{ id: 'mock-branch', name: 'explain_branch', args: { sceneId } }];
    } else if (last.includes('invalid')) {
      // Deliberately broken proposal so the review workflow can demonstrate the
      // "same error path as manual edits" acceptance criterion.
      toolCalls = [{ id: 'mock-invalid', name: 'add_dialogue_block', args: { sceneId: 'scene-does-not-exist', text: 'broken' } }];
    } else if (last.includes('all')) {
      // Two proposals at once, to exercise the "Accept all" review button.
      toolCalls = [
        { id: 'mock-all-1', name: 'add_dialogue_block', args: { sceneId, characterId: firstChar, text: 'A second suggested line.', insertAtIndex: 0 } },
        { id: 'mock-all-2', name: 'add_choice_block', args: { sceneId, prompt: 'Where to next?', options: [{ text: 'Continue', destinationSceneId: null }] } },
      ];
    } else if (last.includes('choice')) {
      toolCalls = [{
        id: 'mock-choice',
        name: 'add_choice_block',
        args: { sceneId, prompt: 'What do you want to do?', options: [{ text: 'Stay', destinationSceneId: null }, { text: 'Leave', destinationSceneId: null }] },
      }];
    } else if (last.includes('scene')) {
      toolCalls = [{ id: 'mock-scene', name: 'add_scene', args: { title: 'new_chapter' } }];
    } else if (last.includes('character')) {
      toolCalls = [{ id: 'mock-char', name: 'create_character', args: { name: 'Robin', defaultPosition: 'center' } }];
    } else if (last.includes('variable')) {
      toolCalls = [{ id: 'mock-var', name: 'create_variable', args: { name: 'player_trust', displayName: 'Trust', type: 'relationship', defaultValue: 0, minValue: 0, maxValue: 100 } }];
    } else {
      toolCalls = [{
        id: 'mock-dialogue',
        name: 'add_dialogue_block',
        args: { sceneId, characterId: firstChar, text: 'Here is a suggested line of dialogue.', insertAtIndex: 0 },
      }];
    }

    return { text, toolCalls };
  },
};

// ProjectVNE Cloud: optional, metered, opt-in cloud AI. It appears as one more
// entry in the same provider picker (§4.1) rather than a separately-styled
// upsell. "Bring your own key" providers remain free; cloud usage meters
// credits. The actual inference endpoint is a cloud service (contract in
// docs/cloud-services.md); the offline mock below produces the same reviewable
// proposals so the workflow is testable, but meters a credit per request.
const cloudAdapter: AiAdapter = {
  id: 'cloud',
  label: 'ProjectVNE Cloud (metered)',
  requiresKey: false,
  defaultModel: 'cloud-v1',
  modelHint: 'metered cloud inference, no key needed',
  async send(req) {
    const remaining = spendCredits(COST_PER_CLOUD_REQUEST);
    if (remaining === null) {
      const balance = loadCredits().balance;
      throw new Error(
        balance > 0
          ? `Not enough ProjectVNE Cloud credits (balance ${balance}). Add credits, or switch to a bring-your-own-key provider which stays free.`
          : 'No ProjectVNE Cloud credits. Opt in and add credits in AI settings, or use a bring-your-own-key provider which stays free.',
      );
    }
    // Mirror the mock provider's deterministic proposal logic so the workflow is
    // fully testable offline. A real deployment would call the cloud inference
    // endpoint here.
    const last = req.messages[req.messages.length - 1]?.content?.toLowerCase() || '';
    const ctx = req.context;
    const sceneId = ctx.sceneId || Object.keys(ctx.project.scenes)[0] || null;
    const firstChar = Object.keys(ctx.project.characters)[0] || null;
    let toolCalls: AiToolCall[] = [];
    if (last.includes('continuity')) {
      toolCalls = [{ id: 'cloud-continuity', name: 'check_continuity', args: {} }];
    } else if (last.includes('branch') || last.includes('reachable')) {
      toolCalls = [{ id: 'cloud-branch', name: 'explain_branch', args: { sceneId } }];
    } else {
      toolCalls = [{
        id: 'cloud-dialogue',
        name: 'add_dialogue_block',
        args: { sceneId, characterId: firstChar, text: 'A cloud-drafted line of dialogue.', insertAtIndex: 0 },
      }];
    }
    return {
      text: 'Cloud draft ready. Review each card and accept or reject it before it is applied. This request cost 1 credit.',
      toolCalls,
    };
  },
};

export const adapters: AiAdapter[] = [
  anthropicAdapter,
  openAiAdapter,
  googleAdapter,
  ollamaAdapter,
  mockAdapter,
  cloudAdapter,
];

export function getAdapter(providerId: AiProviderId): AiAdapter {
  return adapters.find(a => a.id === providerId) || mockAdapter;
}

export function getAdapterList(): AiAdapter[] {
  return adapters;
}