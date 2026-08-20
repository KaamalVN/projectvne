import React, { useState, useEffect, useRef } from "react";
import {
  FolderPlus,
  FolderOpen,
  Save,
  Download,
  LogOut,
  Undo2,
  Redo2,
  Sliders,
  Sparkles,
  Package,
  Layers,
  Split,
  FolderTree,
  FileCode,
  Layout,
  Plus,
  ShoppingBag,
  Play,
  Keyboard,
  Info
} from "lucide-react";

export interface MenuBarProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onExportProject: () => void;
  onBackToLauncher: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSettings: (initialTab?: "general" | "appearance" | "ai" | "shortcuts") => void;
  onOpenPlugins: () => void;
  onOpenMarketplace: () => void;
  activeViewMode: "storyboard" | "graph" | "project" | "script";
  onChangeViewMode: (mode: "storyboard" | "graph" | "project" | "script") => void;
  onToggleLeftDock: () => void;
  onToggleRightDock: () => void;
  onToggleBottomDock: () => void;
  onResetLayout: () => void;
  onAddScene: () => void;
  onAddDialogue: () => void;
  onAddChoice: () => void;
  onAddCharacter: () => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onExportProject,
  onBackToLauncher,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSettings,
  onOpenPlugins,
  onOpenMarketplace,
  activeViewMode,
  onChangeViewMode,
  onToggleLeftDock,
  onToggleRightDock,
  onToggleBottomDock,
  onResetLayout,
  onAddScene,
  onAddDialogue,
  onAddChoice,
  onAddCharacter,
  onTogglePlay,
  isPlaying
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const handleMenuHover = (menu: string) => {
    if (openMenu !== null) {
      setOpenMenu(menu);
    }
  };

  const closeMenu = () => setOpenMenu(null);

  return (
    <div ref={menuBarRef} className="flex items-center text-xs relative select-none">
      {/* FILE MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("file")}
          onMouseEnter={() => handleMenuHover("file")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "file"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          File
        </button>
        {openMenu === "file" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              onClick={() => { onNewProject(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <FolderPlus size={12} className="text-[var(--text-muted)]" />
                <span>New Project</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+N</span>
            </button>
            <button
              onClick={() => { onOpenProject(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <FolderOpen size={12} className="text-[var(--text-muted)]" />
                <span>Open Project...</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+O</span>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onSaveProject(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Save size={12} className="text-[var(--text-muted)]" />
                <span>Save Project</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+S</span>
            </button>
            <button
              onClick={() => { onExportProject(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Download size={12} className="text-[var(--text-muted)]" />
                <span>Export Game...</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+E</span>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onBackToLauncher(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <LogOut size={12} className="text-[var(--text-muted)]" />
                <span>Close to Project Launcher</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* EDIT MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("edit")}
          onMouseEnter={() => handleMenuHover("edit")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "edit"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Edit
        </button>
        {openMenu === "edit" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              disabled={!canUndo}
              onClick={() => { onUndo(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Undo2 size={12} className="text-[var(--text-muted)]" />
                <span>Undo</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+Z</span>
            </button>
            <button
              disabled={!canRedo}
              onClick={() => { onRedo(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] disabled:opacity-40 text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Redo2 size={12} className="text-[var(--text-muted)]" />
                <span>Redo</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+Y</span>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onOpenPlugins(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Package size={12} className="text-[var(--text-muted)]" />
                <span>Plugins...</span>
              </div>
            </button>
            <button
              onClick={() => { onOpenSettings("general"); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Sliders size={12} className="text-[var(--text-muted)]" />
                <span>Project Settings...</span>
              </div>
            </button>
            <button
              onClick={() => { onOpenSettings("ai"); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-[var(--text-muted)]" />
                <span>AI Configuration...</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* VIEW MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("view")}
          onMouseEnter={() => handleMenuHover("view")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "view"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          View
        </button>
        {openMenu === "view" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              onClick={() => { onChangeViewMode("storyboard"); closeMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-left ${
                activeViewMode === "storyboard" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers size={12} className="text-[var(--text-muted)]" />
                <span>Storyboard View</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">1</span>
            </button>
            <button
              onClick={() => { onChangeViewMode("graph"); closeMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-left ${
                activeViewMode === "graph" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Split size={12} className="text-[var(--text-muted)]" />
                <span>Scene Graph</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">2</span>
            </button>
            <button
              onClick={() => { onChangeViewMode("project"); closeMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-left ${
                activeViewMode === "project" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderTree size={12} className="text-[var(--text-muted)]" />
                <span>Project Flow</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">3</span>
            </button>
            <button
              onClick={() => { onChangeViewMode("script"); closeMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-left ${
                activeViewMode === "script" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileCode size={12} className="text-[var(--text-muted)]" />
                <span>Script View</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">4</span>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onToggleLeftDock(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <span>Toggle Left Sidebar</span>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+B</span>
            </button>
            <button
              onClick={() => { onToggleBottomDock(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <span>Toggle Bottom Dock</span>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+J</span>
            </button>
            <button
              onClick={() => { onToggleRightDock(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <span>Toggle Right Sidebar</span>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">Ctrl+I</span>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onResetLayout(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Layout size={12} className="text-[var(--text-muted)]" />
                <span>Reset Layout</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* STORY / INSERT MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("story")}
          onMouseEnter={() => handleMenuHover("story")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "story"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Story
        </button>
        {openMenu === "story" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              onClick={() => { onAddScene(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-[var(--green-text)]" />
                <span>Add Scene</span>
              </div>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onAddDialogue(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-[var(--blue-text)]" />
                <span>Add Dialogue Block</span>
              </div>
            </button>
            <button
              onClick={() => { onAddChoice(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-[var(--amber-text)]" />
                <span>Add Choice Block</span>
              </div>
            </button>
            <button
              onClick={() => { onAddCharacter(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-[var(--violet-text)]" />
                <span>Add Character Block</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* TOOLS MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("tools")}
          onMouseEnter={() => handleMenuHover("tools")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "tools"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Tools
        </button>
        {openMenu === "tools" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              onClick={() => { onOpenMarketplace(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag size={12} className="text-[var(--text-muted)]" />
                <span>Marketplace & Assets...</span>
              </div>
            </button>
            <button
              onClick={() => { onOpenPlugins(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Package size={12} className="text-[var(--text-muted)]" />
                <span>Plugin Manager...</span>
              </div>
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={() => { onTogglePlay(); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Play size={12} className="text-[var(--green-text)] fill-current" />
                <span>{isPlaying ? "Stop Live Preview" : "Start Live Preview"}</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-ghost)]">F5</span>
            </button>
          </div>
        )}
      </div>

      {/* HELP MENU */}
      <div className="relative">
        <button
          onClick={() => handleMenuClick("help")}
          onMouseEnter={() => handleMenuHover("help")}
          className={`px-2.5 py-1 rounded transition-colors text-[11px] font-medium ${
            openMenu === "help"
              ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Help
        </button>
        {openMenu === "help" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 z-50 text-[11px]">
            <button
              onClick={() => { onOpenSettings("shortcuts"); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Keyboard size={12} className="text-[var(--text-muted)]" />
                <span>Keyboard Shortcuts</span>
              </div>
            </button>
            <button
              onClick={() => { onOpenSettings("general"); closeMenu(); }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-left"
            >
              <div className="flex items-center gap-2">
                <Info size={12} className="text-[var(--text-muted)]" />
                <span>About ProjectVNE Studio</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
