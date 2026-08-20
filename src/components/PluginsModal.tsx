import React from "react";
import type { PluginHost } from "../plugins";
import type { ProjectIR } from "../shared/types";
import { PluginManager } from "./PluginManager";
import { Package, X, AlertTriangle } from "lucide-react";

interface PluginsModalProps {
  onClose: () => void;
  host: PluginHost;
  project: ProjectIR;
  onTogglePlugin: (id: string, enabled: boolean) => void;
  onOpenMarketplace: () => void;
}

const modalWrap = "fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100";
const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl w-full max-w-3xl h-[600px] flex flex-col shadow-2xl overflow-hidden";

export const PluginsModal: React.FC<PluginsModalProps> = ({
  onClose,
  host,
  project,
  onTogglePlugin,
  onOpenMarketplace
}) => {
  const missing = host.getMissingCapabilities(project);

  return (
    <div className={modalWrap} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalBox} data-testid="plugins-modal">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center">
              <Package size={18} className="text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Plugin Manager</h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                Manage installed extensions, custom node types, importers, and sandboxed scripting tools
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-panel)]">
          {missing.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-dim)] text-xs text-[var(--amber-text)] flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Missing Capabilities Detected</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Current story references nodes requiring: {missing.join(", ")}. Enable the corresponding plugins to resolve.
                </div>
              </div>
            </div>
          )}

          <PluginManager host={host} project={project} onTogglePlugin={onTogglePlugin} />
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)] text-xs">
          <button
            onClick={() => { onClose(); onOpenMarketplace(); }}
            className="text-[var(--accent)] hover:underline font-semibold"
          >
            Browse Marketplace for more plugins →
          </button>
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
};
