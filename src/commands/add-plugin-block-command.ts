// Add Plugin Block Command (v3): inserts a plugin-provided block into a scene.
import { IRCommand } from './command-types';
import { ProjectIR, ID, createID } from '../shared/types';

export interface AddPluginBlockPayload {
  sceneId: ID;
  pluginType: string;
  data: Record<string, unknown>;
  label?: string;
  pluginId?: string;
  insertAtIndex?: number; // optional, defaults to end
}

export class AddPluginBlockCommand extends IRCommand<AddPluginBlockPayload> {
  private blockId: ID;

  constructor(payload: AddPluginBlockPayload) {
    super('addPluginBlock', payload);
    this.blockId = createID(`plugin-block-${Date.now()}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      throw new Error(`Scene with ID ${this.payload.sceneId} not found`);
    }

    const newBlock = {
      id: this.blockId,
      type: 'plugin' as const,
      pluginType: this.payload.pluginType,
      label: this.payload.label,
      pluginId: this.payload.pluginId,
      data: { ...this.payload.data },
    };

    const insertIndex = this.payload.insertAtIndex ?? scene.blocks.length;
    const newBlocks = [...scene.blocks];
    newBlocks.splice(insertIndex, 0, newBlock);

    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.payload.sceneId]: {
          ...scene,
          blocks: newBlocks,
        },
      },
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      throw new Error(`Scene with ID ${this.payload.sceneId} not found`);
    }

    const newBlocks = scene.blocks.filter((block) => block.id !== this.blockId);
    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.payload.sceneId]: {
          ...scene,
          blocks: newBlocks,
        },
      },
    };
  }

  validate(state: ProjectIR): { valid: boolean; error?: string } {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      return {
        valid: false,
        error: `Scene with ID ${this.payload.sceneId} not found`,
      };
    }

    if (!this.payload.pluginType || this.payload.pluginType.trim() === '') {
      return {
        valid: false,
        error: 'Plugin block type cannot be empty',
      };
    }

    return { valid: true };
  }
}