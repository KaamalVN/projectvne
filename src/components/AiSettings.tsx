import { useEffect, useState } from 'react';
import { getAdapter, getAdapterList } from '../ai/adapters';
import type { AiPreferences } from '../ai/preferences';

export interface AiSettingsProps {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  prefs: AiPreferences;
  setPrefs: (patch: Partial<AiPreferences>) => void;
  keys: Record<string, string>;
  loadKey: (providerId: string) => Promise<string | null>;
  saveKey: (providerId: string, value: string) => Promise<void>;
  storageMode: string;
}

const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]";

// The single, shared AI settings surface. Used by both the AI panel and the
// general Settings modal so there is never a second, divergent copy.
export function AiSettings({ enabled, onToggleEnabled, prefs, setPrefs, keys, loadKey, saveKey, storageMode }: AiSettingsProps) {
  const adapter = getAdapter(prefs.providerId);
  const [keyDraft, setKeyDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (adapter.requiresKey && !keys[prefs.providerId]) {
      loadKey(prefs.providerId).then(v => { if (v) setKeyDraft(v); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.providerId]);

  const handleSaveKey = async () => {
    await saveKey(prefs.providerId, keyDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-3 text-[11px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-[var(--text-primary)]">AI Assistant</div>
          <div className="text-[10px] text-[var(--text-muted)]">Per-project opt-in. Off until you enable it.</div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Enable AI Assistant"
          onClick={() => onToggleEnabled(!enabled)}
          className={`relative w-9 h-5 rounded-full transition-colors border ${enabled ? "bg-[var(--green-bg)] border-[var(--green-border)]" : "bg-[var(--bg-card)] border-[var(--border-default)]"}`}
        >
          <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${enabled ? "left-[18px] bg-[var(--green-text)]" : "left-0.5 bg-[var(--text-ghost)]"}`} />
        </button>
      </div>

      {!enabled ? (
        <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          AI suggestions are off for this project. No AI controls appear in the editor and no requests are ever made.
        </div>
      ) : (
        <>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Provider</label>
            <select className={inputCls} value={prefs.providerId} onChange={e => setPrefs({ providerId: e.target.value as AiPreferences['providerId'] })}>
              {getAdapterList().map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Model</label>
            <input
              className={inputCls}
              value={prefs.model}
              onChange={e => setPrefs({ model: e.target.value })}
              placeholder={adapter.modelHint}
            />
          </div>

          {adapter.requiresKey && (
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">API Key</label>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  className={inputCls}
                  value={keyDraft}
                  onChange={e => { setKeyDraft(e.target.value); setSaved(false); }}
                  placeholder="sk-..."
                />
                <button onClick={handleSaveKey} className="shrink-0 px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded text-xs text-[var(--text-primary)]">
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
              <div className="text-[9px] text-[var(--text-ghost)] mt-1">
                Stored in your {storageMode === 'keychain' ? 'OS keychain' : 'browser storage (web build)'}. Never written into the project file.
              </div>
            </div>
          )}

          {prefs.providerId === 'ollama' && (
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">Ollama endpoint</label>
              <input
                className={inputCls}
                value={prefs.ollamaEndpoint}
                onChange={e => setPrefs({ ollamaEndpoint: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          {prefs.providerId === 'mock' && (
            <div className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md p-2">
              Offline demo provider — returns deterministic suggestions so you can try the review workflow without a network or API key.
            </div>
          )}
        </>
      )}
    </div>
  );
}