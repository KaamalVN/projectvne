import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PixiVisualNovelEngine, EngineState } from "./runtime/engine";
import {
  ProjectIR,
  createEmptyProject,
  ID,
  CharacterPosition,
  VariableType
} from "./shared/types";
import { generateSceneTextView } from "./shared/story-logic";
import {
  CommandInvoker,
  AddSceneCommand,
  AddDialogueBlockCommand,
  AddChoiceBlockCommand,
  AddShowCharacterBlockCommand,
  AddPluginBlockCommand,
  CreateCharacterCommand,
  CreateVariableCommand,
  CreateAssetCommand,
  RemoveBlockCommand
} from "./commands";
import { ProblemsChecker, StoryProblem } from "./shared/problems-checker";
import { MigrationRunner } from "./migrations/migration-runner";
import { StoryGraphCanvas } from "./components/StoryGraphCanvas";
import { ProjectFlowGraph } from "./components/ProjectFlowGraph";
import { ProjectExporter } from "./export/exporter";
import { validateWebConstraints, prepareWebExport } from "./export/web-export";
import { prepareAndroidExport } from "./export/android";
import { AiPanel } from "./components/AiPanel";
import { SettingsModal } from "./components/SettingsModal";
import { PluginsModal } from "./components/PluginsModal";
import { MarketplaceModal } from "./components/MarketplaceModal";
import { PluginManager } from "./components/PluginManager";
import { Launcher } from "./components/Launcher";
import { MenuBar } from "./components/MenuBar";
import { ResizableLayout } from "./components/ResizableLayout";
import { PluginViewModelView } from "./components/PluginViewModel";
import { useAiState } from "./ai/use-ai-state";
import { createDefaultPluginHost, setPluginEnabled, PluginHost } from "./plugins";
import type { IRCommand } from "./commands/command-types";

import {
  Play,
  Pause,
  FolderTree,
  FileCode,
  Layers,
  Split,
  ChevronDown,
  ChevronRight,
  Plus,
  Undo2,
  Redo2,
  Save,
  Terminal,
  Eye,
  Download,
  Sun,
  Moon,
  Settings,
  Trash2,
  LayoutGrid,
  ShoppingBag,
  Package,
  X,
  MessageSquare,
  User
} from "lucide-react";

export type ViewTabMode = "storyboard" | "graph" | "project" | "script" | "marketplace" | "plugins";

interface EditorTab {
  id: string;
  title: string;
  mode: ViewTabMode;
  closable?: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<"launcher" | "editor">("launcher");
  const [activeTabId, setActiveTabId] = useState<string>("storyboard");
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([
    { id: "storyboard", title: "Storyboard", mode: "storyboard", closable: false },
    { id: "graph", title: "Scene Graph", mode: "graph", closable: true },
    { id: "project", title: "Project Flow", mode: "project", closable: true },
    { id: "script", title: "Script View", mode: "script", closable: true },
  ]);

  const [project, setProject] = useState<ProjectIR>(createEmptyProject());
  const [invoker, setInvoker] = useState<CommandInvoker>(() => new CommandInvoker(createEmptyProject()));
  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

  // Inspector & Sidebars
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "variables" | "problems" | "debugger" | "ai">("inspector");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "appearance" | "ai" | "shortcuts">("general");
  const [showPluginsModal, setShowPluginsModal] = useState(false);
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Dock collapse states
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [bottomTab, setBottomTab] = useState<"preview" | "console">("preview");

  // AI & Plugins
  const aiState = useAiState();
  const { prefs, setPrefs, keys, loadKey, saveKey, storageMode } = aiState;
  const [pluginsVersion, setPluginsVersion] = useState(0);
  const pluginHost = useMemo<PluginHost>(() => createDefaultPluginHost(), [pluginsVersion]);
  const [pluginBlockModal, setPluginBlockModal] = useState<{
    blockType: string;
    pluginId?: string;
    title: string;
    fields: Array<{ key: string; label: string; type: "string" | "number" | "boolean"; value: string }>;
  } | null>(null);

  // Engine & Playback
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PixiVisualNovelEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [isPlayingLive, setIsPlayingLive] = useState<boolean>(false);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState<boolean>(false);
  const [exportWebReport, setExportWebReport] = useState<any>(null);

