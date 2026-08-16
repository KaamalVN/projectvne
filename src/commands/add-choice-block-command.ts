// Add Choice Block Command
import { IRCommand } from './command-types';
import { ProjectIR, ID, createID } from '../shared/types';

export interface AddChoiceBlockPayload {
  sceneId: ID;
  prompt: string;
  options: { text: string; destinationSceneId: ID | null }[];
  insertAtIndex?: number; // optional, defaults to end
}

export class AddChoiceBlockCommand extends IRCommand<AddChoiceBlockPayload> {
  private blockId: ID;

  constructor(payload: AddChoiceBlockPayload) {
    super('addChoiceBlock', payload);
    this.blockId = createID(`choice-block-${Date.now()}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      throw new Error(`Scene with ID ${this.payload.sceneId} not found`);
    }

    // Validate all destination scenes exist
    for (const option of this.payload.options) {
      if (option.destinationSceneId && !state.scenes[option.destinationSceneId]) {
        throw new Error(`Destination scene with ID ${option.destinationSceneId} not found`);
      }
    }

    const newBlock = {
      id: this.blockId,
      type: 'choice' as const,
      prompt: this.payload.prompt,
      options: this.payload.options.map(option => ({
        id: createID(`choice-option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        text: option.text,
        destinationSceneId: option.destinationSceneId,
        conditionId: null // No condition by default
      }))
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
          blocks: newBlocks
        }
      }
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      throw new Error(`Scene with ID ${this.payload.sceneId} not found`);
    }

    const newBlocks = scene.blocks.filter(block => block.id !== this.blockId);
    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.payload.sceneId]: {
          ...scene,
          blocks: newBlocks
        }
      }
    };
  }

  validate(state: ProjectIR): { valid: boolean; error?: string } {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      return {
        valid: false,
        error: `Scene with ID ${this.payload.sceneId} not found`
      };
    }

    // Validate prompt is not empty
    if (!this.payload.prompt || this.payload.prompt.trim() === '') {
      return {
        valid: false,
        error: 'Choice prompt cannot be empty'
      };
    }

    // Validate options
    if (!this.payload.options || this.payload.options.length === 0) {
      return {
        valid: false,
        error: 'Choice must have at least one option'
      };
    }

    for (const option of this.payload.options) {
      if (!option.text || option.text.trim() === '') {
        return {
          valid: false,
          error: 'Choice option text cannot be empty'
        };
      }

      if (option.destinationSceneId && !state.scenes[option.destinationSceneId]) {
        return {
          valid: false,
          error: `Destination scene with ID ${option.destinationSceneId} not found`
        };
      }
    }

    return { valid: true };
  }
}