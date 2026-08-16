import { IRCommand } from './command-types';
import { ProjectIR, ID, Scene } from '../shared/types';

export interface DeleteScenePayload {
  sceneId: ID;
}

export class DeleteSceneCommand extends IRCommand<DeleteScenePayload> {
  private deletedScene: Scene | null = null;

  constructor(payload: DeleteScenePayload) {
    super('deleteScene', payload);
  }

  execute(state: ProjectIR): ProjectIR {
    const scene = state.scenes[this.payload.sceneId];
    if (!scene) return state;
    this.deletedScene = scene;

    const { [this.payload.sceneId]: removed, ...restScenes } = state.scenes;

    return {
      ...state,
      scenes: restScenes
    };
  }

  undo(state: ProjectIR): ProjectIR {
    if (!this.deletedScene) return state;

    return {
      ...state,
      scenes: {
        ...state.scenes,
        [this.payload.sceneId]: this.deletedScene
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
