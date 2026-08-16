import { IRCommand } from './command-types';
import { ProjectIR, ID, ShowCharacterBlock, CharacterPosition, TransitionType } from '../shared/types';

export interface AddShowCharacterBlockPayload {
  sceneId: ID;
  characterId: ID;
  expression: string;
  position: CharacterPosition;
  transition?: TransitionType;
  insertAtIndex?: number;
}

export class AddShowCharacterBlockCommand extends IRCommand<AddShowCharacterBlockPayload> {
  private blockId: ID;

  constructor(payload: AddShowCharacterBlockPayload) {
    super('addShowCharacterBlock', payload);
    this.blockId = `block-show-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) throw new Error(`Scene ${this.payload.sceneId} not found`);

    const newBlock: ShowCharacterBlock = {
      id: this.blockId,
      type: 'showCharacter',
      characterId: this.payload.characterId,
      expression: this.payload.expression,
      position: this.payload.position,
      transition: this.payload.transition
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
    if (!scene) return state;

    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.payload.sceneId]: {
          ...scene,
          blocks: scene.blocks.filter((b) => b.id !== this.blockId)
        }
      }
    };
  }

  validate(state: ProjectIR): { valid: boolean; error?: string } {
    if (!state.scenes[this.payload.sceneId]) {
      return { valid: false, error: `Scene ${this.payload.sceneId} not found` };
    }
    if (!state.characters[this.payload.characterId]) {
      return { valid: false, error: `Character ${this.payload.characterId} not found` };
    }
    return { valid: true };
  }
}
