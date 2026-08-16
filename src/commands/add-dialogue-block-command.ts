// Add Dialogue Block Command
import { IRCommand } from './command-types';
import { ProjectIR, ID, createID } from '../shared/types';

export interface AddDialogueBlockPayload {
  sceneId: ID;
  characterId: ID | null; // null for narrator
  text: string;
  expression?: string;
  insertAtIndex?: number; // optional, defaults to end
}

export class AddDialogueBlockCommand extends IRCommand<AddDialogueBlockPayload> {
  private blockId: ID;

  constructor(payload: AddDialogueBlockPayload) {
    super('addDialogueBlock', payload);
    this.blockId = createID(`dialogue-block-${Date.now()}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) {
      throw new Error(`Scene with ID ${this.payload.sceneId} not found`);
    }

    // Validate character if provided
    if (this.payload.characterId && !state.characters[this.payload.characterId]) {
      throw new Error(`Character with ID ${this.payload.characterId} not found`);
    }

    const newBlock = {
      id: this.blockId,
      type: 'dialogue' as const,
      characterId: this.payload.characterId,
      text: this.payload.text,
      expression: this.payload.expression
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

    // Validate character if provided
    if (this.payload.characterId && !state.characters[this.payload.characterId]) {
      return {
        valid: false,
        error: `Character with ID ${this.payload.characterId} not found`
      };
    }

    // Validate text is not empty
    if (!this.payload.text || this.payload.text.trim() === '') {
      return {
        valid: false,
        error: 'Dialogue text cannot be empty'
      };
    }

    return { valid: true };
  }
}