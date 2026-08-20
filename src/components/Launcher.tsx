import React, { useState } from "react";
import { Plus, FolderOpen, BookOpen, Clock, FileText, ArrowRight, Settings, ShoppingBag, Package, Sun, Moon, LayoutGrid } from "lucide-react";
import type { PluginHost } from "../plugins";
import type { ProjectIR } from "../shared/types";
import { PluginManager } from "./PluginManager";
import { MarketplaceModal } from "./MarketplaceModal";

interface LauncherProps {
  onNewProject: () => void;
  onOpenProject: (file: File) => void;
  onOpenRecent: (projectData: any) => void;
  recentProjects: Array<{ id: string; title: string; modifiedAt: string; thumbnail?: string; projectData: string }>;
  onSelectTemplate: (template: "blank" | "demo") => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  pluginHost: PluginHost;
  project: ProjectIR;
  onTogglePlugin: (id: string, enabled: boolean) => void;
  onInstalledChange: () => void;
}

export const Launcher: React.FC<LauncherProps> = ({
  onNewProject,
  onOpenProject,
  onOpenRecent,
  recentProjects,
  onSelectTemplate,
  theme,
  onToggleTheme,
  onOpenSettings,
  pluginHost,
  project,
  onTogglePlugin,
  onInstalledChange
}) => {
  const [activeTab, setActiveTab] = useState<"projects" | "plugins" | "marketplace">("projects");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenProject(file);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden select-none">
      {/* TOP LAUNCHER BAR */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-black text-black text-sm shadow-md">
              VN
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">ProjectVNE Studio</div>
              <div className="text-[10px] text-[var(--text-muted)]">Visual Novel Authoring Engine & Runtime</div>
            </div>
          </div>

          {/* LAUNCHER NAVIGATION TABS */}
          <nav className="flex items-center bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border-subtle)] gap-1">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "projects"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}
            >
              <LayoutGrid size={13} />
              <span>Projects</span>
            </button>
            <button
              onClick={() => setActiveTab("marketplace")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "marketplace"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}
            >
              <ShoppingBag size={13} />
              <span>Marketplace</span>
            </button>
            <button
              onClick={() => setActiveTab("plugins")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "plugins"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}
            >
              <Package size={13} />
              <span>Installed Plugins</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5"
          >
            <FolderOpen size={13} />
            <span>Open JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={onNewProject}
            className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:brightness-110 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus size={13} strokeWidth={3} />
            <span>New Story</span>
          </button>

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

          <button
            onClick={onOpenSettings}
            className="p-2 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors border border-transparent hover:border-[var(--border-subtle)]"
            title="Studio Settings"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={onToggleTheme}
            className="p-2 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors border border-transparent hover:border-[var(--border-subtle)]"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === "projects" && (
            <div className="space-y-8">
              {/* BANNER / HERO */}
              <div className="rounded-2xl p-6 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-surface)] to-[var(--bg-card)] border border-[var(--border-default)] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--green-dim)] text-[var(--green-text)] border border-[var(--green-border)] inline-block uppercase tracking-wider">
                    Version 0.1.0 Ready
                  </span>
                  <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                    Create Branching Stories & Visual Novels
                  </h1>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Featuring interactive node graphs, Pixi.js hardware-accelerated playback, AI co-authoring assistance, sandboxed plugin system, and 1-click Web/Android export.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <button
                    onClick={() => onSelectTemplate("demo")}
                    className="px-4 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-left hover:border-[var(--accent)] transition-all group"
                  >
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span>Explore Demo Story</span>
                      <ArrowRight size={12} className="text-[var(--accent)] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">Preloaded sample characters, choices & variables.</div>
                  </button>
                  <button
                    onClick={() => onSelectTemplate("blank")}
                    className="px-4 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-left hover:border-[var(--accent)] transition-all group"
                  >
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span>Blank Canvas</span>
                      <Plus size={12} className="text-[var(--text-ghost)] group-hover:rotate-90 transition-transform" />
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">Start fresh from scratch.</div>
                  </button>
                </div>
              </div>

              {/* RECENT PROJECTS SECTION */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-ghost)] flex items-center gap-2">
                    <Clock size={13} />
                    <span>Recent Projects</span>
                  </h2>
                </div>

                {recentProjects.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                    <BookOpen size={28} className="mx-auto opacity-30 text-[var(--text-ghost)]" />
                    <div>No recent projects saved on this machine.</div>
                    <div className="text-[10px] text-[var(--text-ghost)]">Create a new story or load a project JSON to begin.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentProjects.map((item) => {
                      let parsed: any = null;
                      try { parsed = JSON.parse(item.projectData); } catch {}

                      return (
                        <div
                          key={item.id}
                          onClick={() => parsed && onOpenRecent(parsed)}
                          className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-panel)] hover:bg-[var(--bg-card)] hover:border-[var(--accent)] p-4 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
                        >
                          <div>
                            <div className="h-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-3 flex flex-col items-center justify-center text-[10px] text-[var(--text-ghost)] group-hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
                              <FileText size={28} className="opacity-40 mb-1" />
                              <span>{Object.keys(parsed?.scenes || {}).length} Scenes</span>
                            </div>
                            <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              Edited {new Date(item.modifiedAt).toLocaleDateString()} at {new Date(item.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                            <span>Open Story</span>
                            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform text-[var(--accent)]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "marketplace" && (
            <div className="w-full">
              <MarketplaceModal
                onClose={() => setActiveTab("projects")}
                onInstalledChange={onInstalledChange}
              />
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-panel)] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Installed Extensions & Plugins</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage node capabilities, importers, and gameplay scripts.</p>
                </div>
              </div>
              <PluginManager host={pluginHost} project={project} onTogglePlugin={onTogglePlugin} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
