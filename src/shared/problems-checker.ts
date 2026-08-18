import type { ProjectIR } from '../shared/types/index.ts';
import { findNeverSatisfiedConditions } from './story-logic.ts';

export interface StoryProblem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sceneId?: string;
  blockId?: string;
  fixSuggestion?: string;
}

export class ProblemsChecker {
  public static check(project: ProjectIR): StoryProblem[] {
    const problems: StoryProblem[] = [];

    // 1. Check entry scene
    if (!project.flow.entrySceneId || !project.scenes[project.flow.entrySceneId]) {
      const sceneIds = Object.keys(project.scenes);
      if (sceneIds.length === 0) {
        problems.push({
          id: 'no-scenes',
          severity: 'warning',
          message: 'Project has no scenes. Create a scene to start your story.',
          fixSuggestion: 'Add a new scene using the Storyboard.'
        });
      } else {
        problems.push({
          id: 'invalid-entry-scene',
          severity: 'error',
          message: `Entry scene '${project.flow.entrySceneId}' does not exist.`,
          fixSuggestion: `Set entry scene to '${project.scenes[sceneIds[0]]?.title || sceneIds[0]}'.`
        });
      }
    }

    // 2. Check scenes and their blocks
    for (const [sceneId, scene] of Object.entries(project.scenes)) {
      // Check background asset
      if (scene.background && scene.background.assetId) {
        if (!project.assets[scene.background.assetId]) {
          problems.push({
            id: `missing-bg-${sceneId}`,
            severity: 'error',
            sceneId,
            message: `Scene "${scene.title}" references missing background asset '${scene.background.assetId}'.`,
            fixSuggestion: 'Select a valid background asset or remove background.'
          });
        }
      }

      // Check blocks
      scene.blocks.forEach((block, idx) => {
        if (block.type === 'dialogue') {
          if (block.characterId && !project.characters[block.characterId]) {
            problems.push({
              id: `missing-char-${sceneId}-${block.id}`,
              severity: 'error',
              sceneId,
              blockId: block.id,
              message: `Dialogue #${idx + 1} in "${scene.title}" references missing character ID '${block.characterId}'.`,
              fixSuggestion: 'Assign a valid character or set speaker to Narrator.'
            });
          }
          if (!block.text || block.text.trim() === '') {
            problems.push({
              id: `empty-dialogue-${sceneId}-${block.id}`,
              severity: 'warning',
              sceneId,
              blockId: block.id,
              message: `Dialogue #${idx + 1} in "${scene.title}" is empty.`,
              fixSuggestion: 'Enter dialogue line text.'
            });
          }
        } else if (block.type === 'showCharacter') {
          if (!project.characters[block.characterId]) {
            problems.push({
              id: `missing-show-char-${sceneId}-${block.id}`,
              severity: 'error',
              sceneId,
              blockId: block.id,
              message: `Show Character card in "${scene.title}" references missing character '${block.characterId}'.`,
              fixSuggestion: 'Choose an existing character from your cast.'
            });
          } else {
            const char = project.characters[block.characterId];
            const portrait = char.portraits?.[block.expression];
            if (!portrait || !project.assets[portrait.assetId]) {
              problems.push({
                id: `missing-portrait-${sceneId}-${block.id}`,
                severity: 'warning',
                sceneId,
                blockId: block.id,
                message: `Character "${char.name}" has no portrait asset for expression '${block.expression}'.`,
                fixSuggestion: `Add expression '${block.expression}' to "${char.name}" in Character Manager.`
              });
            }
          }
        } else if (block.type === 'choice') {
          if (!block.options || block.options.length === 0) {
            problems.push({
              id: `empty-choice-${sceneId}-${block.id}`,
              severity: 'error',
              sceneId,
              blockId: block.id,
              message: `Choice block in "${scene.title}" has no selectable options.`,
              fixSuggestion: 'Add at least one option to the choice.'
            });
          } else {
            block.options.forEach((opt, optIdx) => {
              if (opt.destinationSceneId && !project.scenes[opt.destinationSceneId]) {
                problems.push({
                  id: `dangling-choice-${sceneId}-${opt.id}`,
                  severity: 'error',
                  sceneId,
                  blockId: block.id,
                  message: `Choice option #${optIdx + 1} ("${opt.text}") leads to non-existent scene '${opt.destinationSceneId}'.`,
                  fixSuggestion: 'Connect choice to an existing scene or leave destination as current scene continuation.'
                });
              }
              if (opt.conditionId && !project.conditions[opt.conditionId]) {
                problems.push({
                  id: `missing-condition-${sceneId}-${opt.id}`,
                  severity: 'warning',
                  sceneId,
                  blockId: block.id,
                  message: `Choice option "${opt.text}" references missing condition '${opt.conditionId}'.`,
                  fixSuggestion: 'Create condition or remove requirement from choice.'
                });
              }
            });
          }
        } else if (block.type === 'setVariable') {
          if (!project.variables[block.variableId]) {
            problems.push({
              id: `missing-var-${sceneId}-${block.id}`,
              severity: 'warning',
              sceneId,
              blockId: block.id,
              message: `Variable action in "${scene.title}" references missing variable '${block.variableId}'.`,
              fixSuggestion: `Create variable '${block.variableId}' in Variables panel.`
            });
          } else {
            // Validate that the operation matches the variable type
            const variable = project.variables[block.variableId];
            if (variable.type === 'tagCollection' && block.operation !== 'set') {
              problems.push({
                id: `invalid-tag-operation-${sceneId}-${block.id}`,
                severity: 'warning',
                sceneId,
                blockId: block.id,
                message: `Tag collection variables only support 'set' operations.`,
                fixSuggestion: `Change operation to 'set' or use a different variable type.`
              });
            }
          }
        }
      });
    }

    for (const issue of findNeverSatisfiedConditions(project)) {
      problems.push({
        id: `never-true-${issue.conditionId}`,
        severity: 'warning',
        message: issue.reason,
        fixSuggestion: 'Either set the underlying story fact somewhere in the project or loosen the rule.',
      });
    }

    return problems;
  }
}
