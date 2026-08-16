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
  Eye
} from "lucide-react";

export default function App() {
  const [activeViewMode, setActiveViewMode] = useState<"graph" | "storyboard" | "script">("graph");
  const [project, setProject] = useState<ProjectIR>(createEmptyProject());
  const [invoker, setInvoker] = useState<CommandInvoker>(() => new CommandInvoker(createEmptyProject()));
  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "properties" | "variables">("inspector");

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
  const [assetName, setAssetName] = useState<string>("");
  const [assetPath, setAssetPath] = useState<string>("assets/backgrounds/room.png");

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

  // Defensive PixiJS engine init — never crashes the React tree
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
    if (varType === "number") parsed = Number(varDefault) || 0;
    if (varType === "boolean") parsed = varDefault === "true";
    executeCommand(new CreateVariableCommand({ name: varName, displayName: varName, type: varType, defaultValue: parsed }));
    setVarName(""); setShowNewVarModal(false);
  };

  const currentScene = selectedSceneId ? project.scenes[selectedSceneId] : null;

  // Shared input/select class
  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded px-3 py-1.5 text-xs text-[#ccc] focus:outline-none focus:border-[#333]";
  const btnPrimary = "px-4 py-1.5 bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#2a2a2a] font-semibold text-xs text-[#e0e0e0] rounded transition-colors";
  const btnCancel = "px-3 py-1 text-xs text-[#555] hover:text-[#aaa] transition-colors";
  const modalWrap = "fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50";
  const modalBox = "bg-[#111] border border-[#1e1e1e] rounded-lg p-5 max-w-md w-full flex flex-col gap-3.5 shadow-2xl";

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0c0c] text-[#d4d4d4] font-sans overflow-hidden select-none">

      {/* ===== TOP NAV ===== */}
      <header className="h-10 bg-[#111] border-b border-[#1a1a1a] flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center font-bold text-[10px] text-[#888]">VN</div>
            <span className="text-xs font-semibold text-[#e0e0e0]">ProjectVNE</span>
            <span className="text-[10px] text-[#3a3a3a] hidden sm:block">Visual Novel Studio</span>
          </div>
          <nav className="flex items-center gap-0 text-[11px] text-[#555]">
            {["File","Edit","View","Project","Tools","Help"].map(m => (
              <span key={m} className="px-2 py-1 hover:text-[#ccc] cursor-pointer rounded hover:bg-[#1a1a1a] transition-colors">{m}</span>
            ))}
          </nav>
        </div>

        <div className="flex items-center bg-[#0c0c0c] p-0.5 rounded border border-[#1a1a1a] gap-0.5">
          {(["graph","storyboard","script"] as const).map((mode, i) => (
            <button key={mode} onClick={() => setActiveViewMode(mode)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                activeViewMode === mode
                  ? "bg-[#1e1e1e] text-[#e0e0e0] border border-[#2a2a2a]"
                  : "text-[#555] hover:text-[#aaa]"
              }`}>
              {i===0 && <Split size={11}/>}{i===1 && <Layers size={11}/>}{i===2 && <FileCode size={11}/>}
              {["Story Graph","Timeline","Script"][i]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsPlayingLive(!isPlayingLive)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1a3a1a] hover:bg-[#1f491f] border border-[#2a5c2a] text-[#4ade80] rounded text-xs font-semibold transition-colors">
            <Play size={11} className="fill-current" /> Play
          </button>

          <div className="flex items-center bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-xs text-[#666] gap-1">
            <span className="text-[#333] text-[10px]">Scene:</span>
            <select value={selectedSceneId || ""} onChange={e => setSelectedSceneId(e.target.value)}
              className="bg-transparent text-xs text-[#aaa] font-mono focus:outline-none cursor-pointer max-w-[130px]">
              {Object.entries(project.scenes).map(([id, sc]) => (
                <option key={id} value={id} className="bg-[#111]">{sc.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center text-[#3a3a3a] gap-0.5">
            <button onClick={handleUndo} disabled={!invoker.canUndo()} className="p-1.5 hover:text-[#aaa] disabled:opacity-20 rounded hover:bg-[#1a1a1a] transition-colors"><Undo2 size={13}/></button>
            <button onClick={handleRedo} disabled={!invoker.canRedo()} className="p-1.5 hover:text-[#aaa] disabled:opacity-20 rounded hover:bg-[#1a1a1a] transition-colors"><Redo2 size={13}/></button>
            <button onClick={handleSaveProject} className="p-1.5 hover:text-[#aaa] rounded hover:bg-[#1a1a1a] transition-colors"><Save size={13}/></button>
            <label className="p-1.5 hover:text-[#aaa] rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer">
              <FolderOpen size={13}/>
              <input type="file" accept=".json" onChange={handleLoadProject} className="hidden"/>
            </label>
          </div>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex overflow-hidden">

        {/* ===== LEFT SIDEBAR ===== */}
        <aside className="w-56 bg-[#111] border-r border-[#1a1a1a] flex flex-col shrink-0 overflow-hidden">
          {/* PROJECT TREE */}
          <div className="flex-1 flex flex-col border-b border-[#1a1a1a] overflow-hidden min-h-0">
            <div className="px-3 py-2 border-b border-[#171717] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] flex items-center gap-1.5">
                <FolderTree size={11}/> Project
              </span>
              <button onClick={() => setShowNewSceneModal(true)} className="text-[#333] hover:text-[#aaa] transition-colors"><Plus size={13}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-[11px] font-mono">
              <div className="text-[#333] px-1 py-0.5 text-[10px]">📁 {project.meta.title || "project"}</div>

              {/* Scenes */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, stories: !p.stories }))}
                  className="flex items-center gap-1 text-[#555] hover:text-[#bbb] cursor-pointer py-0.5 px-1 rounded hover:bg-[#161616] transition-colors">
                  {treeExpanded.stories ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span className="text-[#666]">scenes</span>
                </div>
                {treeExpanded.stories && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.scenes).map(([id, sc]) => (
                      <div key={id} onClick={() => setSelectedSceneId(id)}
                        className={`flex items-center justify-between px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          selectedSceneId === id
                            ? "bg-[#1e1e1e] text-[#e0e0e0] border border-[#2a2a2a]"
                            : "text-[#555] hover:bg-[#161616] hover:text-[#bbb]"
                        }`}>
                        <span className="truncate">{sc.title}</span>
                        {project.flow.entrySceneId === id && <span className="text-[9px] text-[#22c55e] ml-1">●</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Characters */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, characters: !p.characters }))}
                  className="flex items-center gap-1 text-[#555] hover:text-[#bbb] cursor-pointer py-0.5 px-1 rounded hover:bg-[#161616] transition-colors">
                  {treeExpanded.characters ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span className="text-[#666]">characters</span>
                </div>
                {treeExpanded.characters && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.characters).map(([id, ch]) => (
                      <div key={id} className="text-[#444] px-2 py-0.5 truncate">{ch.name}</div>
                    ))}
                    <button onClick={() => setShowNewCharModal(true)} className="text-[#333] hover:text-[#888] px-2 py-0.5 block transition-colors text-[10px]">+ new character</button>
                  </div>
                )}
              </div>

              {/* Backgrounds */}
              <div className="pl-1">
                <div onClick={() => setTreeExpanded(p => ({ ...p, backgrounds: !p.backgrounds }))}
                  className="flex items-center gap-1 text-[#555] hover:text-[#bbb] cursor-pointer py-0.5 px-1 rounded hover:bg-[#161616] transition-colors">
                  {treeExpanded.backgrounds ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  <span className="text-[#666]">backgrounds</span>
                </div>
                {treeExpanded.backgrounds && (
                  <div className="pl-3 mt-0.5 space-y-px">
                    {Object.entries(project.assets).filter(([_, a]) => a.type === "background").map(([id, a]) => (
                      <div key={id} className="text-[#444] px-2 py-0.5 truncate">{a.name}</div>
                    ))}
                    <button onClick={() => setShowNewAssetModal(true)} className="text-[#333] hover:text-[#888] px-2 py-0.5 block transition-colors text-[10px]">+ import asset</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NODE LIBRARY */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#0f0f0f]">
            <div className="px-3 py-2 border-b border-[#171717]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] flex items-center gap-1.5"><LayoutGrid size={11}/> Node Library</span>
            </div>
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search size={10} className="absolute left-2.5 top-2 text-[#333]"/>
                <input type="text" placeholder="Search..." className="w-full bg-[#111] border border-[#1a1a1a] rounded pl-6 pr-2 py-1 text-[11px] text-[#666] focus:outline-none focus:border-[#222] placeholder:text-[#2a2a2a]"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 text-[11px]">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#333] px-1 mb-1">Flow</div>
                {[["🟢","Start","Entry"],["⬛","End","Exit"]].map(([icon,label,sub]) => (
                  <div key={label} className="px-2 py-1 rounded bg-[#111] border border-[#171717] text-[#666] flex items-center justify-between mb-0.5 hover:border-[#222] hover:text-[#bbb] cursor-pointer transition-all">
                    <span>{icon} {label}</span><span className="text-[9px] text-[#333]">{sub}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#333] px-1 mb-1">Story</div>
                <button onClick={() => setShowAddDialogueModal(true)} className="w-full px-2 py-1 rounded bg-[#111] border border-[#171717] text-[#666] flex items-center justify-between mb-0.5 hover:border-[#222] hover:text-[#bbb] transition-all">
                  <span>💬 Dialogue</span><Plus size={10} className="text-[#333]"/>
                </button>
                <button onClick={() => setShowAddChoiceModal(true)} className="w-full px-2 py-1 rounded bg-[#111] border border-[#171717] text-[#666] flex items-center justify-between mb-0.5 hover:border-[#222] hover:text-[#bbb] transition-all">
                  <span>🔀 Choice</span><Plus size={10} className="text-[#333]"/>
                </button>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#333] px-1 mb-1">Presentation</div>
                <button onClick={() => setShowAddCharacterBlockModal(true)} className="w-full px-2 py-1 rounded bg-[#111] border border-[#171717] text-[#666] flex items-center justify-between mb-0.5 hover:border-[#222] hover:text-[#bbb] transition-all">
                  <span>👤 Show Character</span><Plus size={10} className="text-[#333]"/>
                </button>
                <button onClick={() => setShowNewAssetModal(true)} className="w-full px-2 py-1 rounded bg-[#111] border border-[#171717] text-[#666] flex items-center justify-between mb-0.5 hover:border-[#222] hover:text-[#bbb] transition-all">
                  <span>🖼️ Show Background</span><Plus size={10} className="text-[#333]"/>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ===== CENTER CANVAS ===== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0c]">
          {/* Breadcrumb */}
          <div className="h-8 bg-[#111] border-b border-[#1a1a1a] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#333] font-mono text-[11px]">scenes /</span>
              <span className="text-[#ccc] font-semibold">{currentScene?.title || "No Scene"}</span>
              <span className="text-[9px] text-[#444] font-mono bg-[#171717] px-1.5 py-0.5 rounded border border-[#1e1e1e]">{currentScene?.blocks.length ?? 0} blocks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowAddDialogueModal(true)} className="px-2 py-0.5 bg-[#171717] hover:bg-[#1e1e1e] text-[#888] rounded text-[11px] border border-[#1e1e1e] transition-colors">+ Dialogue</button>
              <button onClick={() => setShowAddChoiceModal(true)} className="px-2 py-0.5 bg-[#171717] hover:bg-[#1e1e1e] text-[#888] rounded text-[11px] border border-[#1e1e1e] transition-colors">+ Choice</button>
            </div>
          </div>

          {/* Viewport */}
          <div className="flex-1 relative overflow-hidden">
            {activeViewMode === "graph" ? (
              <StoryGraphCanvas project={project} activeSceneId={selectedSceneId} onSelectNode={handleGraphNodeSelect}/>
            ) : activeViewMode === "storyboard" ? (
              <div className="w-full h-full overflow-y-auto p-6 space-y-2 max-w-2xl mx-auto">
                {currentScene?.blocks.map((block, idx) => (
                  <div key={block.id || idx} onClick={() => handleGraphNodeSelect(`block-${block.id||idx}`, block.type, block)}
                    className="p-3 bg-[#111] border border-[#1a1a1a] rounded hover:border-[#222] cursor-pointer transition-colors">
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span className="text-[#333] font-mono">#{idx+1}</span>
                      <span className="text-[#444] uppercase font-bold tracking-wider text-[10px]">{block.type}</span>
                    </div>
                    {block.type === "dialogue" && (
                      <div>
                        <div className="text-[11px] font-bold text-[#777] mb-0.5">
                          {block.characterId && project.characters[block.characterId] ? project.characters[block.characterId].name : "Narrator"}
                        </div>
                        <p className="text-xs text-[#bbb] italic bg-[#0c0c0c] p-2 rounded border border-[#171717]">"{block.text}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full p-6 overflow-y-auto font-mono text-[11px] text-[#555] bg-[#0c0c0c]">
                <pre className="text-[#333]">// Scene: {currentScene?.title}</pre>
                {currentScene?.blocks.map((b, i) => (
                  <div key={i} className="pl-4 py-px">
                    {b.type === "dialogue" && <span><strong className="text-[#555]">say</strong> <span className="text-[#666]">{b.characterId||"narrator"}</span>: "{b.text}"</span>}
                    {b.type === "choice" && <span className="text-[#555]">choice: "{b.prompt}"</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM DOCK */}
          <div className="h-48 bg-[#0f0f0f] border-t border-[#1a1a1a] flex shrink-0">
            {/* Scene Preview */}
            <div className="w-64 border-r border-[#1a1a1a] flex flex-col">
              <div className="px-3 py-1.5 border-b border-[#171717] flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#333]">
                <span className="flex items-center gap-1.5"><Eye size={10}/> Preview</span>
                <span className="text-[#222] font-mono">800×600</span>
              </div>
              <div className="flex-1 flex items-center justify-center p-1.5 overflow-hidden">
                <div ref={canvasContainerRef} className="w-full h-full max-h-[148px] aspect-[4/3] rounded overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a]"/>
              </div>
            </div>

            {/* Console */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-1.5 border-b border-[#171717] flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#333]">
                <span className="flex items-center gap-1.5"><Terminal size={10}/> Console</span>
                <button onClick={() => setConsoleLogs([])} className="text-[#2a2a2a] hover:text-[#666] transition-colors">Clear</button>
              </div>
              <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-0.5">
                {consoleLogs.length === 0 && <div className="text-[#282828] italic">No events yet.</div>}
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[#2a2a2a] text-[10px] shrink-0">{log.time}</span>
                    <span className={`text-[9px] uppercase font-bold shrink-0 ${log.level==="info"?"text-[#444]":log.level==="warn"?"text-[#854d0e]":"text-[#7f1d1d]"}`}>{log.level}</span>
                    <span className="text-[#555] truncate">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside className="w-64 bg-[#111] border-l border-[#1a1a1a] flex flex-col shrink-0">
          <div className="flex border-b border-[#1a1a1a] text-[11px]">
            {(["inspector","variables","properties"] as const).map(tab => {
              const labels: Record<string,string> = { inspector:"Inspector", variables:"Variables", properties:`Issues (${problems.length})` };
              return (
                <button key={tab} onClick={() => setInspectorTab(tab)}
                  className={`flex-1 py-2 text-center transition-colors font-semibold ${
                    inspectorTab===tab ? "text-[#e0e0e0] border-b border-[#444] bg-[#0f0f0f]" : "text-[#444] hover:text-[#999]"
                  }`}>{labels[tab]}</button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
            {inspectorTab === "inspector" && (
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#333] mb-1">
                    {selectedNodeType ? selectedNodeType.replace("Node","").toUpperCase() + " NODE" : "NODE INSPECTOR"}
                  </div>
                  <div className="text-[10px] text-[#2a2a2a] font-mono">{selectedNodeId || "— none selected —"}</div>
                </div>
                {selectedNodeData ? (
                  <div className="space-y-2 p-2.5 bg-[#0f0f0f] rounded border border-[#1a1a1a]">
                    {selectedNodeData.characterName && (
                      <div><label className="block text-[10px] text-[#444] mb-1">Speaker</label>
                        <div className="p-1.5 bg-[#0c0c0c] rounded border border-[#1a1a1a] text-[#ccc] font-semibold">{selectedNodeData.characterName as string}</div></div>
                    )}
                    {selectedNodeData.content && (
                      <div><label className="block text-[10px] text-[#444] mb-1">Dialogue</label>
                        <div className="p-1.5 bg-[#0c0c0c] rounded border border-[#1a1a1a] text-[#999] italic">"{selectedNodeData.content as string}"</div></div>
                    )}
                    {selectedNodeData.prompt && (
                      <div><label className="block text-[10px] text-[#444] mb-1">Choice Prompt</label>
                        <div className="p-1.5 bg-[#0c0c0c] rounded border border-[#1a1a1a] text-[#ccc] font-semibold">"{selectedNodeData.prompt as string}"</div></div>
                    )}
                    <div className="pt-2 border-t border-[#1a1a1a] space-y-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#2a2a2a]">Playback</div>
                      <div className="flex items-center justify-between"><span className="text-[#555]">Auto Continue</span><input type="checkbox" defaultChecked className="accent-[#3b82f6]"/></div>
                      <div className="flex items-center justify-between"><span className="text-[#555]">Fade (ms)</span><span className="font-mono text-[#333]">600</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-[#2a2a2a] italic text-[11px]">Click a node to inspect it.</div>
                )}
              </div>
            )}

            {inspectorTab === "variables" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#333]">Story Variables</span>
                  <button onClick={() => setShowNewVarModal(true)} className="p-1 bg-[#171717] hover:bg-[#1e1e1e] text-[#555] rounded border border-[#1e1e1e] transition-colors"><Plus size={10}/></button>
                </div>
                {Object.entries(project.variables).map(([id, v]) => (
                  <div key={id} className="p-2 bg-[#0f0f0f] rounded border border-[#1a1a1a]">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-[#ccc] text-[11px]">{v.displayName || v.name}</span>
                      <span className="text-[9px] font-mono text-[#333]">{v.type}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#333]">Value:</span>
                      <span className="font-mono text-[#22c55e]">{String(engineState?.variables?.[id] ?? v.defaultValue)}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(project.variables).length === 0 && <div className="text-[#2a2a2a] italic text-center py-6">No variables defined.</div>}
              </div>
            )}

            {inspectorTab === "properties" && (
              <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#333] block">Integrity</span>
                {problems.length === 0 ? (
                  <div className="p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded text-[#22c55e] text-[11px] text-center">✓ All nodes valid</div>
                ) : problems.map(p => (
                  <div key={p.id} className="p-2 bg-[#150c0c] border border-[#2a1515] rounded text-[11px] text-[#f87171]">
                    <div className="font-semibold">{p.message}</div>
                    {p.fixSuggestion && <div className="text-[10px] text-[#444] mt-1">💡 {p.fixSuggestion}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===== STATUS BAR ===== */}
      <footer className="h-5 bg-[#111] border-t border-[#1a1a1a] px-3 flex items-center justify-between text-[10px] text-[#333] shrink-0 font-mono">
        <div className="flex items-center gap-4">
          <span>{project.meta.title || "Untitled"}</span>
          <span className="flex items-center gap-1 text-[#22c55e]"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse inline-block"/>Ready</span>
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
          <h3 className="text-sm font-bold text-[#e0e0e0]">Create Scene</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Title</label>
            <input className={inputCls} value={newSceneTitle} onChange={e=>setNewSceneTitle(e.target.value)} placeholder="chapter_one" autoFocus onKeyDown={e=>e.key==="Enter"&&submitAddScene()}/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewSceneModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddScene} className={btnPrimary}>Create</button></div>
        </div></div>
      )}

      {showAddDialogueModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[#e0e0e0]">Add Dialogue</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Speaker</label>
            <select className={inputCls} value={dlgSpeakerId} onChange={e=>setDlgSpeakerId(e.target.value)}>
              <option value="">Narrator</option>
              {Object.entries(project.characters).map(([id,c])=>(<option key={id} value={id}>{c.name}</option>))}
            </select>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">Dialogue Text</label>
            <textarea className={inputCls + " resize-none"} rows={3} value={dlgText} onChange={e=>setDlgText(e.target.value)} placeholder="Hey, you made it!"/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddDialogueModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddDialogue} className={btnPrimary}>Add Node</button></div>
        </div></div>
      )}

      {showAddChoiceModal && (
        <div className={modalWrap}><div className={modalBox + " max-w-lg"}>
          <h3 className="text-sm font-bold text-[#e0e0e0]">Add Choice Branch</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Prompt</label>
            <input className={inputCls} value={choicePrompt} onChange={e=>setChoicePrompt(e.target.value)} placeholder="How do you respond?"/>
          </div>
          {[[choiceOpt1Text, setChoiceOpt1Text, choiceOpt1Dest, setChoiceOpt1Dest, "Option 1"],
            [choiceOpt2Text, setChoiceOpt2Text, choiceOpt2Dest, setChoiceOpt2Dest, "Option 2 (optional)"]].map(([text, setText, dest, setDest, label], i) => (
            <div key={i} className="p-2.5 bg-[#0a0a0a] rounded border border-[#1a1a1a] space-y-1.5">
              <label className="text-[10px] text-[#444]">{label as string}</label>
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
          <h3 className="text-sm font-bold text-[#e0e0e0]">Show Character</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Character</label>
            <select className={inputCls} value={charBlockId} onChange={e=>setCharBlockId(e.target.value)}>
              <option value="">Select...</option>
              {Object.entries(project.characters).map(([id,c])=>(<option key={id} value={id}>{c.name}</option>))}
            </select>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">Expression</label>
            <input className={inputCls} value={charBlockExpr} onChange={e=>setCharBlockExpr(e.target.value)} placeholder="happy"/>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">Position</label>
            <select className={inputCls} value={charBlockPos} onChange={e=>setCharBlockPos(e.target.value as CharacterPosition)}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowAddCharacterBlockModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddShowCharacter} className={btnPrimary}>Add Node</button></div>
        </div></div>
      )}

      {showNewCharModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[#e0e0e0]">Create Character</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Name</label>
            <input className={inputCls} value={charName} onChange={e=>setCharName(e.target.value)} placeholder="Luna" autoFocus/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewCharModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddCharacter} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

      {showNewVarModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[#e0e0e0]">Add Variable</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Name</label>
            <input className={inputCls + " font-mono"} value={varName} onChange={e=>setVarName(e.target.value)} placeholder="player_trust" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">Type</label>
            <select className={inputCls} value={varType} onChange={e=>setVarType(e.target.value as VariableType)}>
              <option value="number">Number</option><option value="boolean">Boolean</option><option value="text">Text</option>
            </select>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">Default</label>
            <input className={inputCls + " font-mono"} value={varDefault} onChange={e=>setVarDefault(e.target.value)} placeholder="0"/>
          </div>
          <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setShowNewVarModal(false)} className={btnCancel}>Cancel</button><button onClick={submitAddVariable} className={btnPrimary}>Save</button></div>
        </div></div>
      )}

      {showNewAssetModal && (
        <div className={modalWrap}><div className={modalBox}>
          <h3 className="text-sm font-bold text-[#e0e0e0]">Import Asset</h3>
          <div><label className="block text-[10px] text-[#555] mb-1">Name</label>
            <input className={inputCls} value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="bg_room.jpg" autoFocus/>
          </div>
          <div><label className="block text-[10px] text-[#555] mb-1">File Path</label>
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
