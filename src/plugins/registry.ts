// Plugin host: loads plugin sources through the sandbox, enforces the declared
// capability model, indexes registrations, and dispatches engine blocks to the
// right plugin handler.
import type {
  PluginBlock,
  ProjectIR,
  StoryBlock,
} from '../shared/types';
import type {
  AssetImportInput,
  AssetImportResult,
  BuiltinPluginDefinition,
  PluginAssetImporterDefinition,
  PluginCapability,
  PluginEngineAdapter,
  PluginEngineContext,
  PluginInvokeResult,
  PluginIRScope,
  PluginInstance,
  PluginNodeTypeDefinition,
  PluginPanelDefinition,
  PluginRegistration,
} from './types';
import { PluginSandbox } from './sandbox';
import { isPluginEnabled } from './plugin-state';
import { BUILTIN_PLUGINS } from './builtin';
import { getInstalledPluginDefinitions } from '../marketplace/installed';

export class MissingCapabilityError extends Error {}

function dispatchTypeOf(block: StoryBlock): string {
  return block.type === 'plugin' ? (block as PluginBlock).pluginType : block.type;
}

function blockDataOf(block: StoryBlock): Record<string, unknown> {
  if (block.type === 'plugin') return (block as PluginBlock).data;
  const { id: _id, type: _type, ...rest } = block as unknown as Record<string, unknown>;
  return rest;
}

export class PluginHost {
  private plugins = new Map<string, PluginInstance>();
  private handlers = new Map<string, { pluginId: string; fn: (ctx: PluginEngineContext) => unknown }>();
  private declaredBlockTypes = new Map<string, string>();
  private nodeTypes = new Map<string, { pluginId: string; def: PluginNodeTypeDefinition }>();
  private panels = new Map<string, { pluginId: string; def: PluginPanelDefinition }>();
  private importers = new Map<string, { pluginId: string; def: PluginAssetImporterDefinition }>();

  constructor(definitions: BuiltinPluginDefinition[]) {
    for (const def of definitions) {
      const instance = this.loadPlugin(def);
      if (!instance) continue;
      this.plugins.set(instance.manifest.id, instance);
      if (instance.enabled && instance.registration) {
        this.index(instance);
      }
      // Declared block types come from every known plugin, enabled or not, so a
      // disabled plugin still yields a clear "missing capability" state instead
      // of a crash or a silent skip.
      for (const type of instance.manifest.handledBlockTypes || []) {
        this.declaredBlockTypes.set(type, instance.manifest.id);
      }
    }
  }

  private loadPlugin(def: BuiltinPluginDefinition): PluginInstance | null {
    let registration: PluginRegistration | undefined;
    try {
      PluginSandbox.run(def.source, {
        register: (reg) => {
          registration = reg;
        },
      });
    } catch (err) {
      return {
        manifest: { id: def.id, version: '0.0.0', name: def.id, description: 'Failed to load.', capabilities: [] },
        enabled: false,
        loadError: err instanceof Error ? err.message : String(err),
      };
    }
    if (!registration?.manifest) {
      return {
        manifest: { id: def.id, version: '0.0.0', name: def.id, description: 'Failed to load.', capabilities: [] },
        enabled: false,
        loadError: 'Plugin did not call api.register({ manifest, ... }).',
      };
    }
    return {
      manifest: registration.manifest,
      enabled: isPluginEnabled(registration.manifest.id),
      registration,
    };
  }

  private index(instance: PluginInstance): void {
    const reg = instance.registration!;
    for (const [type, fn] of Object.entries(reg.engineHandlers || {})) {
      this.handlers.set(type, { pluginId: instance.manifest.id, fn });
    }
    for (const [type, def] of Object.entries(reg.nodeTypes || {})) {
      this.nodeTypes.set(type, { pluginId: instance.manifest.id, def });
    }
    for (const [id, def] of Object.entries(reg.panels || {})) {
      this.panels.set(id, { pluginId: instance.manifest.id, def });
    }
    for (const [id, def] of Object.entries(reg.assetImporters || {})) {
      this.importers.set(id, { pluginId: instance.manifest.id, def });
    }
  }

  private declares(pluginId: string, kind: PluginCapability['kind'], scope?: PluginIRScope): boolean {
    const caps = this.plugins.get(pluginId)?.manifest.capabilities || [];
    return caps.some((cap) => {
      if (cap.kind !== kind) return false;
      if (kind === 'engine' || kind === 'network' || kind === 'filesystem') return true;
      if (kind === 'ir.read' || kind === 'ir.write') {
        const irCap = cap as { kind: 'ir.read' | 'ir.write'; scope: 'all' | PluginIRScope[] };
        if (scope === undefined) return true;
        if (irCap.scope === 'all') return true;
        return Array.isArray(irCap.scope) && irCap.scope.includes(scope);
      }
      return true;
    });
  }

  private require(pluginId: string, kind: PluginCapability['kind'], scope: PluginIRScope | undefined, blockType: string): void {
    if (!this.declares(pluginId, kind, scope)) {
      throw new MissingCapabilityError(
        `Block '${blockType}' needs the '${kind}${scope ? ':' + scope : ''}' capability, but plugin '${pluginId}' does not declare it.`,
      );
    }
  }

