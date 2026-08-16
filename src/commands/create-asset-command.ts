import { IRCommand } from './command-types';
import { ProjectIR, Asset, ID, createID, AssetType } from '../shared/types';

export interface CreateAssetPayload {
  name: string;
  type: AssetType;
  fileReference: string;
  tags?: string[];
}

export class CreateAssetCommand extends IRCommand<CreateAssetPayload> {
  private assetId: ID;

  constructor(payload: CreateAssetPayload) {
    super('createAsset', payload);
    this.assetId = createID(`asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const newAsset: Asset = {
      id: this.assetId,
      name: this.payload.name,
      type: this.payload.type,
      tags: this.payload.tags || [],
      variants: {},
      fileReference: this.payload.fileReference
    };

    return {
      ...state,
      assets: {
        ...state.assets,
        [this.assetId]: newAsset
      }
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const { [this.assetId]: removed, ...rest } = state.assets;
    return {
      ...state,
      assets: rest
    };
  }

  validate(_state: ProjectIR): { valid: boolean; error?: string } {
    if (!this.payload.name || this.payload.name.trim() === '') {
      return { valid: false, error: 'Asset name cannot be empty' };
    }
    if (!this.payload.fileReference || this.payload.fileReference.trim() === '') {
      return { valid: false, error: 'Asset file path cannot be empty' };
    }
    return { valid: true };
  }
}
