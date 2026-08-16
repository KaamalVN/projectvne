// Add Scene Command
import { IRCommand } from './command-types';
import { ProjectIR, Scene, ID, createID } from '../shared/types';

export interface AddScenePayload {
  title: string;
  backgroundAssetId: ID | null;
}

export class AddSceneCommand extends IRCommand<AddScenePayload> {
  private sceneId: ID;

  constructor(payload: AddScenePayload) {
    super('addScene', payload);
    this.sceneId = createID(`scene-${Date.now()}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const newScene: Scene = {
      id: this.sceneId,
      title: this.payload.title,
      background: this.payload.backgroundAssetId ? { assetId: this.payload.backgroundAssetId } : null,
      blocks: []
    };

    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.sceneId]: newScene
      }
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const { [this.sceneId]: removed, ...remainingScenes } = state.scenes;
    return {
      ...state,
      scenes: remainingScenes
    };
  }

  validate(state: ProjectIR): { valid: boolean; error?: string } {
    // Validate that background asset exists if provided
    if (this.payload.backgroundAssetId && !state.assets[this.payload.backgroundAssetId]) {
      return {
        valid: false,
        error: `Background asset with ID ${this.payload.backgroundAssetId} not found`
      };
    }

    return { valid: true };
  }
}