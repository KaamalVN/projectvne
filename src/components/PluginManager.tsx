import React from "react";
import type { PluginHost, NodeViewModel } from "../plugins";
import type { ProjectIR } from "../shared/types";
import { PluginViewModelView } from "./PluginViewModel";

interface PluginManagerProps {
  host: PluginHost;
  project: ProjectIR;
  onTogglePlugin: (id: string, enabled: boolean) => void;
}

function capabilityLabel(cap: { kind: string; scope?: unknown }): string {
  if (cap.kind === "ir.read" || cap.kind === "ir.write") {
    const scope = cap.scope as string | string[] | undefined;
    let suffix = "";
    if (scope === "all") suffix = ":all";
    else if (Array.isArray(scope)) suffix = ":" + scope.join("+");
    return `${cap.kind}${suffix}`;
  }
  return cap.kind;
}

function safeView(view: (project: ProjectIR) => NodeViewModel, project: ProjectIR): { vm?: NodeViewModel; error?: string } {
  try {
    const vm = view(project);
    return vm ? { vm } : { error: "Panel returned no content." };
  } catch (err) {
    return { error: `Panel crashed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export const PluginManager: React.FC<PluginManagerProps> = ({ host, project, onTogglePlugin }) => {
  const plugins = host.getPlugins();
  const missing = host.getMissingCapabilities(project);
  const panels = host.getPanels();

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-1">
          Installed Plugins
        </span>
        <div className="text-[10px] text-[var(--text-muted)] mb-2">
          Plugin code runs in a sandbox and can only use the capabilities it declares. Disabling a plugin that a story
          uses produces a clear "missing capability" state, never a crash.
        </div>
        {plugins.length === 0 && (
          <div className="text-[var(--text-ghost)] italic text-center py-6 text-[11px]">No plugins installed.</div>
        )}
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.manifest.id}
              className={`p-2.5 rounded-lg border ${
                plugin.enabled ? "bg-[var(--bg-surface)] border-[var(--border-subtle)]" : "bg-[var(--bg-input)] border-[var(--border-subtle)] opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[var(--text-primary)]">{plugin.manifest.name}</div>
                  <div className="text-[9px] font-mono text-[var(--text-ghost)]">
                    {plugin.manifest.id} · v{plugin.manifest.version}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] shrink-0 cursor-pointer">
                  <span>{plugin.enabled ? "On" : "Off"}</span>
                  <input
                    type="checkbox"
                    data-testid={`plugin-toggle-${plugin.manifest.id}`}
                    checked={plugin.enabled}
                    onChange={(e) => onTogglePlugin(plugin.manifest.id, e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                </label>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">{plugin.manifest.description}</div>
              {plugin.loadError ? (
                <div className="mt-1.5 text-[10px] text-[var(--error-text)]">Load error: {plugin.loadError}</div>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(plugin.manifest.capabilities || []).map((cap, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-md"
                    >
                      {capabilityLabel(cap)}
                    </span>
                  ))}
                  {(!plugin.manifest.capabilities || plugin.manifest.capabilities.length === 0) && (
                    <span className="text-[9px] text-[var(--text-ghost)]">no capabilities</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-1">
          Missing Capabilities
        </span>
        {missing.length === 0 ? (
          <div className="p-3 bg-[var(--green-dim)] border border-[var(--green-border)] rounded-lg text-[var(--green-text)] text-[11px] text-center font-medium">
            ✓ All story blocks have their plugins enabled
          </div>
        ) : (
          <div className="space-y-1.5">
            {missing.map((m, idx) => (
              <div key={idx} className="p-2 bg-[var(--amber-dim)] border border-[var(--amber-border)] rounded-lg text-[10px]">
                <div className="font-semibold text-[var(--amber-text)]">
                  Block "{m.blockType}" in "{project.scenes[m.sceneId]?.title || m.sceneId}"
                </div>
                <div className="text-[var(--text-muted)] mt-0.5">
                  Needs the "{m.pluginId}" plugin, which is disabled. Enable it to keep playing this block.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {panels.length > 0 && (
        <div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-1">
            Plugin Panels
          </span>
          <div className="space-y-2">
            {panels.map(({ def }) => {
              const rendered = safeView(def.view, project);
              return (
                <div key={def.title} className="p-2.5 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                  <div className="text-[11px] font-bold text-[var(--text-primary)] mb-1.5">{def.title}</div>
                  {rendered.error ? (
                    <div className="text-[10px] text-[var(--error-text)]">{rendered.error}</div>
                  ) : (
                    <PluginViewModelView vm={rendered.vm!} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};