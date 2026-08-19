import { useEffect, useMemo, useRef, useState } from "react";
import { PixiVisualNovelEngine, EngineState } from "./runtime/engine";
import {
  ProjectIR,
  createEmptyProject,
  ID,
  CharacterPosition,
  VariableType
} from "./shared/types";
import { buildDefaultVariableState, evaluateChoiceAvailability, generateSceneTextView } from "./shared/story-logic";
import {
  CommandInvoker,
  AddSceneCommand,
  AddDialogueBlockCommand,
  AddChoiceBlockCommand,
  AddShowCharacterBlockCommand,
  AddPluginBlockCommand,
  CreateCharacterCommand,
  CreateVariableCommand,
  CreateAssetCommand
} from "./commands";
import { ProblemsChecker, StoryProblem } from "./shared/problems-checker";
import { MigrationRunner } from "./migrations/migration-runner";
import { StoryGraphCanvas } from "./components/StoryGraphCanvas";
import { ProjectFlowGraph } from "./components/ProjectFlowGraph";
import { ConditionEditor } from "./components/ConditionEditor";
import { ProjectExporter } from "./export/exporter";
import { validateWebConstraints, prepareWebExport, WebConstraint } from "./export/web-export";
import { prepareAndroidExport } from "./export/android";
import { prepareCloudBuildRequest, CloudBuildRequest } from "./export/cloud-build";
import { AiPanel } from "./components/AiPanel";
import { SettingsModal } from "./components/SettingsModal";
import { PluginManager } from "./components/PluginManager";
import { MarketplaceManager } from "./components/MarketplaceManager";
import { PluginViewModelView } from "./components/PluginViewModel";
import { useAiState } from "./ai/use-ai-state";
import { createDefaultPluginHost, setPluginEnabled, PluginHost } from "./plugins";
import type { IRCommand } from "./commands/command-types";

import {
  Play,
  FolderTree,
  FileCode,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Plus,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Split,
  Terminal,
  Layers,
  Search,
  Eye,
  Download,
  Sun,
  Moon,
  Sparkles,
  Settings
} from "lucide-react";

