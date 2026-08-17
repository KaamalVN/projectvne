import { IRCommand } from './command-types';
import { ProjectIR, Variable, ID, createID, VariableType, VariableValue } from '../shared/types';

export interface CreateVariablePayload {
  name: string;
  type: VariableType;
  defaultValue: VariableValue;
  displayName: string;
  description?: string;
  minValue?: number;
  maxValue?: number;
  allowedTags?: string[];
  inventoryItems?: Record<string, number>;
}

export class CreateVariableCommand extends IRCommand<CreateVariablePayload> {
  private variableId: ID;

  constructor(payload: CreateVariablePayload) {
    super('createVariable', payload);
    this.variableId = createID(`var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  }

  execute(state: ProjectIR): ProjectIR {
    const newVar: Variable = {
      id: this.variableId,
      name: this.payload.name,
      type: this.payload.type,
      defaultValue: this.payload.defaultValue,
      displayName: this.payload.displayName,
      description: this.payload.description,
      minValue: this.payload.minValue,
      maxValue: this.payload.maxValue,
      allowedTags: this.payload.allowedTags,
      inventoryItems: this.payload.inventoryItems
    };

    return {
      ...state,
      variables: {
        ...state.variables,
        [this.variableId]: newVar
      }
    };
  }

  undo(state: ProjectIR): ProjectIR {
    const { [this.variableId]: removed, ...rest } = state.variables;
    return {
      ...state,
      variables: rest
    };
  }

  validate(_state: ProjectIR): { valid: boolean; error?: string } {
    if (!this.payload.name || this.payload.name.trim() === '') {
      return { valid: false, error: 'Variable identifier name cannot be empty' };
    }
    return { valid: true };
  }
}