  // Logs & Problems
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; level: "info" | "warn" | "error"; msg: string }>>([]);
  const [problems, setProblems] = useState<StoryProblem[]>([]);

  // Project Tree Folders
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({
    stories: true,
    characters: false,
    backgrounds: false,
  });

  // Creation Modals
  const [showAddDialogueModal, setShowAddDialogueModal] = useState(false);
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [showAddCharacterBlockModal, setShowAddCharacterBlockModal] = useState(false);
  const [showNewSceneModal, setShowNewSceneModal] = useState(false);
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewVarModal, setShowNewVarModal] = useState(false);
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState<"blank" | "demo">("blank");
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; title: string; modifiedAt: string; thumbnail?: string; projectData: string }>>([]);

  // Form states
  const [dlgSpeakerId, setDlgSpeakerId] = useState<string>("");
  const [dlgText, setDlgText] = useState<string>("");
  const [choicePrompt, setChoicePrompt] = useState<string>("");
  const [choiceOpt1Text, setChoiceOpt1Text] = useState<string>("");
  const [choiceOpt1Dest, setChoiceOpt1Dest] = useState<string>("");
  const [choiceOpt2Text, setChoiceOpt2Text] = useState<string>("");
  const [choiceOpt2Dest, setChoiceOpt2Dest] = useState<string>("");
  const [charBlockId, setCharBlockId] = useState<string>("");
  const [charBlockExpr, setCharBlockExpr] = useState<string>("happy");
  const [charBlockPos, setCharBlockPos] = useState<CharacterPosition>("center");
  const [newSceneTitle, setNewSceneTitle] = useState<string>("");
  const [charName, setCharName] = useState<string>("");
  const [varName, setVarName] = useState<string>("");
  const [varType, setVarType] = useState<VariableType>("number");
  const [varDefault, setVarDefault] = useState<string>("0");
  const [varMinValue, setVarMinValue] = useState<string>("");
  const [varMaxValue, setVarMaxValue] = useState<string>("");
  const [varAllowedTags, setVarAllowedTags] = useState<string>("");

  // Global browser context menu suppression (prevent inspect element)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const addLog = (level: "info" | "warn" | "error", msg: string) => {
    const now = new Date();
    setConsoleLogs(prev => [{ time: now.toLocaleTimeString(), level, msg }, ...prev.slice(0, 49)]);
  };

  // Tab management (UE5 dockable tabs)
  const openOrFocusTab = (mode: ViewTabMode, title: string) => {
    setOpenTabs(prev => {
      const existing = prev.find(t => t.id === mode);
      if (existing) return prev;
      return [...prev, { id: mode, title, mode, closable: mode !== "storyboard" }];
    });
    setActiveTabId(mode);
  };

  const closeTab = (tabId: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1]?.id || "storyboard");
      }
      return next;
    });
  };

  // Recent projects load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("projectvne.recentProjects");
      if (raw) {
        const parsed = JSON.parse(raw);
        setRecentProjects(parsed);
      }
    } catch (_) {
      setRecentProjects([]);
    }
  }, []);

  const persistRecentProject = (nextProject: ProjectIR) => {
    const entry = {
      id: nextProject.meta.id,
      title: nextProject.meta.title,
      modifiedAt: nextProject.meta.modifiedAt,
      thumbnail: nextProject.flow.entrySceneId && nextProject.scenes[nextProject.flow.entrySceneId]
        ? nextProject.scenes[nextProject.flow.entrySceneId].background?.assetId || undefined
        : undefined,
      projectData: JSON.stringify(nextProject),
    };

    setRecentProjects(prev => {
      const deduped = [entry, ...prev.filter(item => item.id !== entry.id)].slice(0, 6);
      try {
        localStorage.setItem("projectvne.recentProjects", JSON.stringify(deduped));
      } catch (_) {}
      return deduped;
    });
  };

  const openProject = (data: ProjectIR) => {
    const migrated = MigrationRunner.migrate(data);
    setProject(migrated);
    setInvoker(new CommandInvoker(migrated));
    setSelectedSceneId(Object.keys(migrated.scenes)[0] || null);
    setActiveTabId("storyboard");
    setScreen("editor");
    persistRecentProject(migrated);
    addLog("info", `Opened project "${migrated.meta.title}"`);
  };

  useEffect(() => {
    setProblems(ProblemsChecker.check(project, { unavailableBlockTypes: pluginHost.getUnavailableBlockTypes() }));
  }, [project, pluginHost]);

  // Pixi Engine Preview Setup & ResizeObserver
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || bottomCollapsed) return;
    let cancelled = false;

    if (engineRef.current) {
      try { engineRef.current.destroy(); } catch (_) {}
      engineRef.current = null;
    }

    let engine: PixiVisualNovelEngine | null = null;
    try {
      engine = new PixiVisualNovelEngine(container, {
        onDialogue: (speaker, text) => addLog("info", `${speaker ? speaker + " said" : "Narration"}: "${text}"`),
        onSceneChange: (_, title) => addLog("info", `Started scene: ${title}`),
        onStateChange: st => { if (!cancelled) setEngineState({ ...st }); },
        onChoice: (_, opts) => addLog("info", `Presented choice with ${opts.length} option${opts.length === 1 ? "" : "s"}`),
        onStoryEnd: () => addLog("info", "Reached end of scene."),
        onPluginMissing: (type, msg) => addLog("warn", `Missing capability (${type}): ${msg}`),
        onFlashback: (title) => addLog("info", `Flashback: ${title}`)
      }, pluginHost);
      engineRef.current = engine;

      (async () => {
        try {
          // @ts-ignore
          await engine!.initPromise;
          if (cancelled || !engine) return;
          if (project && Object.keys(project.scenes).length > 0) {
            const clone = JSON.parse(JSON.stringify(project));
            if (selectedSceneId) clone.flow.entrySceneId = selectedSceneId;
            engine.loadStory(clone);
            setTimeout(() => engine?.handleResize(), 50);
          }
        } catch (e) { console.warn("PixiJS loadStory failed:", e); }
      })();
    } catch (err) {
      console.warn("PixiJS init failed:", err);
    }

    // Auto-resize whenever bottom dock is resized or container dimensions change
    const ro = new ResizeObserver(() => {
      engine?.handleResize();
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      if (engineRef.current) {
        try { engineRef.current.destroy(); } catch (_) {}
        engineRef.current = null;
      }
    };
  }, [selectedSceneId, pluginHost, bottomCollapsed]);

  // Live Auto Playback stepping
  useEffect(() => {
    if (!isPlayingLive) return;

    const interval = setInterval(() => {
      if (engineRef.current) {
        const state = engineRef.current.getState();
        // If finished, restart story
        if (state.currentSceneId && state.currentBlockIndex >= (project.scenes[state.currentSceneId]?.blocks.length || 0)) {
          if (project && Object.keys(project.scenes).length > 0) {
            const clone = JSON.parse(JSON.stringify(project));
            if (selectedSceneId) clone.flow.entrySceneId = selectedSceneId;
            engineRef.current.loadStory(clone);
            addLog("info", "Restarting live preview playback loop.");
          }
        } else {
          engineRef.current.advance();
        }
      }
    }, 2200);

    return () => clearInterval(interval);
  }, [isPlayingLive, project, selectedSceneId]);

  const executeCommand = (cmd: any): boolean => {
    const res = invoker.execute(cmd);
    if (res.success && res.state) {
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
      return true;
    } else {
      addLog("error", `Couldn't apply change: ${res.error}`);
      return false;
    }
  };

  const toggleAiEnabled = (v: boolean) => {
    setProject(p => ({ ...p, ai: { enabled: v } }));
    addLog("info", v ? "AI Assistant enabled for this project" : "AI Assistant disabled for this project");
  };

  const applyAiCommand = (command: IRCommand): boolean => executeCommand(command);

  const handleUndo = useCallback(() => {
    const res = invoker.undo();
    if (res.success && res.state) {
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
    }
  }, [invoker]);

  const handleRedo = useCallback(() => {
    const res = invoker.redo();
    if (res.success && res.state) {
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
    }
  }, [invoker]);

  const handleGraphNodeSelect = (nodeId: string, nodeType: string, data: any) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeType(nodeType);
    setSelectedNodeData(data);
    setInspectorTab("inspector");
  };

  const handleDeleteBlock = (blockIdOrIndex: string) => {
    if (!selectedSceneId) return;
    executeCommand(new RemoveBlockCommand({ sceneId: selectedSceneId, blockIdOrIndex }));
    addLog("info", `Removed block from scene.`);
  };

  const handleSaveProject = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.meta.title || "story"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    persistRecentProject(project);
    addLog("info", "Project saved.");
  }, [project]);

  const handleLoadProjectFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const migrated = MigrationRunner.migrate(JSON.parse(event.target?.result as string));
        openProject(migrated);
      } catch (err) {
        addLog("error", `Couldn't open file: ${err}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportProject = async () => {
    const validation = ProjectExporter.validateForExport(project);
    if (!validation.valid) {
      addLog("error", `Can't export yet: ${validation.issues.join(', ')}`);
      return;
    }
    addLog("info", "Preparing desktop build...");
    const result = await ProjectExporter.exportDesktopBundle(project, {
      target: 'windows',
      outputDir: './exports',
      projectName: project.meta.title || 'story'
    });
    if (result.success) {
      addLog("info", `Export finished: ${result.outputPath}`);
    } else {
      addLog("error", `Export failed: ${result.error}`);
    }
  };

  const exportProjectId = () => (project.meta.id || project.meta.title || 'story');

  const handleExportWeb = () => {
    const constraints = validateWebConstraints(project);
    const blocked = constraints.filter((c) => c.status === 'block');
    setExportWebReport(constraints);
    if (blocked.length > 0) {
      addLog("error", `Web export blocked: ${blocked.map((c) => c.label).join(', ')}`);
      return;
    }
    const payload = prepareWebExport(project, exportProjectId());
    const blob = new Blob([payload.storyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportProjectId()}-web-story.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("info", `Web export ready — downloaded story bundle.`);
  };

  const handleExportAndroid = () => {
    const res = prepareAndroidExport(project, project.meta.title || 'story');
    if (!res.ok || !res.scaffold) {
      addLog("error", `Android export failed: ${res.error}`);
      return;
    }
    const bundle = { projectId: res.scaffold.projectId, files: res.scaffold.files, permissions: res.scaffold.permissions, storageNote: res.scaffold.storageNote };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${res.scaffold.packageName}-android.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("info", `Android export bundle ready.`);
  };

  const submitAddScene = () => {
    if (!newSceneTitle.trim()) return;
    executeCommand(new AddSceneCommand({ title: newSceneTitle, backgroundAssetId: null }));
    setShowNewSceneModal(false);
    setNewSceneTitle("");
  };

  const submitAddDialogue = () => {
    if (!selectedSceneId || !dlgText.trim()) return;
    executeCommand(new AddDialogueBlockCommand({
      sceneId: selectedSceneId,
      characterId: dlgSpeakerId || null,
      text: dlgText,
      expression: "neutral"
    }));
    setDlgText("");
    setShowAddDialogueModal(false);
  };

  const submitAddChoice = () => {
    if (!selectedSceneId || !choicePrompt.trim() || !choiceOpt1Text.trim()) return;
    const options = [{ text: choiceOpt1Text, destinationSceneId: choiceOpt1Dest || null }];
    if (choiceOpt2Text.trim()) options.push({ text: choiceOpt2Text, destinationSceneId: choiceOpt2Dest || null });
    executeCommand(new AddChoiceBlockCommand({ sceneId: selectedSceneId, prompt: choicePrompt, options }));
    setChoicePrompt(""); setChoiceOpt1Text(""); setChoiceOpt2Text("");
    setShowAddChoiceModal(false);
  };

  const submitAddShowCharacter = () => {
    if (!selectedSceneId || !charBlockId) return;
    executeCommand(new AddShowCharacterBlockCommand({
      sceneId: selectedSceneId, characterId: charBlockId, expression: charBlockExpr, position: charBlockPos
    }));
    setShowAddCharacterBlockModal(false);
  };

  const handleTogglePlugin = (id: string, enabled: boolean) => {
    setPluginEnabled(id, enabled);
    setPluginsVersion(v => v + 1);
    addLog("info", enabled ? `Plugin '${id}' enabled` : `Plugin '${id}' disabled`);
  };

  const openPluginBlockModal = (blockType: string, pluginId: string) => {
    if (!selectedSceneId) return;
    const entry = pluginHost.nodeTypeFor(blockType);
    if (!entry) return;
    let defaults: Record<string, unknown> = {};
    try { defaults = entry.def.createData(); } catch { defaults = {}; }
    const fields: Array<{ key: string; label: string; type: "string" | "number" | "boolean"; value: string }> = [];
    for (const [key, value] of Object.entries(defaults)) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      if (typeof value === "string") fields.push({ key, label, type: "string", value });
      else if (typeof value === "number") fields.push({ key, label, type: "number", value: String(value) });
      else if (typeof value === "boolean") fields.push({ key, label, type: "boolean", value: value ? "true" : "false" });
    }
    setPluginBlockModal({ blockType, pluginId, title: entry.def.title, fields });
  };

  const submitAddPluginBlock = () => {
    if (!selectedSceneId || !pluginBlockModal) return;
    const data: Record<string, unknown> = {};
    for (const field of pluginBlockModal.fields) {
      if (field.type === "number") data[field.key] = Number(field.value) || 0;
      else if (field.type === "boolean") data[field.key] = field.value === "true";
      else data[field.key] = field.value;
    }
    executeCommand(new AddPluginBlockCommand({
      sceneId: selectedSceneId,
      pluginType: pluginBlockModal.blockType,
      pluginId: pluginBlockModal.pluginId,
      data,
    }));
    setPluginBlockModal(null);
  };

  const submitAddCharacter = () => {
    if (!charName.trim()) return;
    executeCommand(new CreateCharacterCommand({
      name: charName, defaultPosition: "center",
      portraits: { happy: { assetId: "asset-placeholder" } }
    }));
    setCharName(""); setShowNewCharModal(false);
  };

  const submitAddVariable = () => {
    if (!varName.trim()) return;
    let parsed: any = varDefault;
    if (varType === "number" || varType === "counter" || varType === "relationship") parsed = Number(varDefault) || 0;
    if (varType === "boolean") parsed = varDefault === "true";
    if (varType === "tagCollection") parsed = varDefault.split(",").map(t => t.trim()).filter(t => t);

    const minValue = (varType === "counter" || varType === "relationship") ? (Number(varMinValue) || 0) : undefined;
    const maxValue = (varType === "counter" || varType === "relationship") ? (Number(varMaxValue) || 100) : undefined;
    const allowedTags = varType === "tagCollection" ? varAllowedTags.split(",").map(t => t.trim()).filter(t => t) : undefined;

    executeCommand(new CreateVariableCommand({
      name: varName,
      displayName: varName,
      type: varType,
      defaultValue: parsed,
      minValue,
      maxValue,
      allowedTags
    }));
    setVarName(""); setVarDefault(""); setVarMinValue(""); setVarMaxValue(""); setVarAllowedTags("");
    setShowNewVarModal(false);
  };

  const submitNewProject = async () => {
    if (newProjectTemplate === "demo") {
      try {
        const res = await fetch("/stories/demo-story.json");
        if (res.ok) {
          const migrated = MigrationRunner.migrate(await res.json());
          migrated.meta.title = newProjectName.trim() || migrated.meta.title || "Demo Visual Novel";
          openProject(migrated);
          setShowNewProjectModal(false);
          setNewProjectName("");
          return;
        }
      } catch (_) {}
    }
    const empty = createEmptyProject();
    empty.meta.title = newProjectName.trim() || "Untitled Story";
    setProject(empty);
    setInvoker(new CommandInvoker(empty));
    setSelectedSceneId(null);
    setActiveTabId("storyboard");
    setScreen("editor");
    setShowNewProjectModal(false);
    setNewProjectName("");
  };

  const startTemplate = (template: "blank" | "demo") => {
    setNewProjectTemplate(template);
    setNewProjectName(template === "demo" ? "Demo Visual Novel" : "My Visual Novel");
    submitNewProject();
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== "editor") return;

      const isInputActive = ['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName || ''));

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInputActive) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (isInputActive) return;
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (isInputActive) return;
        e.preventDefault();
        setLeftCollapsed(p => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        if (isInputActive) return;
        e.preventDefault();
        setBottomCollapsed(p => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        if (isInputActive) return;
        e.preventDefault();
        setRightCollapsed(p => !p);
      } else if (e.key === 'F5') {
        e.preventDefault();
        setIsPlayingLive(p => !p);
      } else if (!isInputActive && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedNodeId && selectedNodeId.startsWith('block-')) {
          e.preventDefault();
          handleDeleteBlock(selectedNodeId.replace('block-', ''));
        }
      } else if (!isInputActive && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '1') openOrFocusTab('storyboard', 'Storyboard');
        else if (e.key === '2') openOrFocusTab('graph', 'Scene Graph');
        else if (e.key === '3') openOrFocusTab('project', 'Project Flow');
        else if (e.key === '4') openOrFocusTab('script', 'Script View');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, selectedNodeId, selectedSceneId, handleSaveProject, handleUndo, handleRedo]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    if (next === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
  };

  const currentScene = selectedSceneId ? project.scenes[selectedSceneId] : null;

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)]";
  const btnPrimary = "px-4 py-1.5 bg-[var(--accent)] hover:brightness-110 font-bold text-xs text-black rounded transition-all shadow-sm";
  const btnCancel = "px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors";
  const modalWrap = "fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100";
  const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl p-5 max-w-md w-full flex flex-col gap-3.5 shadow-2xl";

  // If on launcher screen
  if (screen === "launcher") {
    return (
      <Launcher
        onNewProject={() => setShowNewProjectModal(true)}
        onOpenProject={handleLoadProjectFile}
        onOpenRecent={openProject}
        recentProjects={recentProjects}
        onSelectTemplate={startTemplate}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => { setSettingsTab("general"); setShowSettings(true); }}
        pluginHost={pluginHost}
        project={project}
        onTogglePlugin={handleTogglePlugin}
        onInstalledChange={() => setPluginsVersion(v => v + 1)}
      />
    );
  }

  const activeTab = openTabs.find(t => t.id === activeTabId) || openTabs[0];

  // --- EDITOR VIEW ---
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden select-none">
      {/* ===== TOP ENGINE MENU BAR ===== */}
      <header className="h-10 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen("launcher")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Return to Launcher"
          >
            <div className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center font-black text-[10px] text-black shadow-sm">
              VN
            </div>
            <span className="text-xs font-bold tracking-tight text-[var(--text-primary)]">ProjectVNE</span>
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)]" />

          {/* MENUS */}
          <MenuBar
            onNewProject={() => setShowNewProjectModal(true)}
            onOpenProject={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e: any) => handleLoadProjectFile(e.target.files[0]);
              input.click();
            }}
            onSaveProject={handleSaveProject}
            onExportProject={() => setShowExportModal(true)}
            onBackToLauncher={() => setScreen("launcher")}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={invoker.canUndo()}
            canRedo={invoker.canRedo()}
            onOpenSettings={(tab) => {
              if (tab) setSettingsTab(tab);
              setShowSettings(true);
            }}
            onOpenPlugins={() => openOrFocusTab("plugins", "Plugin Manager")}
            onOpenMarketplace={() => openOrFocusTab("marketplace", "Marketplace")}
            activeViewMode={activeTab?.mode as any}
            onChangeViewMode={(mode) => openOrFocusTab(mode, mode.charAt(0).toUpperCase() + mode.slice(1))}
            onToggleLeftDock={() => setLeftCollapsed(p => !p)}
            onToggleRightDock={() => setRightCollapsed(p => !p)}
            onToggleBottomDock={() => setBottomCollapsed(p => !p)}
            onResetLayout={() => {
              setLeftCollapsed(false);
              setRightCollapsed(false);
              setBottomCollapsed(false);
              localStorage.removeItem("projectvne_left_width");
              localStorage.removeItem("projectvne_right_width");
              localStorage.removeItem("projectvne_bottom_height");
            }}
            onAddScene={() => setShowNewSceneModal(true)}
            onAddDialogue={() => setShowAddDialogueModal(true)}
            onAddChoice={() => setShowAddChoiceModal(true)}
            onAddCharacter={() => setShowAddCharacterBlockModal(true)}
            onTogglePlay={() => setIsPlayingLive(p => !p)}
            isPlaying={isPlayingLive}
          />
        </div>

        {/* RIGHT TOOLBAR */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlayingLive(!isPlayingLive)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
              isPlayingLive
                ? "bg-[var(--amber-bg)] text-[var(--amber-text)] border border-[var(--amber-border)]"
                : "bg-[var(--green-bg)] text-[var(--green-text)] border border-[var(--green-border)] hover:brightness-110"
            }`}
          >
            {isPlayingLive ? <Pause size={11} className="fill-current" /> : <Play size={11} className="fill-current" />}
            <span>{isPlayingLive ? "Pause" : "Play"}</span>
          </button>

          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs gap-1">
            <span className="text-[var(--text-ghost)] text-[10px]">Scene:</span>
            <select
              value={selectedSceneId || ""}
              onChange={e => setSelectedSceneId(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] font-mono focus:outline-none cursor-pointer max-w-[130px]"
            >
              {Object.entries(project.scenes).map(([id, sc]) => (
                <option key={id} value={id} className="bg-[var(--bg-panel)]">{sc.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center text-[var(--text-ghost)] gap-0.5">
            <button onClick={handleUndo} disabled={!invoker.canUndo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors" title="Undo (Ctrl+Z)"><Undo2 size={13}/></button>
            <button onClick={handleRedo} disabled={!invoker.canRedo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors" title="Redo (Ctrl+Y)"><Redo2 size={13}/></button>
            <button onClick={handleSaveProject} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Save Project (Ctrl+S)"><Save size={13}/></button>
            <button onClick={() => setShowExportModal(true)} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Export Game (Ctrl+E)"><Download size={13}/></button>
          </div>

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

          <button
            onClick={() => { setSettingsTab("general"); setShowSettings(true); }}
            className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            title="Settings & Preferences"
          >
            <Settings size={13} />
          </button>

          <button onClick={toggleTheme} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Toggle theme">
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </header>

      {/* ===== MAIN DOCKABLE / RESIZABLE LAYOUT ===== */}
      <ResizableLayout
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        bottomCollapsed={bottomCollapsed}
        leftContent={
          <div className="flex flex-col h-full overflow-hidden">
            {/* PROJECT HIERARCHY */}
            <div className="flex-1 flex flex-col border-b border-[var(--border-subtle)] overflow-hidden min-h-0">
              <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] flex items-center gap-1.5">
                  <FolderTree size={11}/> Hierarchy
                </span>
                <button
                  onClick={() => setShowNewSceneModal(true)}
                  className="text-[var(--text-ghost)] hover:text-[var(--text-secondary)] transition-colors p-0.5 rounded hover:bg-[var(--bg-hover)]"
                  title="Add Scene"
                >
                  <Plus size={13}/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-[11px] font-mono">
                <div className="text-[var(--text-ghost)] px-1 py-0.5 text-[10px] flex items-center gap-1">
                  <FolderTree size={10} className="opacity-50"/> {project.meta.title || "project"}
                </div>

                {/* Scenes Folder */}
                <div className="pl-1">
                  <div
                    onClick={() => setTreeExpanded(p => ({ ...p, stories: !p.stories }))}
                    className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {treeExpanded.stories ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                    <span>scenes</span>
                  </div>
                  {treeExpanded.stories && (
                    <div className="pl-3 mt-0.5 space-y-px">
                      {Object.entries(project.scenes).map(([id, sc]) => (
                        <div
                          key={id}
                          onClick={() => { setSelectedSceneId(id); openOrFocusTab("storyboard", "Storyboard"); }}
                          className={`flex items-center justify-between px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            selectedSceneId === id
                              ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm font-semibold"
                              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <span className="truncate">{sc.title}</span>
                          {project.flow.entrySceneId === id && <span className="text-[9px] text-[var(--green-text)] ml-1">●</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Characters Folder */}
                <div className="pl-1">
                  <div
                    onClick={() => setTreeExpanded(p => ({ ...p, characters: !p.characters }))}
                    className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {treeExpanded.characters ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                    <span>characters</span>
                  </div>
                  {treeExpanded.characters && (
                    <div className="pl-3 mt-0.5 space-y-px">
                      {Object.entries(project.characters).map(([id, ch]) => (
                        <div key={id} className="text-[var(--text-muted)] px-2 py-0.5 truncate">{ch.name}</div>
                      ))}
                      <button onClick={() => setShowNewCharModal(true)} className="text-[var(--text-ghost)] hover:text-[var(--accent)] px-2 py-0.5 block transition-colors text-[10px]">+ new character</button>
                    </div>
                  )}
                </div>

                {/* Backgrounds Folder */}
                <div className="pl-1">
                  <div
                    onClick={() => setTreeExpanded(p => ({ ...p, backgrounds: !p.backgrounds }))}
                    className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {treeExpanded.backgrounds ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                    <span>backgrounds</span>
                  </div>
                  {treeExpanded.backgrounds && (
                    <div className="pl-3 mt-0.5 space-y-px">
                      {Object.entries(project.assets).filter(([_, a]) => a.type === "background").map(([id, a]) => (
                        <div key={id} className="text-[var(--text-muted)] px-2 py-0.5 truncate">{a.name}</div>
                      ))}
                      <button onClick={() => setShowNewAssetModal(true)} className="text-[var(--text-ghost)] hover:text-[var(--accent)] px-2 py-0.5 block transition-colors text-[10px]">+ import asset</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* NODE & ACTION PALETTE */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[var(--bg-surface)]">
              <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] flex items-center gap-1.5">
                  <LayoutGrid size={11}/> Story Palette
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Story Blocks</div>
                  <button
                    onClick={() => setShowAddDialogueModal(true)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-1 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare size={13} className="text-[var(--blue-text)]" />
                      <span>Dialogue Node</span>
                    </div>
                    <Plus size={11} className="text-[var(--text-ghost)]"/>
                  </button>
                  <button
                    onClick={() => setShowAddChoiceModal(true)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-1 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Split size={13} className="text-[var(--amber-text)]" />
                      <span>Choice Branch</span>
                    </div>
                    <Plus size={11} className="text-[var(--text-ghost)]"/>
                  </button>
                  <button
                    onClick={() => setShowAddCharacterBlockModal(true)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-1 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-[var(--violet-text)]" />
                      <span>Show Character</span>
                    </div>
                    <Plus size={11} className="text-[var(--text-ghost)]"/>
                  </button>
                </div>

                {pluginHost.getNodeTypes().length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Plugins</div>
                    {pluginHost.getNodeTypes().map(({ pluginId, def }) => (
                      <button
                        key={def.blockType}
                        onClick={() => openPluginBlockModal(def.blockType, pluginId)}
                        disabled={!selectedSceneId}
                        title={selectedSceneId ? def.description : "Select a scene first"}
                        className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-1 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Package size={13} className="text-[var(--accent)]" />
                          <span>{def.title}</span>
                        </div>
                        <Plus size={11} className="text-[var(--text-ghost)]"/>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        }
        centerContent={
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
            {/* UE5-STYLE DOCKABLE TABS HEADER */}
            <div className="h-9 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between px-2 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto h-full">
                {openTabs.map((tab) => {
                  const isActive = activeTabId === tab.id;
                  const Icon = tab.mode === "storyboard" ? Layers :
                    tab.mode === "graph" ? Split :
                    tab.mode === "project" ? FolderTree :
                    tab.mode === "script" ? FileCode :
                    tab.mode === "marketplace" ? ShoppingBag : Package;

                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`h-7 px-3 rounded-md flex items-center gap-2 text-xs font-semibold cursor-pointer border transition-all ${
                        isActive
                          ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-default)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <Icon size={12} className={isActive ? "text-[var(--accent)]" : "text-[var(--text-ghost)]"} />
                      <span>{tab.title}</span>
                      {tab.closable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                          className="p-0.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-ghost)] hover:text-[var(--text-primary)] ml-1"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Breadcrumb info */}
              <div className="flex items-center gap-2 text-xs pr-2">
                <span className="text-[var(--text-ghost)] font-mono text-[11px]">scenes /</span>
                <span className="text-[var(--text-primary)] font-bold">{currentScene?.title || "No Scene"}</span>
              </div>
            </div>

            {/* VIEWPORT CONTENT */}
            <div className="flex-1 relative overflow-hidden">
              {activeTab.mode === "graph" ? (
                <StoryGraphCanvas
                  project={project}
                  activeSceneId={selectedSceneId}
                  theme={theme}
                  onSelectNode={handleGraphNodeSelect}
                  onDeleteBlock={handleDeleteBlock}
                  onAddDialogue={() => setShowAddDialogueModal(true)}
                  onAddChoice={() => setShowAddChoiceModal(true)}
                  onAddCharacter={() => setShowAddCharacterBlockModal(true)}
                />
              ) : activeTab.mode === "project" ? (
                <ProjectFlowGraph project={project} theme={theme} onSelectScene={setSelectedSceneId}/>
              ) : activeTab.mode === "marketplace" ? (
                <div className="h-full overflow-hidden p-4 bg-[var(--bg-app)]">
                  <MarketplaceModal
                    onClose={() => closeTab("marketplace")}
                    onInstalledChange={() => {
                      setPluginsVersion(v => v + 1);
                      addLog("info", "Marketplace plugins updated.");
                    }}
                  />
                </div>
              ) : activeTab.mode === "plugins" ? (
                <div className="h-full overflow-y-auto p-6 bg-[var(--bg-panel)] max-w-4xl mx-auto space-y-4">
                  <div className="border-b border-[var(--border-subtle)] pb-4">
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Installed Extensions & Plugins</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Toggle and configure sandboxed capabilities.</p>
                  </div>
                  <PluginManager host={pluginHost} project={project} onTogglePlugin={handleTogglePlugin} />
                </div>
              ) : activeTab.mode === "storyboard" ? (
                <div className="w-full h-full overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto">
                  {currentScene?.blocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-default)] p-12 text-center text-[var(--text-ghost)]">
                      <Layers size={32} className="mx-auto mb-2 opacity-40" />
                      <div className="text-xs font-semibold">No blocks in this scene yet</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">Use the palette on the left to add dialogue, choices, or character appearances.</div>
                    </div>
                  ) : (
                    currentScene?.blocks.map((block, idx) => (
                      <div
                        key={block.id || idx}
                        onClick={() => handleGraphNodeSelect(`block-${block.id || idx}`, block.type, block)}
                        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--border-default)] cursor-pointer transition-all shadow-sm hover:shadow-md overflow-hidden group"
                      >
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">#{idx+1}</span>
                            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{block.type === "plugin" ? (block as any).pluginType : block.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBlock(block.id || String(idx));
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-ghost)] hover:text-[var(--error-text)] transition-opacity"
                              title="Delete block"
                            >
                              <Trash2 size={12} />
                            </button>
                            <span className="text-[9px] font-mono text-[var(--text-ghost)]">{block.id?.slice(-8) || ''}</span>
                          </div>
                        </div>
                        <div className="p-4">
                          {block.type === "dialogue" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center font-bold text-[11px] text-[var(--text-muted)]">
                                  {block.characterId && project.characters[block.characterId]
                                    ? project.characters[block.characterId].name[0]
                                    : "N"
                                  }
                                </div>
                                <div>
                                  <div className="text-[12px] font-bold text-[var(--text-primary)]">
                                    {block.characterId && project.characters[block.characterId] ? project.characters[block.characterId].name : "Narrator"}
                                  </div>
                                  {block.expression && (
                                    <div className="text-[10px] text-[var(--text-muted)]">{block.expression}</div>
                                  )}
                                </div>
                              </div>
                              <div className="bg-[var(--bg-input)] p-3 rounded-lg border border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] leading-relaxed italic">
                                "{block.text}"
                              </div>
                            </div>
                          )}
                          {block.type === "showCharacter" && (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center font-bold text-xs text-[var(--text-muted)]">
                                {project.characters[block.characterId]?.name[0] || "?"}
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[12px] font-bold text-[var(--text-primary)]">
                                  {project.characters[block.characterId]?.name || "Unknown Character"}
                                </div>
                                <div className="flex gap-2 text-[10px] text-[var(--text-muted)]">
                                  <span className="bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">{block.expression}</span>
                                  <span className="bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">{block.position}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {block.type === "choice" && (
                            <div className="space-y-2">
                              <div className="text-[12px] font-semibold text-[var(--text-primary)] mb-2">{block.prompt}</div>
                              <div className="space-y-1">
                                {block.options.map((opt, optIdx) => (
                                  <div key={opt.id || optIdx} className="flex items-center gap-2 p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border-subtle)]">
                                    <span className="text-[10px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{optIdx + 1}</span>
                                    <span className="text-[11px] text-[var(--text-secondary)]">{opt.text}</span>
                                    {opt.destinationSceneId && (
                                      <span className="text-[9px] text-[var(--text-muted)] ml-auto font-mono">→ {project.scenes[opt.destinationSceneId]?.title || 'Unknown'}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {block.type === "plugin" && (() => {
                            const pBlock = block as any;
                            const entry = pluginHost.nodeTypeFor(pBlock.pluginType);
                            if (!entry) {
                              return (
                                <div className="p-3 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-dim)] text-xs text-[var(--amber-text)]">
                                  Missing capability: {pBlock.pluginType}
                                </div>
                              );
                            }
                            let vm = null;
                            try { vm = entry.def.toViewModel({ data: pBlock.data }, project); } catch { vm = null; }
                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
                                  {entry.def.icon && <span>{entry.def.icon}</span>}
                                  <span>{entry.def.title}</span>
                                </div>
                                {vm ? <PluginViewModelView vm={vm} /> : <div className="text-[10px] text-[var(--text-ghost)]">No preview available.</div>}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="w-full h-full p-6 overflow-y-auto font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-app)]">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <pre className="whitespace-pre-wrap leading-6 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)] shadow-sm">
                      {selectedSceneId ? generateSceneTextView(project, selectedSceneId) : "// Select a scene"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        bottomContent={
          <div className="flex flex-col h-full w-full bg-[var(--bg-surface)]">
            <div className="h-7 border-b border-[var(--border-subtle)] px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setBottomTab("preview")}
                  className={`flex items-center gap-1.5 transition-colors py-1 ${
                    bottomTab === "preview" ? "text-[var(--text-primary)] border-b-2 border-[var(--accent)]" : "hover:text-[var(--text-secondary)]"
                  }`}
                >
                  <Eye size={11} /> <span>Live Preview</span>
                </button>
                <button
                  onClick={() => setBottomTab("console")}
                  className={`flex items-center gap-1.5 transition-colors py-1 ${
                    bottomTab === "console" ? "text-[var(--text-primary)] border-b-2 border-[var(--accent)]" : "hover:text-[var(--text-secondary)]"
                  }`}
                >
                  <Terminal size={11} /> <span>Console ({consoleLogs.length})</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {bottomTab === "preview" && (
                  <button
                    onClick={() => setShowFullscreenPreview(true)}
                    className="hover:text-[var(--text-primary)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[10px] flex items-center gap-1"
                    title="Fullscreen Playback"
                  >
                    <Play size={10} className="text-[var(--green-text)] fill-current" />
                    <span>Fullscreen Play</span>
                  </button>
                )}
                {bottomTab === "console" && (
                  <button onClick={() => setConsoleLogs([])} className="hover:text-[var(--text-primary)] transition-colors">
                    Clear
                  </button>
                )}
                <button onClick={() => setBottomCollapsed(true)} className="hover:text-[var(--text-primary)] transition-colors">
                  Hide Dock
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex relative">
              <div
                className={`flex-1 flex items-center justify-center p-2 overflow-hidden bg-[var(--bg-app)] transition-all ${
                  bottomTab === "preview" ? "visible relative" : "absolute opacity-0 pointer-events-none -z-10"
                }`}
              >
                <div ref={canvasContainerRef} className="w-full h-full max-h-full rounded-lg overflow-hidden border border-[var(--border-subtle)] shadow-md bg-black flex items-center justify-center" />
              </div>
              
              {bottomTab === "console" && (
                <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1 bg-[var(--bg-panel)]">
                  {consoleLogs.length === 0 && <div className="text-[var(--text-ghost)] italic p-2">Console log is clean.</div>}
                  {consoleLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-[var(--bg-surface)]">
                      <span className="text-[var(--text-ghost)] text-[10px] shrink-0 font-mono">{log.time}</span>
                      <span className={`text-[9px] uppercase font-bold shrink-0 ${log.level==="info"?"text-[var(--text-muted)]":log.level==="warn"?"text-[var(--amber-text)]":"text-[var(--error-text)]"}`}>{log.level}</span>
                      <span className="text-[var(--text-secondary)] truncate">{log.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        rightContent={
          <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-panel)]">
            {/* TABS */}
            <div className="flex border-b border-[var(--border-subtle)] text-[11px] overflow-x-auto bg-[var(--bg-surface)] shrink-0">
              {([
                { id: "inspector", label: "Inspector" },
                { id: "variables", label: "Variables" },
                { id: "problems", label: `Problems (${problems.length})` },
                { id: "debugger", label: "Debugger" },
                { id: "ai", label: "AI Co-pilot" },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id)}
                  className={`flex-1 min-w-[70px] px-2 py-2 text-center transition-colors font-semibold whitespace-nowrap text-xs ${
                    inspectorTab === tab.id
                      ? "text-[var(--text-primary)] border-b-2 border-[var(--accent)] bg-[var(--bg-panel)]"
                      : "text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
              {inspectorTab === "inspector" && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] mb-1">
                      {selectedNodeType ? selectedNodeType.replace("Node","").toUpperCase() + " NODE" : "NODE PROPERTIES"}
                    </div>
                    <div className="text-[10px] text-[var(--text-ghost)] font-mono">{selectedNodeId || "Select a node or block to edit"}</div>
                  </div>
                  {selectedNodeData ? (
                    <div className="space-y-2.5 p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                      {selectedNodeData.characterName && (
                        <div>
                          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Speaker</label>
                          <div className="p-2 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">{selectedNodeData.characterName as string}</div>
                        </div>
                      )}
                      {selectedNodeData.content && (
                        <div>
                          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Dialogue</label>
                          <div className="p-2 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] italic">"{selectedNodeData.content as string}"</div>
                        </div>
                      )}
                      {selectedNodeData.prompt && (
                        <div>
                          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Choice Prompt</label>
                          <div className="p-2 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">"{selectedNodeData.prompt as string}"</div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Actions</div>
                        {selectedNodeId?.startsWith("block-") && (
                          <button
                            onClick={() => handleDeleteBlock(selectedNodeId.replace("block-", ""))}
                            className="w-full px-3 py-1.5 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)] text-xs font-semibold hover:brightness-110 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Trash2 size={12} />
                            <span>Delete Block</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[var(--text-ghost)] italic text-xs">Click a node on the canvas to inspect and edit its properties.</div>
                  )}
                </div>
              )}

              {inspectorTab === "variables" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Story Variables</span>
                    <button onClick={() => setShowNewVarModal(true)} className="text-[var(--accent)] hover:underline text-[10px] font-semibold">+ Add Variable</button>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(project.variables).length === 0 ? (
                      <div className="text-[var(--text-ghost)] italic text-center py-6 text-[11px]">No variables defined</div>
                    ) : (
                      Object.entries(project.variables).map(([id, v]) => (
                        <div key={id} className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">{v.name}</div>
                            <div className="text-[9px] text-[var(--text-ghost)] font-mono">{v.type}</div>
                          </div>
                          <div className="font-mono text-xs font-semibold text-[var(--accent)]">{String(v.defaultValue)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {inspectorTab === "problems" && (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block">Story Integrity</span>
                  {problems.length === 0 ? (
                    <div className="p-3 bg-[var(--green-dim)] border border-[var(--green-border)] rounded-lg text-[var(--green-text)] text-xs text-center font-semibold">✓ No errors or broken branches found</div>
                  ) : problems.map(p => (
                    <div key={p.id} className="p-2.5 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg text-xs text-[var(--error-text)]">
                      <div className="font-semibold">{p.message}</div>
                      {p.fixSuggestion && <div className="text-[10px] text-[var(--text-muted)] mt-1">💡 {p.fixSuggestion}</div>}
                    </div>
                  ))}
                </div>
              )}

              {inspectorTab === "debugger" && (
                <div className="space-y-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block">Runtime Live Inspector</span>
                  {currentScene && (
                    <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 text-xs">
                      <div>Active Scene: <span className="font-bold text-[var(--text-primary)]">{currentScene.title}</span></div>
                      <div>Block Count: <span className="font-mono">{currentScene.blocks.length}</span></div>
                      {engineState && (
                        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-muted)]">
                          <div>Engine Phase: {engineState.currentBlockIndex} / {currentScene.blocks.length}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === "ai" && (
                <AiPanel
                  project={project}
                  selectedSceneId={selectedSceneId}
                  enabled={!!project.ai?.enabled}
                  onToggleEnabled={toggleAiEnabled}
                  prefs={prefs}
                  setPrefs={setPrefs}
                  keys={keys}
                  loadKey={loadKey}
                  saveKey={saveKey}
                  storageMode={storageMode}
                  onApplyCommand={applyAiCommand}
                  onOpenSettings={() => { setSettingsTab("ai"); setShowSettings(true); }}
                />
              )}
            </div>
          </div>
        }
      />

      {/* ===== STATUS BAR ===== */}
      <footer className="h-5 bg-[var(--bg-panel)] border-t border-[var(--border-subtle)] px-3 flex items-center justify-between text-[10px] text-[var(--text-ghost)] shrink-0 font-mono">
        <div className="flex items-center gap-4">
          <span>{project.meta.title || "Untitled"}</span>
          <span className="flex items-center gap-1 text-[var(--green-text)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--green-text)] animate-pulse inline-block"/>Studio Ready</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PixiJS v8.19</span>
          <span>IR v{project.meta.schemaVersion}</span>
          <span>v0.1.0</span>
        </div>
      </footer>

      {/* ===== MODALS & DIALOGS ===== */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          theme={theme}
          toggleTheme={toggleTheme}
          initialTab={settingsTab}
          projectTitle={project.meta.title}
          onUpdateProjectTitle={(title) => {
            setProject(p => ({ ...p, meta: { ...p.meta, title } }));
          }}
          aiSettings={{
            prefs,
            setPrefs,
            keys,
            loadKey,
            saveKey,
            storageMode,
            enabled: !!project.ai?.enabled,
            onToggleEnabled: toggleAiEnabled
          }}
        />
      )}

      {showPluginsModal && (
        <PluginsModal
          onClose={() => setShowPluginsModal(false)}
          host={pluginHost}
          project={project}
          onTogglePlugin={handleTogglePlugin}
          onOpenMarketplace={() => setShowMarketplaceModal(true)}
        />
      )}

      {showMarketplaceModal && (
        <MarketplaceModal
          onClose={() => setShowMarketplaceModal(false)}
          onInstalledChange={() => {
            setPluginsVersion(v => v + 1);
            addLog("info", "Marketplace plugins updated.");
          }}
        />
      )}

      {showExportModal && (
        <div className={modalWrap} onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}>
          <div className={modalBox + " max-w-lg"}>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Export Visual Novel</h3>
            <p className="text-xs text-[var(--text-muted)]">Package story for Desktop (Win/Mac/Linux), Web Browser, or Android APK.</p>
            <div className="space-y-2 mt-2">
              <button onClick={handleExportProject} className="w-full p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-left transition-colors">
                <div className="text-xs font-bold text-[var(--text-primary)]">Desktop Standalone Bundle</div>
                <div className="text-[10px] text-[var(--text-muted)]">Generates cross-platform runtime for Windows, macOS, and Linux.</div>
              </button>
              <button onClick={handleExportWeb} className="w-full p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-left transition-colors">
                <div className="text-xs font-bold text-[var(--text-primary)]">Web Browser Distribution</div>
                <div className="text-[10px] text-[var(--text-muted)]">HTML5 + WebGL story bundle ready to host on itch.io or web servers.</div>
              </button>
              <button onClick={handleExportAndroid} className="w-full p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-left transition-colors">
                <div className="text-xs font-bold text-[var(--text-primary)]">Android Mobile Project</div>
                <div className="text-[10px] text-[var(--text-muted)]">Android Studio project scaffold with hardware scaling.</div>
              </button>
            </div>
            {exportWebReport && (
              <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px]">
                <div className="font-bold text-[var(--text-primary)] mb-1">Web Validation Constraints</div>
                {exportWebReport.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={c.status === "pass" ? "text-[var(--green-text)]" : "text-[var(--error-text)]"}>
                      {c.status === "pass" ? "✓" : "✗"}
                    </span>
                    <span className="text-[var(--text-secondary)]">{c.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-2">
              <button onClick={() => setShowExportModal(false)} className={btnCancel}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW SCENE MODAL */}
      {showNewSceneModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Create Scene</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Scene Identifier / Title</label>
            <input className={inputCls} value={newSceneTitle} onChange={e=>setNewSceneTitle(e.target.value)} placeholder="chapter_one" autoFocus onKeyDown={e=>e.key==="Enter"&&submitAddScene()}/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewSceneModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddScene} className={btnPrimary}>Create</button></div>
        </div></div>
      )}

      {/* ADD DIALOGUE MODAL */}
      {showAddDialogueModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Add Dialogue</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Speaker</label>
            <select className={inputCls} value={dlgSpeakerId} onChange={e=>setDlgSpeakerId(e.target.value)}>
              <option value="">Narrator</option>
              {Object.entries(project.characters).map(([id,c])=>(<option key={id} value={id}>{c.name}</option>))}
            </select>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Dialogue Text</label>
            <textarea className={inputCls + " resize-none"} rows={3} value={dlgText} onChange={e=>setDlgText(e.target.value)} placeholder="Enter story dialogue..."/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddDialogueModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddDialogue} className={btnPrimary}>Add Node</button></div>
        </div></div>
      )}

      {/* ADD CHOICE MODAL */}
      {showAddChoiceModal && (
        <div className={modalWrap}><div className={modalBox + " max-w-lg"}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Add Choice Branch</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Prompt</label>
            <input className={inputCls} value={choicePrompt} onChange={e=>setChoicePrompt(e.target.value)} placeholder="How do you respond?"/>
          </div>
          {[[choiceOpt1Text, setChoiceOpt1Text, choiceOpt1Dest, setChoiceOpt1Dest, "Option 1"],
            [choiceOpt2Text, setChoiceOpt2Text, choiceOpt2Dest, setChoiceOpt2Dest, "Option 2 (optional)"]].map(([text, setText, dest, setDest, label], i) => (
            <div key={i} className="p-2.5 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)] space-y-1.5">
              <label className="text-[10px] text-[var(--text-muted)]">{label as string}</label>
              <input className={inputCls} value={text as string} onChange={e=>(setText as Function)(e.target.value)} placeholder="Option text..."/>
              <select className={inputCls} value={dest as string} onChange={e=>(setDest as Function)(e.target.value)}>
                <option value="">→ Continue in scene</option>
                {Object.entries(project.scenes).map(([id,sc])=>(<option key={id} value={id}>→ {sc.title}</option>))}
              </select>
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddChoiceModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddChoice} className={btnPrimary}>Add Choice</button></div>
        </div></div>
      )}

      {/* ADD CHARACTER BLOCK */}
      {showAddCharacterBlockModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Show Character</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Character</label>
            <select className={inputCls} value={charBlockId} onChange={e=>setCharBlockId(e.target.value)}>
              <option value="">Select...</option>
              {Object.entries(project.characters).map(([id,c])=>(<option key={id} value={id}>{c.name}</option>))}
            </select>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Expression</label>
            <input className={inputCls} value={charBlockExpr} onChange={e=>setCharBlockExpr(e.target.value)} placeholder="happy"/>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Position</label>
            <select className={inputCls} value={charBlockPos} onChange={e=>setCharBlockPos(e.target.value as CharacterPosition)}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddCharacterBlockModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddShowCharacter} className={btnPrimary}>Add Node</button></div>
        </div></div>
      )}

      {/* NEW CHARACTER MODAL */}
      {showNewCharModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Create Character</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Name</label>
            <input className={inputCls} value={charName} onChange={e=>setCharName(e.target.value)} placeholder="Luna" autoFocus/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewCharModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddCharacter} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

      {/* NEW VARIABLE MODAL */}
      {showNewVarModal && (
        <div className={modalWrap}><div className={modalBox + " max-w-lg"}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Add Variable</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Name</label>
            <input className={inputCls + " font-mono"} value={varName} onChange={e=>setVarName(e.target.value)} placeholder="player_trust" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Type</label>
            <select className={inputCls} value={varType} onChange={e=>setVarType(e.target.value as VariableType)}>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="text">Text</option>
              <option value="relationship">Relationship</option>
              <option value="counter">Counter</option>
              <option value="tagCollection">Tag Collection</option>
            </select>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Default Value</label>
            <input className={inputCls + " font-mono"} value={varDefault} onChange={e=>setVarDefault(e.target.value)} placeholder={varType === "boolean" ? "true" : varType === "tagCollection" ? "tag1,tag2" : "0"}/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewVarModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddVariable} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

      {/* NEW PROJECT MODAL */}
      {showNewProjectModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">New Visual Novel Project</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Project name</label>
            <input className={inputCls} value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="My Visual Novel" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Starter template</label>
            <div className="grid grid-cols-2 gap-2">
              {([["blank","Blank Canvas","Start from an empty story."],["demo","Demo Novel","A preloaded sample story with choices."]] as const).map(([value,label,desc]) => (
                <button key={value} onClick={()=>setNewProjectTemplate(value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${newProjectTemplate===value ? "border-[var(--accent)] bg-[var(--bg-surface)]" : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"}`}>
                  <div className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">{label}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={()=>setShowNewProjectModal(false)} className={btnCancel}>Cancel</button>
            <button onClick={submitNewProject} className={btnPrimary}>Create</button>
          </div>
        </div></div>
      )}

      {/* PLUGIN BLOCK MODAL */}
      {pluginBlockModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Add {pluginBlockModal.title}</h3>
          {pluginBlockModal.fields.map((f, i) => (
            <div key={f.key}>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">{f.label}</label>
              <input
                className={inputCls}
                value={f.value}
                onChange={(e) => {
                  const val = e.target.value;
                  setPluginBlockModal(prev => prev ? {
                    ...prev,
                    fields: prev.fields.map((field, idx) => idx === i ? { ...field, value: val } : field)
                  } : null);
                }}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => setPluginBlockModal(null)} className={btnCancel}>Cancel</button>
            <button onClick={submitAddPluginBlock} className={btnPrimary}>Add Block</button>
          </div>
        </div></div>
      )}

      {/* IMPORT ASSET MODAL */}
      {showNewAssetModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Import Asset</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Asset Name</label>
            <input className={inputCls} placeholder="city_night" id="asset-name-input" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Asset Type</label>
            <select className={inputCls} id="asset-type-select">
              <option value="background">Background</option>
              <option value="portrait">Character Portrait</option>
              <option value="audio">Audio / Music</option>
            </select>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">File Path / URL</label>
            <input className={inputCls} placeholder="assets/backgrounds/city.png" id="asset-path-input"/>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={()=>setShowNewAssetModal(false)} className={btnCancel}>Cancel</button>
            <button onClick={() => {
              const name = (document.getElementById("asset-name-input") as HTMLInputElement)?.value || "New Asset";
              const type = (document.getElementById("asset-type-select") as HTMLSelectElement)?.value as any || "background";
              const fileReference = (document.getElementById("asset-path-input") as HTMLInputElement)?.value || "placeholder.png";
              executeCommand(new CreateAssetCommand({ name, type, fileReference }));
              setShowNewAssetModal(false);
            }} className={btnPrimary}>Import</button>
          </div>
        </div></div>
      )}

      {/* FULLSCREEN PLAYBACK OVERLAY */}
      {showFullscreenPreview && (() => {
        // We reuse the existing Pixi engine instance, but append its canvas to our fullscreen container,
        // then trigger resize. When closed, we append it back to our main editor container.
        return (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header toolbar */}
            <div className="h-10 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between text-white text-xs select-none">
              <div className="font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Fullscreen Playback - {project.meta.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlayingLive(!isPlayingLive)}
                  className={`px-3 py-1 rounded font-bold text-xs ${
                    isPlayingLive ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                  }`}
                >
                  {isPlayingLive ? "Pause Autoplay" : "Resume Autoplay"}
                </button>
                <button
                  onClick={() => {
                    if (engineRef.current) {
                      engineRef.current.advance();
                    }
                  }}
                  className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 font-bold"
                >
                  Advance (Click/Space)
                </button>
                <button
                  onClick={() => {
                    setShowFullscreenPreview(false);
                    // Force re-append back to editor container
                    setTimeout(() => {
                      const container = canvasContainerRef.current;
                      if (container && engineRef.current?.app?.canvas) {
                        container.appendChild(engineRef.current.app.canvas);
                        engineRef.current.handleResize();
                      }
                    }, 50);
                  }}
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 font-bold"
                >
                  Exit Fullscreen
                </button>
              </div>
            </div>
            {/* Fullscreen canvas host container */}
            <div
              ref={(ref) => {
                if (ref && engineRef.current?.app?.canvas) {
                  ref.appendChild(engineRef.current.app.canvas);
                  engineRef.current.handleResize();
                }
              }}
              className="flex-1 flex items-center justify-center overflow-hidden bg-black cursor-pointer"
              onClick={() => {
                if (engineRef.current) {
                  engineRef.current.advance();
                }
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