  private buildContext(pluginId: string, block: StoryBlock, adapter: PluginEngineAdapter): PluginEngineContext {
    const blockType = dispatchTypeOf(block);
    const data = blockDataOf(block);
    const ctx: PluginEngineContext = {
      blockType,
      data,
      getVariable: (id) => {
        this.require(pluginId, 'ir.read', 'variables', blockType);
        return adapter.getVariable(id);
      },
      setVariable: (id, value) => {
        this.require(pluginId, 'ir.write', 'variables', blockType);
        adapter.setVariable(id, value);
      },
      showDialogue: (speaker, text) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.showDialogue(speaker, text);
      },
      presentChoices: (prompt, options) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.presentChoices(prompt, options);
      },
      showCharacter: (id, expression, position) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.showCharacter(id, expression, position);
      },
      hideCharacter: (id) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.hideCharacter(id);
      },
      showFlashback: (payload) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.showFlashback(payload);
      },
      hideFlashback: () => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.hideFlashback();
      },
      getCharacterName: (id) => {
        this.require(pluginId, 'ir.read', 'characters', blockType);
        return adapter.getCharacterName(id);
      },
      jumpToScene: (id) => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.jumpToScene(id);
      },
      runScript: (code, label) => {
        this.require(pluginId, 'engine', undefined, blockType);
        this.require(pluginId, 'ir.read', 'variables', blockType);
        this.require(pluginId, 'ir.write', 'variables', blockType);
        return adapter.runScript(code, label);
      },
      log: (message) => adapter.log(String(message)),
      advance: () => {
        this.require(pluginId, 'engine', undefined, blockType);
        adapter.advance();
      },
    };
    return ctx;
  }

  invoke(block: StoryBlock, adapter: PluginEngineAdapter): PluginInvokeResult {
    const type = dispatchTypeOf(block);
    const entry = this.handlers.get(type);
    if (!entry) {
      const declaredBy = this.declaredBlockTypes.get(type);
      if (declaredBy) {
        return {
          handled: false,
          missingCapability: `This story block ('${type}') needs the '${declaredBy}' plugin, which is disabled. Enable it in the Plugins panel to keep playing.`,
        };
      }
      return { handled: false };
    }
    try {
      const ctx = this.buildContext(entry.pluginId, block, adapter);
      const result = entry.fn(ctx) as { waitForInput?: boolean; jumpToSceneId?: string } | undefined;
      return {
        handled: true,
        waitForInput: Boolean(result?.waitForInput),
        jumpToSceneId: result?.jumpToSceneId,
      };
    } catch (err) {
      if (err instanceof MissingCapabilityError) {
        return { handled: false, missingCapability: err.message };
      }
      return {
        handled: false,
        missingCapability: `Plugin '${entry.pluginId}' crashed while handling '${type}': ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // --- editor-facing lookups -------------------------------------------------

  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(id: string): PluginInstance | undefined {
    return this.plugins.get(id);
  }

  nodeTypeFor(blockType: string): { pluginId: string; def: PluginNodeTypeDefinition } | undefined {
    return this.nodeTypes.get(blockType);
  }

  getNodeTypes(): Array<{ pluginId: string; def: PluginNodeTypeDefinition }> {
    return Array.from(this.nodeTypes.values());
  }

  getPanels(): Array<{ pluginId: string; def: PluginPanelDefinition }> {
    return Array.from(this.panels.values());
  }

  getImporters(): Array<{ id: string; pluginId: string; def: PluginAssetImporterDefinition }> {
    const out: Array<{ id: string; pluginId: string; def: PluginAssetImporterDefinition }> = [];
    for (const [id, entry] of this.importers) {
      out.push({ id, pluginId: entry.pluginId, def: entry.def });
    }
    return out;
  }

  /** Block types whose plugin is declared but currently disabled. */
  getUnavailableBlockTypes(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [type, pluginId] of this.declaredBlockTypes) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && !plugin.enabled) out[type] = pluginId;
    }
    return out;
  }

  /** Blocks in the project that reference a declared but disabled plugin. */
  getMissingCapabilities(project: ProjectIR): Array<{ blockType: string; pluginId: string; sceneId: string; blockId: string }> {
    const missing: Array<{ blockType: string; pluginId: string; sceneId: string; blockId: string }> = [];
    for (const [sceneId, scene] of Object.entries(project.scenes)) {
      for (const block of scene.blocks) {
        const type = dispatchTypeOf(block);
        if (this.handlers.has(type)) continue;
        const pluginId = this.declaredBlockTypes.get(type);
        if (pluginId) missing.push({ blockType: type, pluginId, sceneId, blockId: block.id });
      }
    }
    return missing;
  }

  runImporter(pluginId: string, importerId: string, input: AssetImportInput): AssetImportResult {
    const entry = this.importers.get(importerId);
    if (!entry) return { error: `Asset importer '${importerId}' is not available.` };
    if (entry.pluginId !== pluginId) {
      return { error: `Asset importer '${importerId}' belongs to plugin '${entry.pluginId}', not '${pluginId}'.` };
    }
    try {
      return entry.def.import(input) ?? {};
    } catch (err) {
      return { error: `Importer '${importerId}' crashed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

export function createDefaultPluginHost(): PluginHost {
  const installed = getInstalledPluginDefinitions();
  return new PluginHost([...BUILTIN_PLUGINS, ...installed]);
}