export default function App() {
  const [screen, setScreen] = useState<"launcher" | "editor">("launcher");
  const [activeViewMode, setActiveViewMode] = useState<"graph" | "storyboard" | "script" | "project">("storyboard");
  const [project, setProject] = useState<ProjectIR>(createEmptyProject());
  const [invoker, setInvoker] = useState<CommandInvoker>(() => new CommandInvoker(createEmptyProject()));
  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "problems" | "variables" | "conditions" | "debugger" | "plugins" | "marketplace">("inspector");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportWebReport, setExportWebReport] = useState<WebConstraint[] | null>(null);
  const [cloudBuild, setCloudBuild] = useState<CloudBuildRequest | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
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

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PixiVisualNovelEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [isPlayingLive, setIsPlayingLive] = useState<boolean>(false);

  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; level: "info" | "warn" | "error"; msg: string }>>([]);
  const [problems, setProblems] = useState<StoryProblem[]>([]);

  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({
    stories: true,
    characters: false,
    backgrounds: false,
  });

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
  const [consoleCollapsed, setConsoleCollapsed] = useState<boolean>(true);

  const [dlgSpeakerId, setDlgSpeakerId] = useState<string>("");
  const [dlgText, setDlgText] = useState<string>("");
  const [dlgExpression] = useState<string>("happy");
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
  const [assetName, setAssetName] = useState<string>("");
  const [assetPath, setAssetPath] = useState<string>("assets/backgrounds/room.png");

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      return next;
    });
  };

  const addLog = (level: "info" | "warn" | "error", msg: string) => {
    const now = new Date();
    setConsoleLogs(prev => [{ time: now.toLocaleTimeString(), level, msg }, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("projectvne.recentProjects");
      if (raw) {
        const parsed = JSON.parse(raw);
        setRecentProjects(parsed);
        if (Array.isArray(parsed) && parsed.some((item) => !item.projectData)) {
          fetch("/stories/demo-story.json")
            .then(res => res.ok ? res.json() : null)
            .then((demo) => {
              if (!demo) return;
              const normalized = parsed.map((item: any) => (
                item.projectData
                  ? item
                  : item.title === "Demo Visual Novel"
                    ? { ...item, projectData: JSON.stringify(demo) }
                    : item
              ));
              setRecentProjects(normalized);
              localStorage.setItem("projectvne.recentProjects", JSON.stringify(normalized));
            })
            .catch(() => {});
        }
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
    setActiveViewMode("storyboard");
    setScreen("editor");
    persistRecentProject(migrated);
    addLog("info", `Opened project "${migrated.meta.title}"`);
  };

  useEffect(() => {
    setProblems(ProblemsChecker.check(project, { unavailableBlockTypes: pluginHost.getUnavailableBlockTypes() }));
  }, [project, pluginHost]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
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
        onChoice: (_, opts) => addLog("info", `Presented a choice with ${opts.length} option${opts.length === 1 ? "" : "s"}`),
        onStoryEnd: () => addLog("info", "Reached the end of the scene."),
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
          }
        } catch (e) { console.warn("PixiJS loadStory failed:", e); }
      })();
    } catch (err) {
      console.warn("PixiJS init failed:", err);
    }

    return () => {
      cancelled = true;
      if (engineRef.current) {
        try { engineRef.current.destroy(); } catch (_) {}
        engineRef.current = null;
      }
    };
  }, [selectedSceneId, pluginHost]);

  const executeCommand = (cmd: any): boolean => {
    const res = invoker.execute(cmd);
    if (res.success && res.state) {
      // Commands never touch the per-project AI flag, and the invoker snapshot
      // predates it, so preserve the live setting from App state.
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
      return true;
    } else {
      addLog("error", `Couldn't apply that change: ${res.error}`);
      return false;
    }
  };

  const toggleAiEnabled = (v: boolean) => {
    setProject(p => ({ ...p, ai: { enabled: v } }));
    addLog("info", v ? "AI Assistant enabled for this project" : "AI Assistant disabled for this project");
    if (!v) setAiPanelOpen(false);
  };

  const applyAiCommand = (command: IRCommand): boolean => executeCommand(command);

  const handleUndo = () => {
    const res = invoker.undo();
    if (res.success && res.state) {
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
    }
  };

  const handleRedo = () => {
    const res = invoker.redo();
    if (res.success && res.state) {
      const nextState = res.state;
      setProject(prev => ({ ...nextState, ai: prev.ai }));
    }
  };

  const handleGraphNodeSelect = (nodeId: string, nodeType: string, data: any) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeType(nodeType);
    setSelectedNodeData(data);
  };

  const handleSaveProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.meta.title || "story"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("info", "Project saved.");
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const migrated = MigrationRunner.migrate(JSON.parse(event.target?.result as string));
        openProject(migrated);
      } catch (err) {
        addLog("error", `Couldn't open that file: ${err}`);
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
    addLog("info", "Preparing your desktop build for Windows, macOS, and Linux...");
    const result = await ProjectExporter.exportDesktopBundle(project, {
      target: 'windows',
      outputDir: './exports',
      projectName: project.meta.title || 'story'
    });
    if (result.success) {
      addLog("info", `Export finished: ${result.outputPath}`);
      addLog("info", "Your build is ready — one project file works on Windows, macOS, and Linux.");
    } else {
      addLog("error", `Export didn't finish: ${result.error}`);
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
    addLog("info", `Web export validated (${constraints.filter((c) => c.status === 'pass').length}/${constraints.length} checks pass) — story bundle downloaded. Host it with the Web export runtime.`);
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
    addLog("info", `Android export prepared: ${res.scaffold.packageName} (APK packaging needs the Android toolchain — see docs).`);
  };

  const handleCloudBuild = () => {
    const res = prepareCloudBuildRequest(project, 'android');
    if (!res.ok || !res.request) {
      addLog("error", `Cloud build failed: ${res.error}`);
      return;
    }
    setCloudBuild(res.request);
    addLog("info", `Cloud build request ready (api v${res.request.apiVersion}, ~${res.request.estimatedCompute} compute units). Signing is handled by the cloud build service.`);
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
      expression: dlgExpression
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

  const handlePluginImport = async (pluginId: string, importerId: string, file: File) => {
    let fileText = "";
    try {
      fileText = await file.text();
    } catch (err) {
      addLog("error", `Couldn't read that file: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const result = pluginHost.runImporter(pluginId, importerId, { fileName: file.name, fileText, project });
    if (result.error) {
      addLog("error", result.error);
      return;
    }
    for (const log of result.logs || []) addLog("info", log);
    let imported = 0;
    for (const asset of result.assets || []) {
      const ok = executeCommand(new CreateAssetCommand({
        name: asset.name, type: asset.type, fileReference: asset.fileReference, tags: asset.tags
      }));
      if (ok) imported++;
    }
    if (imported === 0) addLog("error", "The importer produced no usable assets.");
    else addLog("info", `Imported ${imported} asset${imported === 1 ? "" : "s"} via plugin.`);
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
    setActiveViewMode("storyboard");
    setScreen("editor");
    setShowNewProjectModal(false);
    setNewProjectName("");
  };

  const currentScene = selectedSceneId ? project.scenes[selectedSceneId] : null;
  const variableSnapshot = engineState?.variables || buildDefaultVariableState(project);
  const isAdvancedView = activeViewMode === "graph" || activeViewMode === "project";
  const showConsole = !consoleCollapsed;

  useEffect(() => {
    setConsoleCollapsed(!isAdvancedView);
  }, [activeViewMode, isAdvancedView]);

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)]";
  const btnPrimary = "px-4 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] font-semibold text-xs text-[var(--text-primary)] rounded transition-colors";
  const btnCancel = "px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors";
  const modalWrap = "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50";
  const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl p-5 max-w-md w-full flex flex-col gap-3.5 shadow-xl";

  const newProjectModal = showNewProjectModal && (
    <div className={modalWrap}><div className={modalBox}>
      <h3 className="text-sm font-bold text-[var(--text-primary)]">New Project</h3>
      <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Project name</label>
        <input className={inputCls} value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="My Visual Novel" autoFocus/>
      </div>
      <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Starter template</label>
        <div className="grid grid-cols-2 gap-2">
          {([["blank","Blank","Start from an empty story."],["demo","One-scene demo","A small sample story to explore."]] as const).map(([value,label,desc]) => (
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
  );

  if (screen === "launcher") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
        <header className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          <button className="flex items-center gap-2" onClick={() => setScreen("launcher")} aria-label="Projects">
            <div className="w-7 h-7 rounded bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center font-bold text-[10px] text-[var(--text-muted)]">VN</div>
            <div className="text-left">
              <div className="text-sm font-semibold">ProjectVNE</div>
              <div className="text-[10px] text-[var(--text-ghost)]">Project launcher</div>
            </div>
          </button>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <button className="px-3 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)]" onClick={() => setScreen("launcher")}>Projects</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-5">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={() => setShowNewProjectModal(true)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-panel)] p-5 text-left hover:bg-[var(--bg-elevated)] transition-colors">
                <div className="text-sm font-semibold mb-1">New Project</div>
                <div className="text-xs text-[var(--text-muted)]">Start with a blank story or a demo.</div>
              </button>
              <label className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-panel)] p-5 text-left hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
                <div className="text-sm font-semibold mb-1">Open Project</div>
                <div className="text-xs text-[var(--text-muted)]">Load a project JSON file.</div>
                <input type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
              </label>
            </section>

            <section className="space-y-3">
              <div className="text-xs uppercase tracking-widest text-[var(--text-ghost)] font-bold">Recent Projects</div>
              {recentProjects.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">No recent projects yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {recentProjects.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-panel)] p-4">
                      <div className="h-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-3 flex items-center justify-center text-[10px] text-[var(--text-ghost)]">
                        {item.thumbnail ? item.thumbnail : "Thumbnail"}
                      </div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mb-3">{new Date(item.modifiedAt).toLocaleString()}</div>
                      <button className="text-xs px-3 py-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]" onClick={() => openProject(JSON.parse(item.projectData))}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      {newProjectModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden select-none">

      {/* ===== TOP NAV ===== */}
      <header className="h-10 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2" onClick={() => setScreen("launcher")} aria-label="Projects">
            <div className="w-6 h-6 rounded bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center font-bold text-[10px] text-[var(--text-muted)]">VN</div>
            <span className="text-xs font-semibold text-[var(--text-primary)]">ProjectVNE</span>
            <span className="text-[10px] text-[var(--text-ghost)] hidden sm:block">Visual Novel Studio</span>
          </button>
          <nav className="flex items-center gap-0 text-[11px] text-[var(--text-muted)]">
            {["File","Edit","View","Projects","Tools","Help"].map(m => (
              <span key={m} className="px-2 py-1 hover:text-[var(--text-primary)] cursor-pointer rounded hover:bg-[var(--bg-hover)] transition-colors">{m}</span>
            ))}
          </nav>
        </div>

        <div className="flex items-center bg-[var(--bg-surface)] p-0.5 rounded-lg border border-[var(--border-subtle)] gap-0.5">
          {([
            { mode: "storyboard", label: "Storyboard", icon: Layers },
            { mode: "graph", label: "Scene Graph", icon: Split },
            { mode: "project", label: "Project Flow", icon: FolderTree },
            { mode: "script", label: "Script", icon: FileCode },
          ] as const).map(({ mode, label, icon: Icon }) => (
            <button key={mode} onClick={() => setActiveViewMode(mode)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                activeViewMode === mode
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}>
              <Icon size={11}/>{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsPlayingLive(!isPlayingLive)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--green-bg)] hover:brightness-110 border border-[var(--green-border)] text-[var(--green-text)] rounded-md text-xs font-semibold transition-all shadow-sm">
            <Play size={11} className="fill-current" /> Play
          </button>

          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md px-2 py-1 text-xs gap-1">
            <span className="text-[var(--text-ghost)] text-[10px]">Scene:</span>
            <select value={selectedSceneId || ""} onChange={e => setSelectedSceneId(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] font-mono focus:outline-none cursor-pointer max-w-[130px]">
              {Object.entries(project.scenes).map(([id, sc]) => (
                <option key={id} value={id} className="bg-[var(--bg-panel)]">{sc.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center text-[var(--text-ghost)] gap-0.5">
            <button onClick={handleUndo} data-testid="undo" disabled={!invoker.canUndo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors"><Undo2 size={13}/></button>
            <button onClick={handleRedo} data-testid="redo" disabled={!invoker.canRedo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors"><Redo2 size={13}/></button>
            <button onClick={handleSaveProject} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"><Save size={13}/></button>
            <label className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer">
              <FolderOpen size={13}/>
              <input type="file" accept=".json" onChange={handleLoadProject} className="hidden"/>
            </label>
            <button onClick={() => setShowExportModal(true)} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Export…" data-testid="open-export"><Download size={13}/></button>
          </div>

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

          {project.ai?.enabled && (
            <button
              onClick={() => setAiPanelOpen(v => !v)}
              data-testid="ai-toolbar-toggle"
              title="AI Assistant"
              className={`p-1.5 rounded-md transition-colors ${aiPanelOpen ? "text-[var(--accent)] bg-[var(--bg-hover)]" : "text-[var(--text-ghost)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
            >
              <Sparkles size={13}/>
            </button>
          )}

          <button onClick={() => setShowSettings(true)} data-testid="open-settings" className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Settings"><Settings size={13}/></button>

          <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex overflow-hidden">

        {/* ===== LEFT SIDEBAR ===== */}
        <aside className="w-56 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 overflow-hidden">
          {/* PROJECT TREE */}
          <div className="flex-1 flex flex-col border-b border-[var(--border-subtle)] overflow-hidden min-h-0">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] flex items-center gap-1.5">
                <FolderTree size={11}/> Project
              </span>
              <button onClick={() => setShowNewSceneModal(true)} className="text-[var(--text-ghost)] hover:text-[var(--text-secondary)] transition-colors"><Plus size={13}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-[11px] font-mono">
              <div className="text-[var(--text-ghost)] px-1 py-0.5 text-[10px] flex items-center gap-1">
                <FolderTree size={10} className="opacity-50"/> {project.meta.title || "project"}
              </div>

              {/* Scenes */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, stories: !p.stories }))}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
                  {treeExpanded.stories ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span>scenes</span>
                </div>
                {treeExpanded.stories && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.scenes).map(([id, sc]) => (
                      <div key={id} onClick={() => { setSelectedSceneId(id); setActiveViewMode("storyboard"); }}
                        className={`flex items-center justify-between px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                          selectedSceneId === id
                            ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        }`}>
                        <span className="truncate">{sc.title}</span>
                        {project.flow.entrySceneId === id && <span className="text-[9px] text-[var(--green-text)] ml-1">●</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Characters */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, characters: !p.characters }))}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
                  {treeExpanded.characters ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span>characters</span>
                </div>
                {treeExpanded.characters && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.characters).map(([id, ch]) => (
                      <div key={id} className="text-[var(--text-muted)] px-2 py-0.5 truncate">{ch.name}</div>
                    ))}
                    <button onClick={() => setShowNewCharModal(true)} className="text-[var(--text-ghost)] hover:text-[var(--text-muted)] px-2 py-0.5 block transition-colors text-[10px]">+ new character</button>
                  </div>
                )}
              </div>

              {/* Backgrounds */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, backgrounds: !p.backgrounds }))}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer py-0.5 px-1 rounded hover:bg-[var(--bg-hover)] transition-colors">
                  {treeExpanded.backgrounds ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span>backgrounds</span>
                </div>
                {treeExpanded.backgrounds && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.assets).filter(([_, a]) => a.type === "background").map(([id, a]) => (
                      <div key={id} className="text-[var(--text-muted)] px-2 py-0.5 truncate">{a.name}</div>
                    ))}
                    <button onClick={() => setShowNewAssetModal(true)} className="text-[var(--text-ghost)] hover:text-[var(--text-muted)] px-2 py-0.5 block transition-colors text-[10px]">+ import asset</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NODE LIBRARY */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[var(--bg-surface)]">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)] flex items-center gap-1.5"><LayoutGrid size={11}/> Node Library</span>
            </div>
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search size={10} className="absolute left-2.5 top-2 text-[var(--text-ghost)]"/>
                <input type="text" placeholder="Search..." className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-md pl-6 pr-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 text-[11px]">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Flow</div>
                {[["🟢","Start","Entry"],["⬛","End","Exit"]].map(([icon,label,sub]) => (
                  <div key={label} className="px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] cursor-pointer transition-all">
                    <span>{icon} {label}</span><span className="text-[9px] text-[var(--text-ghost)]">{sub}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Story</div>
                <button onClick={() => setShowAddDialogueModal(true)} className="w-full px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all">
                  <span>💬 Dialogue</span><Plus size={10} className="text-[var(--text-ghost)]"/>
                </button>
                <button onClick={() => setShowAddChoiceModal(true)} className="w-full px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all">
                  <span>🔀 Choice</span><Plus size={10} className="text-[var(--text-ghost)]"/>
                </button>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Presentation</div>
                <button onClick={() => setShowAddCharacterBlockModal(true)} className="w-full px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all">
                  <span>👤 Show Character</span><Plus size={10} className="text-[var(--text-ghost)]"/>
                </button>
              </div>
              {pluginHost.getNodeTypes().length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] px-1 mb-1">Plugins</div>
                  {pluginHost.getNodeTypes().map(({ pluginId, def }) => (
                    <button
                      key={def.blockType}
                      data-testid={`node-library-${def.blockType}`}
                      onClick={() => openPluginBlockModal(def.blockType, pluginId)}
                      disabled={!selectedSceneId}
                      title={selectedSceneId ? def.description : "Select a scene first"}
                      className="w-full px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-all"
                    >
                      <span>{def.icon ? `${def.icon} ` : ""}{def.title}</span><Plus size={10} className="text-[var(--text-ghost)]"/>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ===== CENTER CANVAS ===== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-app)]">
          {/* Breadcrumb */}
          <div className="h-8 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-ghost)] font-mono text-[11px]">scenes /</span>
              <span className="text-[var(--text-primary)] font-semibold">{currentScene?.title || "No Scene"}</span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono bg-[var(--bg-card)] px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)]">{currentScene?.blocks.length ?? 0} blocks</span>
            </div>
          </div>

          {/* Viewport */}
          <div className="flex-1 relative overflow-hidden">
            {activeViewMode === "graph" ? (
              <StoryGraphCanvas project={project} activeSceneId={selectedSceneId} theme={theme} onSelectNode={handleGraphNodeSelect}/>
            ) : activeViewMode === "project" ? (
              <ProjectFlowGraph project={project} theme={theme} onSelectScene={setSelectedSceneId}/>
            ) : activeViewMode === "storyboard" ? (
              <div className="w-full h-full overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto">
                {currentScene?.blocks.map((block, idx) => (
                  <div key={block.id || idx} onClick={() => handleGraphNodeSelect(`block-${block.id||idx}`, block.type, block)}
                    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-default)] cursor-pointer transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">#{idx+1}</span>
                        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{block.type === "plugin" ? (block as any).pluginType : block.type}</span>
                      </div>
                      <span className="text-[9px] font-mono text-[var(--text-ghost)]">{block.id?.slice(-8) || ''}</span>
                    </div>
                    <div className="p-4">
                      {block.type === "dialogue" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
                              {block.characterId && project.characters[block.characterId]
                                ? <span className="text-[10px] font-bold text-[var(--text-muted)]">{project.characters[block.characterId].name[0]}</span>
                                : <span className="text-[10px] text-[var(--text-ghost)]">N</span>
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
                          <div className="w-12 h-12 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
                            {project.characters[block.characterId]
                              ? <span className="text-[12px] font-bold text-[var(--text-muted)]">{project.characters[block.characterId].name[0]}</span>
                              : <span className="text-[12px] text-[var(--text-ghost)]">?</span>
                            }
                          </div>
                          <div className="space-y-1">
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
                              <div key={opt.id || optIdx} className="flex items-center gap-2 p-2 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)]">
                                <span className="text-[10px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{optIdx + 1}</span>
                                <span className="text-[11px] text-[var(--text-secondary)]">{opt.text}</span>
                                {opt.destinationSceneId && (
                                  <span className="text-[9px] text-[var(--text-muted)] ml-auto">→ {project.scenes[opt.destinationSceneId]?.title || 'Unknown'}</span>
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
                            <div className="p-3 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-dim)]">
                              <div className="text-[11px] font-semibold text-[var(--amber-text)]">Missing capability: {pBlock.pluginType}</div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-1">This block needs a plugin that is currently disabled. Enable it in the Plugins panel.</div>
                            </div>
                          );
                        }
                        let vm = null;
                        try {
                          vm = entry.def.toViewModel({ data: pBlock.data }, project);
                        } catch { vm = null; }
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
                ))}
              </div>
            ) : (
              <div className="w-full h-full p-6 overflow-y-auto font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-app)]">
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="text-[12px] text-[var(--text-secondary)]">
                    Read-only generated script view. Visual edits remain the source of truth, and this text mirrors the selected scene.
                  </div>
                  <pre className="whitespace-pre-wrap leading-6 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)]">
                    {selectedSceneId ? generateSceneTextView(project, selectedSceneId) : "// Select a scene"}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM DOCK */}
          <div className="h-48 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex shrink-0">
            {/* Scene Preview */}
            <div className="w-64 border-r border-[var(--border-subtle)] flex flex-col">
              <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">
                <span className="flex items-center gap-1.5"><Eye size={10}/> Preview</span>
                <span className="text-[var(--text-faint)] font-mono">800×600</span>
              </div>
              <div className="flex-1 flex items-center justify-center p-1.5 overflow-hidden">
                <div ref={canvasContainerRef} className="w-full h-full max-h-[148px] aspect-[4/3] rounded-md overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-app)]"/>
              </div>
            </div>

            {/* Console */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">
                <button onClick={() => setConsoleCollapsed(prev => !prev)} className="flex items-center gap-1.5 hover:text-[var(--text-muted)] transition-colors">
                  <Terminal size={10}/> Console
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setConsoleLogs([])} className="text-[var(--text-ghost)] hover:text-[var(--text-muted)] transition-colors">Clear</button>
                  <button onClick={() => setConsoleCollapsed(prev => !prev)} className="text-[var(--text-ghost)] hover:text-[var(--text-muted)] transition-colors">
                    {showConsole ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>
              {showConsole ? (
                <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-0.5">
                  {consoleLogs.length === 0 && <div className="text-[var(--text-faint)] italic">No events yet.</div>}
                  {consoleLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[var(--text-ghost)] text-[10px] shrink-0">{log.time}</span>
                      <span className={`text-[9px] uppercase font-bold shrink-0 ${log.level==="info"?"text-[var(--text-muted)]":log.level==="warn"?"text-[var(--amber-text)]":"text-[var(--error-text)]"}`}>{log.level}</span>
                      <span className="text-[var(--text-muted)] truncate">{log.msg}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] text-[var(--text-ghost)] italic">
                  Console collapsed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside className={`${project.ai?.enabled && aiPanelOpen ? "w-80" : "w-64"} bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col shrink-0`}>
          <div className="flex border-b border-[var(--border-subtle)] text-[11px] overflow-x-auto">
            {(project.ai?.enabled
              ? (["inspector","problems","variables","conditions","debugger","plugins","marketplace","ai"] as const)
              : (["inspector","problems","variables","conditions","debugger","plugins","marketplace"] as const)
            ).map(tab => {
              const labels: Record<string,string> = { inspector:"Inspector", problems:`Problems (${problems.length})`, variables:"Variables", conditions:"Conditions", debugger:"Debugger", plugins:"Plugins", marketplace:"Marketplace", ai:"AI" };
              const active = tab === "ai" ? aiPanelOpen : inspectorTab === tab;
              return (
                <button key={tab} data-testid={tab === "ai" ? "ai-tab" : tab === "plugins" ? "plugins-tab" : tab === "marketplace" ? "marketplace-tab" : undefined} onClick={() => { if (tab === "ai") setAiPanelOpen(true); else setInspectorTab(tab); }}
                  className={`flex-none px-2.5 py-2 text-center transition-colors font-semibold whitespace-nowrap ${
                    active ? "text-[var(--text-primary)] border-b-2 border-[var(--accent)] bg-[var(--bg-surface)]" : "text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
                  }`}>{labels[tab]}</button>
              );
            })}
          </div>

          <div className={project.ai?.enabled && aiPanelOpen ? "flex-1 flex flex-col min-h-0" : "flex-1 overflow-y-auto p-3 space-y-3 text-[11px]"}>
            {project.ai?.enabled && aiPanelOpen ? (
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
                onOpenSettings={() => setShowSettings(true)}
              />
            ) : (
            <>
            {inspectorTab === "inspector" && (
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] mb-1">
                    {selectedNodeType ? selectedNodeType.replace("Node","").toUpperCase() + " NODE" : "NODE INSPECTOR"}
                  </div>
                  <div className="text-[10px] text-[var(--text-ghost)] font-mono">{selectedNodeId || "— none selected —"}</div>
                </div>
                {selectedNodeData ? (
                  <div className="space-y-2 p-2.5 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                    {selectedNodeData.type === "plugin" && (() => {
                      const pBlock = selectedNodeData as any;
                      const entry = pluginHost.nodeTypeFor(pBlock.pluginType);
                      const label = entry?.def.title || pBlock.pluginType;
                      let vm = null;
                      if (entry) {
                        try { vm = entry.def.toViewModel({ data: pBlock.data }, project); } catch { vm = null; }
                      }
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {entry?.def.icon && <span>{entry.def.icon}</span>}
                            <div>
                              <div className="text-[11px] font-bold text-[var(--text-primary)]">{label}</div>
                              <div className="text-[9px] font-mono text-[var(--text-ghost)]">{pBlock.pluginType}</div>
                            </div>
                          </div>
                          {vm ? <PluginViewModelView vm={vm} /> : (
                            <div className="text-[10px] text-[var(--text-ghost)]">No plugin installed for this block type.</div>
                          )}
                        </div>
                      );
                    })()}
                    {selectedNodeData.characterName && (
                      <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Speaker</label>
                        <div className="p-1.5 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">{selectedNodeData.characterName as string}</div></div>
                    )}
                    {selectedNodeData.content && (
                      <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Dialogue</label>
                        <div className="p-1.5 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] italic">"{selectedNodeData.content as string}"</div></div>
                    )}
                    {selectedNodeData.prompt && (
                      <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Choice Prompt</label>
                        <div className="p-1.5 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">"{selectedNodeData.prompt as string}"</div></div>
                    )}
                    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Playback</div>
                      <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">Auto Continue</span><input type="checkbox" defaultChecked/></div>
                      <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">Fade (ms)</span><span className="font-mono text-[var(--text-ghost)]">600</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-[var(--text-ghost)] italic text-[11px]">Click a node to inspect it.</div>
                )}
              </div>
            )}

            {inspectorTab === "variables" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Story Variables</span>
                  <button onClick={() => setShowNewVarModal(true)} className="p-1 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-md border border-[var(--border-subtle)] transition-colors"><Plus size={10}/></button>
                </div>
                {Object.entries(project.variables).map(([id, v]) => (
                  <div key={id} className="p-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-[var(--text-primary)] text-[11px]">{v.displayName || v.name}</span>
                      <span className="text-[9px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{v.type}</span>
                    </div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[var(--text-ghost)]">Value:</span>
                      <span className="font-mono text-[var(--green-text)]">
                        {Array.isArray(v.defaultValue) ? v.defaultValue.join(", ") : String(engineState?.variables?.[id] ?? v.defaultValue)}
                      </span>
                    </div>
                    {(v.type === "counter" || v.type === "relationship") && (
                      <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
                        <span>Range: {v.minValue ?? 0} - {v.maxValue ?? 100}</span>
                      </div>
                    )}
                    {v.type === "tagCollection" && v.allowedTags && (
                      <div className="text-[9px] text-[var(--text-muted)] mt-1">
                        Tags: {v.allowedTags.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(project.variables).length === 0 && <div className="text-[var(--text-ghost)] italic text-center py-6">No variables defined.</div>}
              </div>
            )}

            {inspectorTab === "conditions" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Conditions</span>
                  <button className="p-1 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-md border border-[var(--border-subtle)] transition-colors"><Plus size={10}/></button>
                </div>
                {Object.keys(project.conditions).length === 0 ? (
                  <div className="text-[var(--text-ghost)] italic text-center py-6">No conditions defined.</div>
                ) : (
                  Object.entries(project.conditions).map(([id, cond]) => (
                    <div key={id} className="p-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[var(--text-primary)] text-[11px]">{cond.name}</span>
                        <span className="text-[9px] font-mono text-[var(--text-ghost)]">{id.slice(-6)}</span>
                      </div>
                      <ConditionEditor
                        project={project}
                        condition={cond.expression}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {inspectorTab === "debugger" && (
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-2">Runtime State</span>
                  <div className="space-y-2">
                    {Object.keys(project.variables).length === 0 ? (
                      <div className="text-[var(--text-ghost)] italic text-center py-4 text-[11px]">No variables to inspect</div>
                    ) : (
                      Object.entries(project.variables).map(([id, v]) => (
                        <div key={id} className="p-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-[var(--text-primary)] text-[11px]">{v.displayName || v.name}</span>
                            <span className="text-[9px] font-mono text-[var(--text-ghost)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-md">{v.type}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[var(--text-muted)]">Current:</span>
                            <span className="font-mono text-[var(--green-text)] text-[11px]">
                              {Array.isArray(engineState?.variables?.[id])
                                ? (engineState?.variables?.[id] as string[]).join(", ")
                                : String(engineState?.variables?.[id] ?? v.defaultValue)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">Default:</span>
                            <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                              {Array.isArray(v.defaultValue) ? v.defaultValue.join(", ") : String(v.defaultValue)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {currentScene && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-2">Branch Analysis</span>
                    <div className="space-y-2">
                      {currentScene.blocks.filter(b => b.type === 'choice').map((choiceBlock, idx) => {
                        const choice = choiceBlock as any;
                        return (
                          <div key={idx} className="p-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)]">
                            <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-2">"{choice.prompt}"</div>
                            <div className="space-y-1">
                              {choice.options?.map((opt: any, optIdx: number) => {
                                const availability = evaluateChoiceAvailability(opt, project, variableSnapshot);
                                const targetScene = opt.destinationSceneId ? project.scenes[opt.destinationSceneId] : null;

                                return (
                                  <div key={optIdx} className="text-[10px] p-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={availability.available ? "text-[var(--green-text)]" : "text-[var(--amber-text)]"}>
                                          {availability.available ? "✓" : "!"}
                                        </span>
                                        <span className="text-[var(--text-secondary)]">{opt.text}</span>
                                      </div>
                                      {targetScene && (
                                        <span className="text-[var(--text-muted)]">→ {targetScene.title}</span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[9px] text-[var(--text-muted)]">
                                      {availability.explanation}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {currentScene.blocks.filter(b => b.type === 'choice').length === 0 && (
                        <div className="text-[var(--text-ghost)] italic text-center py-4 text-[11px]">No choices in current scene</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {inspectorTab === "problems" && (
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block">Integrity</span>
                {problems.length === 0 ? (
                  <div className="p-3 bg-[var(--green-dim)] border border-[var(--green-border)] rounded-lg text-[var(--green-text)] text-[11px] text-center font-medium">✓ All nodes valid</div>
                ) : problems.map(p => (
                  <div key={p.id} className="p-2 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg text-[11px] text-[var(--error-text)]">
                    <div className="font-semibold">{p.message}</div>
                    {p.fixSuggestion && <div className="text-[10px] text-[var(--text-muted)] mt-1">💡 {p.fixSuggestion}</div>}
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === "plugins" && (
              <PluginManager host={pluginHost} project={project} onTogglePlugin={handleTogglePlugin} />
            )}
            {inspectorTab === "marketplace" && (
              <MarketplaceManager
                host={pluginHost}
                project={project}
                onTogglePlugin={handleTogglePlugin}
                onInstalledChange={() => { setPluginsVersion(v => v + 1); addLog("info", "Marketplace changed. Plugin list refreshed."); }}
              />
            )}
            </>
            )}
          </div>
        </aside>
      </div>

      {/* ===== STATUS BAR ===== */}
      <footer className="h-5 bg-[var(--bg-panel)] border-t border-[var(--border-subtle)] px-3 flex items-center justify-between text-[10px] text-[var(--text-ghost)] shrink-0 font-mono">
        <div className="flex items-center gap-4">
          <span>{project.meta.title || "Untitled"}</span>
          <span className="flex items-center gap-1 text-[var(--green-text)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--green-text)] animate-pulse inline-block"/>Ready</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PixiJS v8</span>
          <span>IR v{project.meta.schemaVersion}</span>
          <span>v0.1.0</span>
        </div>
      </footer>

      {/* ===== MODALS ===== */}
      {showNewSceneModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Create Scene</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Title</label>
            <input className={inputCls} value={newSceneTitle} onChange={e=>setNewSceneTitle(e.target.value)} placeholder="chapter_one" autoFocus onKeyDown={e=>e.key==="Enter"&&submitAddScene()}/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewSceneModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddScene} className={btnPrimary}>Create</button></div>
        </div></div>
      )}

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
            <textarea className={inputCls + " resize-none"} rows={3} value={dlgText} onChange={e=>setDlgText(e.target.value)} placeholder="Hey, you made it!"/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddDialogueModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddDialogue} className={btnPrimary}>Add Node</button></div>
        </div></div>
      )}

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

      {showNewCharModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Create Character</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Name</label>
            <input className={inputCls} value={charName} onChange={e=>setCharName(e.target.value)} placeholder="Luna" autoFocus/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewCharModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddCharacter} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

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
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Default</label>
            <input className={inputCls + " font-mono"} value={varDefault} onChange={e=>setVarDefault(e.target.value)} placeholder={varType === "boolean" ? "true" : varType === "tagCollection" ? "tag1,tag2" : "0"}/>
          </div>
          {(varType === "counter" || varType === "relationship") && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Min Value</label>
                <input className={inputCls + " font-mono"} value={varMinValue} onChange={e=>setVarMinValue(e.target.value)} placeholder="0"/>
              </div>
              <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Max Value</label>
                <input className={inputCls + " font-mono"} value={varMaxValue} onChange={e=>setVarMaxValue(e.target.value)} placeholder="100"/>
              </div>
            </div>
          )}
          {varType === "tagCollection" && (
            <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Allowed Tags (comma-separated)</label>
              <input className={inputCls + " font-mono"} value={varAllowedTags} onChange={e=>setVarAllowedTags(e.target.value)} placeholder="warrior, mage, rogue"/>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewVarModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddVariable} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

      {showNewAssetModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Import Asset</h3>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">Name</label>
            <input className={inputCls} value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="bg_room.jpg" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[var(--text-muted)] mb-1">File Path</label>
            <input className={inputCls + " font-mono"} value={assetPath} onChange={e=>setAssetPath(e.target.value)}/>
          </div>
          {pluginHost.getImporters().length > 0 && (
            <div className="border-t border-[var(--border-subtle)] pt-2.5">
              <div className="text-[10px] text-[var(--text-muted)] mb-1.5">Import via plugin</div>
              <div className="space-y-1.5">
                {pluginHost.getImporters().map(({ id, pluginId, def }) => (
                  <label key={id} className="flex flex-col gap-1 p-2 bg-[var(--bg-surface)] rounded-md border border-[var(--border-subtle)] cursor-pointer">
                    <span className="text-[11px] text-[var(--text-secondary)]">{def.title}</span>
                    {def.description && <span className="text-[9px] text-[var(--text-muted)]">{def.description}</span>}
                    <input
                      type="file"
                      data-testid={`importer-${id}`}
                      accept={def.accepts.join(",")}
                      className="text-[10px] text-[var(--text-muted)] cursor-pointer"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePluginImport(pluginId, id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={()=>setShowNewAssetModal(false)} className={btnCancel}>Cancel</button>
            <button onClick={()=>{ if(!assetName.trim()) return; executeCommand(new CreateAssetCommand({name:assetName,type:"background",fileReference:assetPath})); setShowNewAssetModal(false); }} className={btnPrimary}>Save</button>
          </div>
        </div></div>
      )}

      {pluginBlockModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Add {pluginBlockModal.title}</h3>
          <div className="text-[10px] text-[var(--text-muted)] -mt-1">A plugin node from the "{pluginBlockModal.pluginId}" plugin.</div>
          <div className="space-y-2">
            {pluginBlockModal.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">{field.label}</label>
                {field.type === "boolean" ? (
                  <input type="checkbox" checked={field.value === "true"} className="accent-[var(--accent)]"
                    onChange={(e) => setPluginBlockModal(m => m ? { ...m, fields: m.fields.map(f => f.key === field.key ? { ...f, value: e.target.checked ? "true" : "false" } : f) } : m)} />
                ) : field.key === "text" || field.key === "description" ? (
                  <textarea className={inputCls + " resize-none"} rows={3} value={field.value}
                    onChange={(e) => setPluginBlockModal(m => m ? { ...m, fields: m.fields.map(f => f.key === field.key ? { ...f, value: e.target.value } : f) } : m)} />
                ) : field.type === "number" ? (
                  <input type="number" className={inputCls} value={field.value}
                    onChange={(e) => setPluginBlockModal(m => m ? { ...m, fields: m.fields.map(f => f.key === field.key ? { ...f, value: e.target.value } : f) } : m)} />
                ) : (
                  <input className={inputCls} value={field.value}
                    onChange={(e) => setPluginBlockModal(m => m ? { ...m, fields: m.fields.map(f => f.key === field.key ? { ...f, value: e.target.value } : f) } : m)} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={()=>setPluginBlockModal(null)} className={btnCancel}>Cancel</button>
            <button onClick={submitAddPluginBlock} className={btnPrimary}>Add Node</button>
          </div>
        </div></div>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          theme={theme}
          toggleTheme={toggleTheme}
          aiSettings={{
            enabled: !!project.ai?.enabled,
            onToggleEnabled: toggleAiEnabled,
            prefs,
            setPrefs,
            keys,
            loadKey,
            saveKey,
            storageMode,
          }}
        />
      )}

      {showExportModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Export</h3>
          <div className="text-[10px] text-[var(--text-muted)] -mt-1">Choose an export target. Export runs the same runtime the editor preview uses, so what you preview is what players get.</div>
          <div className="space-y-2">
            <button onClick={handleExportProject} data-testid="export-desktop" className="w-full text-left p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]">
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">Desktop (Windows / macOS / Linux)</div>
              <div className="text-[9px] text-[var(--text-muted)]">One project file wrapped for all three desktop shells.</div>
            </button>
            <button onClick={handleExportWeb} data-testid="export-web" className="w-full text-left p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]">
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">Web</div>
              <div className="text-[9px] text-[var(--text-muted)]">Static bundle with persistent saves. Constraints are validated before export.</div>
            </button>
            <button onClick={handleExportAndroid} data-testid="export-android" className="w-full text-left p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]">
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">Android</div>
              <div className="text-[9px] text-[var(--text-muted)]">Tauri Android scaffold. Final APK needs the Android toolchain (documented).</div>
            </button>
            <button onClick={handleCloudBuild} data-testid="export-cloud" className="w-full text-left p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]">
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">Cloud Build</div>
              <div className="text-[9px] text-[var(--text-muted)]">Meters compute and handles signing for you (service contract documented).</div>
            </button>
          </div>

          {exportWebReport && (
            <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Web export constraints</div>
              {exportWebReport.map((c) => (
                <div key={c.id} className="text-[10px] flex gap-2">
                  <span className={c.status === "pass" ? "text-[var(--green-text)]" : c.status === "warn" ? "text-[var(--amber-text)]" : "text-[var(--error-text)]"}>{c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : "✕"}</span>
                  <span className="text-[var(--text-muted)]">{c.label}: {c.detail}</span>
                </div>
              ))}
            </div>
          )}

          {cloudBuild && (
            <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-ghost)]">Cloud build request</div>
              <div className="text-[10px] text-[var(--text-muted)]">Target: {cloudBuild.target} · hash {cloudBuild.storyHash} · ~{cloudBuild.estimatedCompute} compute units (metered).</div>
              <div className="text-[10px] text-[var(--text-muted)]">Signing is handled by the cloud build service. See docs/cloud-services.md for the contract.</div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => { setShowExportModal(false); setExportWebReport(null); setCloudBuild(null); }} className={btnCancel}>Close</button>
          </div>
        </div></div>
      )}

      {newProjectModal}
    </div>
  );
}
