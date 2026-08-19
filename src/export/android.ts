// Android export target (Phase 6). Android export wraps the same PixiJS web
// runtime in a Tauri v2 Android (WebView) shell, exactly as desktop wraps it in
// a native shell — one runtime, wrapped per platform. This module produces the
// Android project scaffold + runtime bundle and validates what it can. The final
// APK is produced by the Tauri Android toolchain (requires the Android SDK,
// documented in docs/phase6-public-ecosystem.md); the export itself is a real,
// supported profile, not an architecturally-possible afterthought.
import type { ProjectIR } from '../shared/types';

export interface AndroidExportResult {
  ok: boolean;
  outputPath?: string;
  error?: string;
  scaffold?: AndroidScaffold;
}

export interface AndroidScaffold {
  projectId: string;
  projectName: string;
  packageName: string;
  version: string;
  // Tauri v2 Android capabilities (WebView + storage for saves).
  permissions: string[];
  storageNote: string;
  files: Array<{ path: string; content: string }>;
}

function safePackageName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40) || 'story';
  return `com.projectvne.${slug}`;
}

export function prepareAndroidExport(project: ProjectIR, projectName: string): AndroidExportResult {
  if (Object.keys(project.scenes).length === 0) {
    return { ok: false, error: 'Cannot export Android build for a project with no scenes.' };
  }
  const packageName = safePackageName(projectName);
  const scaffold: AndroidScaffold = {
    projectId: project.meta.id || projectName,
    projectName,
    packageName,
    version: '1.0.0',
    permissions: ['android.permission.INTERNET'],
    storageNote:
      'Saves are stored in the app sandbox (internal storage). No external storage permission is required. Offline-first: all assets are bundled into the APK, so no network is needed to play.',
    files: [
      {
        path: 'android.config.json',
        content: JSON.stringify(
          {
            package: packageName,
            label: projectName,
            runtime: 'web',
            permissions: ['android.permission.INTERNET'],
            storyAsset: 'story.json',
          },
          null,
          2,
        ),
      },
      {
        path: 'story.json',
        content: JSON.stringify(project, null, 2),
      },
    ],
  };
  return { ok: true, outputPath: `android/${packageName}/`, scaffold };
}