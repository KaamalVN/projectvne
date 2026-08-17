import { useEffect, useRef, useState } from "react";
import { PixiVisualNovelEngine, EngineState } from "./runtime/engine";
import {
  ProjectIR,
  createEmptyProject,
  ID,
  CharacterPosition,
  VariableType
} from "./shared/types";
import {
  CommandInvoker,
  AddSceneCommand,
  AddDialogueBlockCommand,
  AddChoiceBlockCommand,
  AddShowCharacterBlockCommand,
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
  Moon
} from "lucide-react";

export default function App() {
  const [activeViewMode, setActiveViewMode] = useState<"graph" | "storyboard" | "script" | "project">("graph");
  const [project, setProject] = useState<ProjectIR>(createEmptyProject());
  const [invoker, setInvoker] = useState<CommandInvoker>(() => new CommandInvoker(createEmptyProject()));
  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "properties" | "variables" | "conditions" | "debugger">("inspector");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

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
    fetch("/stories/demo-story.json")
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data: ProjectIR) => {
        const migrated = MigrationRunner.migrate(data);
        setProject(migrated);
        setInvoker(new CommandInvoker(migrated));
        setSelectedSceneId(Object.keys(migrated.scenes)[0] || null);
        addLog("info", `Loaded: ${migrated.meta.title}`);
      })
      .catch(() => { /* Using empty project */ });
  }, []);

  useEffect(() => {
    setProblems(ProblemsChecker.check(project));
  }, [project]);

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
        onDialogue: (speaker, text) => addLog("info", `[Say] ${speaker}: "${text}"`),
        onSceneChange: (_, title) => addLog("info", `Scene: ${title}`),
        onStateChange: st => { if (!cancelled) setEngineState({ ...st }); },
        onChoice: (_, opts) => addLog("info", `Choice (${opts.length} options)`),
        onStoryEnd: () => addLog("info", "Scene ended.")
      });
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
  }, [selectedSceneId]);

  const executeCommand = (cmd: any) => {
    const res = invoker.execute(cmd);
    if (res.success && res.state) {
      setProject({ ...res.state });
    } else {
      addLog("error", `Command Error: ${res.error}`);
    }
  };

  const handleUndo = () => {
    const res = invoker.undo();
    if (res.success && res.state) setProject({ ...res.state });
  };

  const handleRedo = () => {
    const res = invoker.redo();
    if (res.success && res.state) setProject({ ...res.state });
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
    addLog("info", "Saved.");
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const migrated = MigrationRunner.migrate(JSON.parse(event.target?.result as string));
        setProject(migrated);
        setInvoker(new CommandInvoker(migrated));
        setSelectedSceneId(Object.keys(migrated.scenes)[0] || null);
        addLog("info", `Loaded: ${migrated.meta.title}`);
      } catch (err) {
        addLog("error", `Parse error: ${err}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportProject = async () => {
    const validation = ProjectExporter.validateForExport(project);
    if (!validation.valid) {
      addLog("error", `Export validation failed: ${validation.issues.join(', ')}`);
      return;
    }
    addLog("info", "Starting Windows export...");
    const result = await ProjectExporter.exportToWindows(project, {
      target: 'windows',
      outputDir: './exports',
      projectName: project.meta.title || 'story'
    });
    if (result.success) {
      addLog("info", `Export successful: ${result.outputPath}`);
      addLog("info", "Run 'npm run tauri build' to create the Windows executable");
    } else {
      addLog("error", `Export failed: ${result.error}`);
    }
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

  const currentScene = selectedSceneId ? project.scenes[selectedSceneId] : null;

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)]";
  const btnPrimary = "px-4 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] font-semibold text-xs text-[var(--text-primary)] rounded transition-colors";
  const btnCancel = "px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors";
  const modalWrap = "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50";
  const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl p-5 max-w-md w-full flex flex-col gap-3.5 shadow-xl";

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans overflow-hidden select-none">

      {/* ===== TOP NAV ===== */}
      <header className="h-10 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center font-bold text-[10px] text-[var(--text-muted)]">VN</div>
            <span className="text-xs font-semibold text-[var(--text-primary)]">ProjectVNE</span>
            <span className="text-[10px] text-[var(--text-ghost)] hidden sm:block">Visual Novel Studio</span>
          </div>
          <nav className="flex items-center gap-0 text-[11px] text-[var(--text-muted)]">
            {["File","Edit","View","Project","Tools","Help"].map(m => (
              <span key={m} className="px-2 py-1 hover:text-[var(--text-primary)] cursor-pointer rounded hover:bg-[var(--bg-hover)] transition-colors">{m}</span>
            ))}
          </nav>
        </div>

        <div className="flex items-center bg-[var(--bg-surface)] p-0.5 rounded-lg border border-[var(--border-subtle)] gap-0.5">
          {(["graph","storyboard","script","project"] as const).map((mode, i) => (
            <button key={mode} onClick={() => setActiveViewMode(mode)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                activeViewMode === mode
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}>
              {i===0 && <Split size={11}/>}{i===1 && <Layers size={11}/>}{i===2 && <FileCode size={11}/>}{i===3 && <FolderTree size={11}/>}
              {["Scene Graph","Timeline","Script","Project Flow"][i]}
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
            <button onClick={handleUndo} disabled={!invoker.canUndo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors"><Undo2 size={13}/></button>
            <button onClick={handleRedo} disabled={!invoker.canRedo()} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-20 rounded-md transition-colors"><Redo2 size={13}/></button>
            <button onClick={handleSaveProject} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"><Save size={13}/></button>
            <label className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer">
              <FolderOpen size={13}/>
              <input type="file" accept=".json" onChange={handleLoadProject} className="hidden"/>
            </label>
            <button onClick={handleExportProject} className="p-1.5 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors" title="Export for Windows"><Download size={13}/></button>
          </div>

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

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
                      <div key={id} onClick={() => setSelectedSceneId(id)}
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
                <button onClick={() => setShowNewAssetModal(true)} className="w-full px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-between mb-0.5 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] transition-all">
                  <span>🖼️ Show Background</span><Plus size={10} className="text-[var(--text-ghost)]"/>
                </button>
              </div>
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
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowAddDialogueModal(true)} className="px-2 py-0.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-md text-[11px] border border-[var(--border-subtle)] transition-colors">+ Dialogue</button>
              <button onClick={() => setShowAddChoiceModal(true)} className="px-2 py-0.5 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-md text-[11px] border border-[var(--border-subtle)] transition-colors">+ Choice</button>
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
                        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{block.type}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full p-6 overflow-y-auto font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-app)]">
                <pre className="text-[var(--text-ghost)]">// Scene: {currentScene?.title}</pre>
                {currentScene?.blocks.map((b, i) => (
                  <div key={i} className="pl-4 py-px">
                    {b.type === "dialogue" && <span><strong className="text-[var(--text-muted)]">say</strong> <span className="text-[var(--text-secondary)]">{b.characterId||"narrator"}</span>: "{b.text}"</span>}
                    {b.type === "choice" && <span className="text-[var(--text-muted)]">choice: "{b.prompt}"</span>}
                  </div>
                ))}
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
                <span className="flex items-center gap-1.5"><Terminal size={10}/> Console</span>
                <button onClick={() => setConsoleLogs([])} className="text-[var(--text-ghost)] hover:text-[var(--text-muted)] transition-colors">Clear</button>
              </div>
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
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside className="w-64 bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col shrink-0">
          <div className="flex border-b border-[var(--border-subtle)] text-[11px]">
            {(["inspector","variables","conditions","debugger","properties"] as const).map(tab => {
              const labels: Record<string,string> = { inspector:"Inspector", variables:"Variables", conditions:"Conditions", debugger:"Debugger", properties:`Issues (${problems.length})` };
              return (
                <button key={tab} onClick={() => setInspectorTab(tab)}
                  className={`flex-1 py-2 text-center transition-colors font-semibold ${
                    inspectorTab===tab ? "text-[var(--text-primary)] border-b-2 border-[var(--accent)] bg-[var(--bg-surface)]" : "text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
                  }`}>{labels[tab]}</button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
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
                                const isReachable = !opt.conditionId || project.conditions[opt.conditionId];
                                const targetScene = opt.destinationSceneId ? project.scenes[opt.destinationSceneId] : null;

                                return (
                                  <div key={optIdx} className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2">
                                      <span className={isReachable ? "text-[var(--green-text)]" : "text-[var(--text-ghost)]"}>
                                        {isReachable ? "✓" : "○"}
                                      </span>
                                      <span className="text-[var(--text-secondary)]">{opt.text}</span>
                                    </div>
                                    {targetScene && (
                                      <span className="text-[var(--text-muted)]">→ {targetScene.title}</span>
                                    )}
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

            {inspectorTab === "properties" && (
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
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={()=>setShowNewAssetModal(false)} className={btnCancel}>Cancel</button>
            <button onClick={()=>{ if(!assetName.trim()) return; executeCommand(new CreateAssetCommand({name:assetName,type:"background",fileReference:assetPath})); setShowNewAssetModal(false); }} className={btnPrimary}>Save</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
