import { AiSettings, type AiSettingsProps } from './AiSettings';

interface SettingsModalProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  aiSettings: AiSettingsProps;
}

const modalWrap = "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50";
const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl p-5 max-w-md w-full flex flex-col gap-4 shadow-xl";

// General app settings. The AI section reuses the exact same shared component as
// the AI panel's own settings, so there is one source of truth.
export function SettingsModal({ onClose, theme, toggleTheme, aiSettings }: SettingsModalProps) {
  return (
    <div className={modalWrap}>
      <div className={modalBox} data-testid="settings-modal">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Settings</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs font-semibold px-2 py-1 rounded hover:bg-[var(--bg-hover)]">Close</button>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] mb-2">Appearance</div>
          <div className="flex gap-1.5">
            {([['dark', 'Dark'], ['light', 'Light']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => { if (theme !== value) toggleTheme(); }}
                className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                  theme === value
                    ? "bg-[var(--bg-card)] border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] mb-2">AI Assistant</div>
          <AiSettings {...aiSettings} />
        </div>
      </div>
    </div>
  );
}