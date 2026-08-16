import { IRCommand } from './command-types';
import { ProjectIR, Character, ID, createID, CharacterPosition } from '../shared/types';

export interface CreateCharacterPayload {
  name: string;
  defaultPosition?: CharacterPosition;
  portraits?: Record<string, { assetId: ID }>;
}

export class CreateCharacterCommand extends IRCommand<CreateCharacterPayload> {
  private characterId: ID;

  constructor(payload: CreateCharacterPayload) {
    super('createCharacter', payload);
    this.characterId = createID(`char-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const newChar: Character = {
      id: this.characterId,
      name: this.payload.name,
      defaultPosition: this.payload.defaultPosition || 'center',
      portraits: this.payload.portraits || {}
    };

    return {
      ...state,
      characters: {
        ...state.characters,
        [this.characterId]: newChar
      }
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const { [this.characterId]: removed, ...rest } = state.characters;
    return {
      ...state,
      characters: rest
    };
  }

  validate(_state: ProjectIR): { valid: boolean; error?: string } {
    if (!this.payload.name || this.payload.name.trim() === '') {
      return { valid: false, error: 'Character name cannot be empty' };
    }
    return { valid: true };
  }
}
