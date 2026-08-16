// Command types and interfaces for the IR mutation system
import { ProjectIR, createID } from '../shared/types';

// Base command interface
export interface Command<TPayload = any> {
  id: string;
  type: string;
  timestamp: number;
  payload: TPayload;

  // Execute the command (apply changes)
  execute(state: ProjectIR): ProjectIR;

  // Undo the command (revert changes)
  undo(state: ProjectIR): ProjectIR;

  // Validate the command before execution
  validate(state: ProjectIR): { valid: boolean; error?: string };
}

// Command result type
export interface CommandResult {
  success: boolean;
  state?: ProjectIR;
  error?: string;
}

// Command invoker/handler
export class CommandInvoker {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private currentState: ProjectIR;

  constructor(initialState: ProjectIR) {
    this.currentState = initialState;
  }

  // Get current state
  getState(): ProjectIR {
    return this.currentState;
  }

  // Execute a command
  execute(command: Command): CommandResult {
    // Validate first
    const validation = command.validate(this.getState());
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Command validation failed'
      };
    }

    try {
      // Execute command
      const newState = command.execute(this.getState());

      // Add to undo stack, clear redo stack
      this.undoStack.push(command);
      this.redoStack = [];
      this.currentState = newState; // Update current state

      return {
        success: true,
        state: newState
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Undo last command
  undo(): CommandResult {
    if (this.undoStack.length === 0) {
      return {
        success: false,
        error: 'Nothing to undo'
      };
    }

    const command = this.undoStack.pop()!;
    try {
      // Undo command
      const newState = command.undo(this.getState());

      // Add to redo stack
      this.redoStack.push(command);
      this.currentState = newState; // Update current state

      return {
        success: true,
        state: newState
      };
    } catch (error) {
      // Put command back on undo stack if undo fails
      this.undoStack.push(command);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Undo failed'
      };
    }
  }

  // Redo last undone command
  redo(): CommandResult {
    if (this.redoStack.length === 0) {
      return {
        success: false,
        error: 'Nothing to redo'
      };
    }

    const command = this.redoStack.pop()!;
    try {
      // Execute command again
      const newState = command.execute(this.getState());

      // Add back to undo stack
      this.undoStack.push(command);
      this.currentState = newState; // Update current state

      return {
        success: true,
        state: newState
      };
    } catch (error) {
      // Put command back on redo stack if redo fails
      this.redoStack.push(command);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Redo failed'
      };
    }
  }

  // Check if we can undo/redo
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Get history sizes
  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }
}

// Base class for commands that modify the IR
export abstract class IRCommand<TPayload = any> implements Command<TPayload> {
  public id: string;
  public type: string;
  public timestamp: number;
  public payload: TPayload;

  constructor(type: string, payload: TPayload) {
    this.id = createID(`cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.type = type;
    this.timestamp = Date.now();
    this.payload = payload;
  }

  // Abstract methods to be implemented by concrete commands
  abstract execute(state: ProjectIR): ProjectIR;
  abstract undo(state: ProjectIR): ProjectIR;
  abstract validate(state: ProjectIR): { valid: boolean; error?: string };
}