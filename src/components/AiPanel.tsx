import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Check, X, Settings, ChevronDown, ChevronRight, Activity, GitBranch } from 'lucide-react';
import type { ProjectIR } from '../shared/types';
import type { IRCommand } from '../commands/command-types';
import type { AiPreferences } from '../ai/preferences';
import { runAiTurn, checkContinuityText, explainBranchText } from '../ai/service';
import { AiSettings } from './AiSettings';

interface PendingProposal {
  id: string;
  title: string;
  description: string;
  command: IRCommand;
  status: 'pending' | 'accepted' | 'rejected' | 'failed';
  error?: string;
}

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  notes: string[];
  errors: string[];
  proposals: PendingProposal[];
}

interface AiPanelProps {
  project: ProjectIR;
  selectedSceneId: string | null;
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  prefs: AiPreferences;
  setPrefs: (patch: Partial<AiPreferences>) => void;
  keys: Record<string, string>;
  loadKey: (providerId: string) => Promise<string | null>;
  saveKey: (providerId: string, value: string) => Promise<void>;
  storageMode: string;
  onApplyCommand: (command: IRCommand) => boolean;
  onOpenSettings: () => void;
}

const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]";

export function AiPanel(props: AiPanelProps) {
  const { project, selectedSceneId, enabled, onToggleEnabled, prefs, setPrefs, keys, loadKey, saveKey, storageMode, onApplyCommand, onOpenSettings } = props;

  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sceneIdForContext = prefs.scope === 'scene' ? selectedSceneId : null;

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');

    const userItem: ChatItem = { id: uid(), role: 'user', text: prompt, notes: [], errors: [], proposals: [] };
    setMessages(prev => [...prev, userItem]);
    setLoading(true);

    const history = [...messages, userItem]
      .filter(m => m.text.trim().length > 0)
      .map(m => ({ role: m.role, content: m.text }));

    const result = await runAiTurn({
      project,
      scope: prefs.scope,
      sceneId: sceneIdForContext,
      providerId: prefs.providerId,
      model: prefs.model,
      apiKey: keys[prefs.providerId],
      ollamaEndpoint: prefs.ollamaEndpoint,
      messages: history,
    });

    setMessages(prev => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        text: result.text || '',
        notes: result.notes,
        errors: result.errors,
        proposals: result.proposals.map(p => ({ ...p, status: 'pending' as const })),
      },
    ]);
    setLoading(false);
  };

  const resolveProposal = (itemId: string, proposalId: string, action: 'accept' | 'reject') => {
    setMessages(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          proposals: item.proposals.map(p => {
            if (p.id !== proposalId) return p;
            if (action === 'reject') return { ...p, status: 'rejected' as const };
            const ok = onApplyCommand(p.command);
            return ok ? { ...p, status: 'accepted' as const } : { ...p, status: 'failed' as const, error: 'Command validation failed' };
          }),
        };
      }),
    );
  };

  const acceptAll = (itemId: string) => {
    setMessages(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          proposals: item.proposals.map(p => {
            if (p.status !== 'pending') return p;
            const ok = onApplyCommand(p.command);
            return ok ? { ...p, status: 'accepted' as const } : { ...p, status: 'failed' as const, error: 'Command validation failed' };
          }),
        };
      }),
    );
  };

  const runLocal = (kind: 'continuity' | 'branch') => {
    const note = kind === 'continuity'
      ? checkContinuityText(project, prefs.scope, sceneIdForContext)
      : explainBranchText(project, selectedSceneId);
    setMessages(prev => [...prev, { id: uid(), role: 'assistant', text: '', notes: [note], errors: [], proposals: [] }]);
  };

  if (!enabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" data-testid="ai-panel-disabled">
        <Sparkles size={20} className="text-[var(--text-ghost)] mb-3" />
        <div className="text-[12px] font-bold text-[var(--text-primary)] mb-1">AI Assistant</div>
        <div className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-4">
          AI-assisted editing is off for this project. Every AI suggestion is reviewed before it is applied, and nothing is ever sent unless you ask.
        </div>
        <button
          data-testid="ai-enable"
          onClick={() => onToggleEnabled(true)}
          className="px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md text-xs text-[var(--text-primary)] font-semibold"
        >
          Enable AI Assistant
        </button>
        <button onClick={onOpenSettings} className="mt-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1">
          <Settings size={10} /> Provider &amp; settings
        </button>
      </div>
    );
  }

  const pendingCount = (item: ChatItem) => item.proposals.filter(p => p.status === 'pending').length;

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="ai-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <button onClick={() => setShowSettings(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] hover:text-[var(--text-muted)] transition-colors">
          {showSettings ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Sparkles size={10} /> AI Assistant
        </button>
        <button onClick={onOpenSettings} className="text-[var(--text-ghost)] hover:text-[var(--text-secondary)] transition-colors" title="Open general settings">
          <Settings size={12} />
        </button>
      </div>

      {/* Scope + settings */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center gap-1">
          {([['scene', 'Scene'], ['project', 'Project']] as const).map(([value, label]) => (
            <button
              key={value}
              data-testid={`ai-scope-${value}`}
              onClick={() => setPrefs({ scope: value })}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors border ${
                prefs.scope === value ? "bg-[var(--bg-card)] border-[var(--accent)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[var(--text-ghost)]">{prefs.providerId}</span>
        </div>
        {showSettings && (
          <div className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg" data-testid="ai-settings">
            <AiSettings
              enabled={enabled}
              onToggleEnabled={onToggleEnabled}
              prefs={prefs}
              setPrefs={setPrefs}
              keys={keys}
              loadKey={loadKey}
              saveKey={saveKey}
              storageMode={storageMode}
            />
          </div>
        )}
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
        {messages.length === 0 && (
          <div className="text-center py-8 text-[var(--text-ghost)] italic">
            Ask the assistant to write dialogue, add a choice, check continuity, or explain a branch.
          </div>
        )}

        {messages.map(item => (
          <div key={item.id} className="space-y-2" data-testid={item.role === 'user' ? 'ai-user-message' : 'ai-assistant-message'}>
            {item.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-1.5 bg-[var(--green-dim)] border border-[var(--green-border)] text-[var(--text-primary)] rounded-lg rounded-br-sm whitespace-pre-wrap">
                  {item.text}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {item.text && (
                  <div className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-lg rounded-bl-sm whitespace-pre-wrap">
                    {item.text}
                  </div>
                )}

                {item.notes.map((note, i) => (
                  <div key={i} className="px-2.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md text-[10px] text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed" data-testid="ai-note">
                    {note}
                  </div>
                ))}

                {item.errors.map((err, i) => (
                  <div key={i} className="px-2.5 py-1.5 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-md text-[10px] text-[var(--error-text)]" data-testid="ai-error">
                    {err}
                  </div>
                ))}

                {item.proposals.length > 0 && (
                  <div className="space-y-1.5" data-testid="proposal-batch">
                    {pendingCount(item) > 1 && (
                      <button
                        data-testid="ai-accept-all"
                        onClick={() => acceptAll(item.id)}
                        className="w-full px-2 py-1 bg-[var(--green-dim)] hover:brightness-110 border border-[var(--green-border)] text-[var(--green-text)] rounded-md text-[10px] font-semibold transition-all"
                      >
                        Accept all ({pendingCount(item)})
                      </button>
                    )}
                    {item.proposals.map(p => (
                      <div key={p.id} className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg" data-testid="proposal-card" data-status={p.status}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-[var(--text-primary)]">{p.title}</div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{p.description}</div>
                          </div>
                          {p.status === 'pending' ? (
                            <div className="flex gap-1 shrink-0">
                              <button
                                data-testid="proposal-accept"
                                onClick={() => resolveProposal(item.id, p.id, 'accept')}
                                className="p-1.5 bg-[var(--green-dim)] hover:brightness-110 border border-[var(--green-border)] text-[var(--green-text)] rounded-md transition-all"
                                title="Accept"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                data-testid="proposal-reject"
                                onClick={() => resolveProposal(item.id, p.id, 'reject')}
                                className="p-1.5 bg-[var(--error-bg)] hover:brightness-110 border border-[var(--error-border)] text-[var(--error-text)] rounded-md transition-all"
                                title="Reject"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                              p.status === 'accepted'
                                ? "text-[var(--green-text)] border-[var(--green-border)] bg-[var(--green-dim)]"
                                : p.status === 'failed'
                                  ? "text-[var(--error-text)] border-[var(--error-border)] bg-[var(--error-bg)]"
                                  : "text-[var(--text-ghost)] border-[var(--border-subtle)] bg-[var(--bg-card)]"
                            }`}>
                              {p.status}
                            </span>
                          )}
                        </div>
                        {p.status === 'failed' && p.error && (
                          <div className="mt-1.5 text-[9px] text-[var(--error-text)]">{p.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-ghost)]" data-testid="ai-loading">
            <Sparkles size={11} className="animate-pulse" /> Consulting provider…
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-3 py-1.5 border-t border-[var(--border-subtle)] flex gap-1.5">
        <button data-testid="ai-continuity" onClick={() => runLocal('continuity')} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md text-[9px] text-[var(--text-muted)] transition-colors">
          <Activity size={9} /> Check continuity
        </button>
        <button data-testid="ai-branch" onClick={() => runLocal('branch')} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md text-[9px] text-[var(--text-muted)] transition-colors">
          <GitBranch size={9} /> Explain branch
        </button>
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
        <div className="flex gap-1.5">
          <textarea
            data-testid="ai-input"
            rows={2}
            className={inputCls + " resize-none"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask for dialogue, a choice branch, a continuity check…"
          />
          <button data-testid="ai-send" onClick={send} disabled={loading || !input.trim()}
            className="shrink-0 px-3 py-1.5 bg-[var(--accent)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--bg-app)] rounded-md transition-all" title="Send">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}