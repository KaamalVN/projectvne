import type { ProjectIR } from '../shared/types/index.ts';
import { ProblemsChecker } from '../shared/problems-checker.ts';

export interface ExportOptions {
  target: 'windows' | 'macos' | 'linux' | 'web';
  outputDir: string;
  projectName: string;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  manifest?: string;
}

interface DesktopExportBundle {
  schemaVersion: number;
  projectName: string;
  exportedAt: string;
  targets: Array<{ target: 'windows' | 'macos' | 'linux'; bundleName: string }>;
  story: ProjectIR;
}

export class ProjectExporter {
  static async exportToWindows(project: ProjectIR, options: ExportOptions): Promise<ExportResult> {
    return this.exportDesktopBundle(project, options);
  }

  static async exportDesktopBundle(project: ProjectIR, options: ExportOptions): Promise<ExportResult> {
    try {
      const manifest = this.prepareDesktopBundle(project, options.projectName);
      const blob = new Blob([manifest], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.projectName}-desktop-export.json`;
      link.click();
      URL.revokeObjectURL(url);

      return {
        success: true,
        outputPath: `${options.projectName}-desktop-export.json`,
        manifest,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  static validateForExport(project: ProjectIR): { valid: boolean; issues: string[] } {
    const issues = ProblemsChecker.check(project)
      .filter((problem) => problem.severity === 'error')
      .map((problem) => problem.message);

    if (Object.keys(project.scenes).length === 0) {
      issues.push('Project must have at least one scene');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  static prepareRuntimeBundle(project: ProjectIR): string {
    return JSON.stringify({
      ...project,
      runtime: {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
      },
    }, null, 2);
  }

  static prepareDesktopBundle(project: ProjectIR, projectName: string): string {
    const bundle: DesktopExportBundle = {
      schemaVersion: project.meta.schemaVersion,
      projectName,
      exportedAt: new Date().toISOString(),
      targets: [
        { target: 'windows', bundleName: `${projectName}-windows` },
        { target: 'macos', bundleName: `${projectName}-macos` },
        { target: 'linux', bundleName: `${projectName}-linux` },
      ],
      story: project,
    };

    return JSON.stringify(bundle, null, 2);
  }
}
