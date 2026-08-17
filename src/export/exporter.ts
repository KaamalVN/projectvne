import { ProjectIR } from '../shared/types';

export interface ExportOptions {
  target: 'windows' | 'macos' | 'linux' | 'web';
  outputDir: string;
  projectName: string;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export class ProjectExporter {
  /**
   * Export the project to a Windows executable using Tauri
   */
  static async exportToWindows(project: ProjectIR, options: ExportOptions): Promise<ExportResult> {
    try {
      // For Phase 1, we'll save the project JSON and invoke Tauri build
      // In a full implementation, this would:
      // 1. Prepare the project JSON for the runtime
      // 2. Copy the runtime bundle
      // 3. Invoke Tauri's build commands
      // 4. Package everything into a Windows executable

      // For now, we'll implement a basic version that saves the project
      // and provides instructions for the Tauri build
      const projectJson = JSON.stringify(project, null, 2);
      
      // Save the project to a file that the runtime can load
      const blob = new Blob([projectJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.projectName}-story.json`;
      a.click();
      URL.revokeObjectURL(url);

      // For Phase 1, we'll log that the full Tauri build needs to be run
      console.log('To complete Windows export, run: npm run tauri build');
      
      return {
        success: true,
        outputPath: `${options.projectName}-story.json`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Validate that the project is ready for export
   */
  static validateForExport(project: ProjectIR): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check entry scene
    if (!project.flow.entrySceneId || !project.scenes[project.flow.entrySceneId]) {
      issues.push('Project must have a valid entry scene');
    }

    // Check that scenes have content
    if (Object.keys(project.scenes).length === 0) {
      issues.push('Project must have at least one scene');
    }

    // Check for missing assets referenced in scenes
    for (const [, scene] of Object.entries(project.scenes)) {
      if (scene.background?.assetId && !project.assets[scene.background.assetId]) {
        issues.push(`Scene "${scene.title}" references missing background asset`);
      }

      for (const block of scene.blocks) {
        if (block.type === 'showCharacter' && !project.characters[block.characterId]) {
          issues.push(`Scene "${scene.title}" references missing character`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Prepare the runtime bundle with the project data
   */
  static prepareRuntimeBundle(project: ProjectIR): string {
    // Embed the project into a runtime-ready format
    const runtimeProject = {
      ...project,
      // Add any runtime-specific metadata
      runtime: {
        version: '1.0.0',
        exportedAt: new Date().toISOString()
      }
    };
    
    return JSON.stringify(runtimeProject, null, 2);
  }
}