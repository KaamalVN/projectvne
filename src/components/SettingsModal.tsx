import { useState } from "react";
import { AiSettings, type AiSettingsProps } from "./AiSettings";
import { Sliders, Sparkles, Palette, Keyboard, X } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  aiSettings: AiSettingsProps;
  initialTab?: "general" | "appearance" | "ai" | "shortcuts";
  projectTitle?: string;
  onUpdateProjectTitle?: (title: string) => void;
}

const modalWrap = "fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100";
const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl w-full max-w-2xl h-[560px] flex flex-col shadow-2xl overflow-hidden";

export function SettingsModal({
  onClose,
  theme,
  toggleTheme,
  aiSettings,
  initialTab = "general",
  projectTitle = "Visual Novel Project",
  onUpdateProjectTitle
}: SettingsModalProps) {
  const [tab, setTab] = useState<"general" | "appearance" | "ai" | "shortcuts">(initialTab);
  const [title, setTitle] = useState(projectTitle);

  const shortcutsList = [
    { key: "Ctrl + S", desc: "Save Project to Local Storage & file download" },
    { key: "Ctrl + Z", desc: "Undo last modification" },
    { key: "Ctrl + Y", desc: "Redo undone action" },
    { key: "Ctrl + E", desc: "Open Game Export dialog (Web / Android / Cloud)" },
    { key: "Delete / Backspace", desc: "Delete selected node / block in story graph" },
    { key: "F5", desc: "Start / Stop Live Game Preview" },
    { key: "1 / 2 / 3 / 4", desc: "Switch view: Storyboard, Scene Graph, Project Flow, Script" },
    { key: "Ctrl + B", desc: "Toggle Left Project Sidebar" },
    { key: "Ctrl + J", desc: "Toggle Bottom Preview / Console Dock" },
    { key: "Ctrl + I", desc: "Toggle Right Node Inspector" },
    { key: "Escape", desc: "Close open modal / context menu" },
  ];

  return (
    <div className={modalWrap} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalBox} data-testid="settings-modal">
        {/* HEADER */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Studio & Project Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDE TABS */}
          <div className="w-48 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] p-2 space-y-1">
            <button
              onClick={() => setTab("general")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                tab === "general"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Sliders size={14} />
              <span>General</span>
            </button>

            <button
              onClick={() => setTab("ai")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                tab === "ai"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Sparkles size={14} className="text-[var(--accent)]" />
              <span>AI Provider & Keys</span>
            </button>

            <button
              onClick={() => setTab("appearance")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                tab === "appearance"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Palette size={14} />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => setTab("shortcuts")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                tab === "shortcuts"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Keyboard size={14} />
              <span>Shortcuts</span>
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-panel)] text-xs text-[var(--text-secondary)]">
            {tab === "general" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-2">Project Identity</h4>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">Story Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      onUpdateProjectTitle?.(e.target.value);
                    }}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                  />
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)]">Target Canvas Resolution</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {["800x600 (Classic 4:3)", "1280x720 (HD 16:9)", "1920x1080 (FHD 16:9)"].map((res, i) => (
                      <div
                        key={res}
                        className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer ${
                          i === 0 ? "border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {res}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)]">Engine Defaults</h4>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <span>Auto-save project state locally</span>
                    <input type="checkbox" defaultChecked className="accent-[var(--accent)]" />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <span>Hardware WebGL / Pixi acceleration</span>
                    <input type="checkbox" defaultChecked className="accent-[var(--accent)]" />
                  </div>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div className="space-y-4">
                <div className="text-[11px] text-[var(--text-muted)]">
                  Configure your LLM providers (Gemini, OpenAI, Claude, OpenRouter, Ollama) and manage local API keys securely.
                </div>
                <AiSettings {...aiSettings} />
              </div>
            )}

            {tab === "appearance" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-2">Theme Mode</h4>
                  <div className="flex gap-2">
                    {([["dark", "Dark Theme (Studio Default)"], ["light", "Light Theme"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => { if (theme !== val) toggleTheme(); }}
                        className={`flex-1 p-3 rounded-lg border text-xs font-semibold transition-colors ${
                          theme === val
                            ? "bg-[var(--bg-card)] border-[var(--accent)] text-[var(--text-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "shortcuts" && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1.5">
                  {shortcutsList.map((sc) => (
                    <div
                      key={sc.key}
                      className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                    >
                      <span className="text-[var(--text-secondary)]">{sc.desc}</span>
                      <kbd className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-[10px] text-[var(--accent)]">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2 bg-[var(--bg-surface)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
