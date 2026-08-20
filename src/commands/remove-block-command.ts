import { IRCommand } from "./command-types";
import { ProjectIR, ID, StoryBlock } from "../shared/types";

export interface RemoveBlockPayload {
  sceneId: ID;
  blockIdOrIndex: string;
}

export class RemoveBlockCommand extends IRCommand<RemoveBlockPayload> {
  private previousBlock: StoryBlock | null = null;
  private previousIndex: number = -1;

  constructor(payload: RemoveBlockPayload) {
    super("removeBlock", payload);
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) return state;

    let index = scene.blocks.findIndex(
      (b: StoryBlock, idx: number) =>
        b.id === this.payload.blockIdOrIndex ||
        `block-${idx}` === this.payload.blockIdOrIndex ||
        `block-${b.id}` === this.payload.blockIdOrIndex ||
        String(idx) === this.payload.blockIdOrIndex
    );

    if (index === -1) {
      const num = Number(this.payload.blockIdOrIndex);
      if (!isNaN(num) && num >= 0 && num < scene.blocks.length) {
        index = num;
      }
    }

    if (index === -1) return state;

    this.previousIndex = index;
    this.previousBlock = { ...scene.blocks[index] };

    const newBlocks = [...scene.blocks];
    newBlocks.splice(index, 1);

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
    if (!scene || !this.previousBlock || this.previousIndex === -1) return state;

    const newBlocks = [...scene.blocks];
    newBlocks.splice(this.previousIndex, 0, this.previousBlock);

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
    if (!state.scenes[this.payload.sceneId]) {
      return { valid: false, error: `Scene ${this.payload.sceneId} not found` };
    }
    return { valid: true };
  }
}
