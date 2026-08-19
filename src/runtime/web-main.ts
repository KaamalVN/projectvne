// Web-export runtime entry. Plays a web-exported story bundle with persistent
// saves (localStorage). This is the runtime used by the Phase 6 Web export
// target — same PixiJS engine the editor preview uses, so preview and export
// stay identical.
import { PixiVisualNovelEngine } from './engine';
import { createDefaultPluginHost } from '../plugins';

const params = new URLSearchParams(location.search);
const projectId = params.get('project') || 'demo-story';

async function main() {
  const container = document.getElementById('game-container') as HTMLElement;
  const notice = document.getElementById('notice') as HTMLElement;
  const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
  const loadBtn = document.getElementById('btn-load') as HTMLButtonElement;

  const base = `web-export/${projectId}`;
  const saveKey = `projectvne.save.${projectId}`;

  try {
    const res = await fetch(`${base}/story.json`);
    if (!res.ok) throw new Error(`Failed to load story: ${res.status}`);
    const story = await res.json();

    // Surface any documented web-export limitations to the player.
    try {
      const cRes = await fetch(`${base}/constraints.json`);
      if (cRes.ok) {
        const report = await cRes.json();
        const warns = (report.constraints || []).filter((c: any) => c.status === 'warn' || c.status === 'block');
        if (warns.length) {
          notice.textContent = 'Note: ' + warns.map((c: any) => c.label).join('; ');
        }
      }
    } catch {
      // constraints file optional
    }

    const engine = new PixiVisualNovelEngine(
      container,
      {
        onSceneChange: (_, title) => console.log(`[web-export] Scene: ${title}`),
        onStoryEnd: () => console.log('[web-export] Story reached the end.'),
      },
      createDefaultPluginHost(),
    );
    await engine.loadStory(story);

    saveBtn.addEventListener('click', () => {
      try {
        localStorage.setItem(saveKey, JSON.stringify(engine.getSaveData()));
        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
      } catch {
        saveBtn.textContent = 'Save failed';
      }
    });

    loadBtn.addEventListener('click', async () => {
      try {
        const raw = localStorage.getItem(saveKey);
        if (!raw) {
          loadBtn.textContent = 'No save';
          setTimeout(() => (loadBtn.textContent = 'Continue'), 1200);
          return;
        }
        await engine.restoreState(JSON.parse(raw));
        loadBtn.textContent = 'Loaded ✓';
        setTimeout(() => (loadBtn.textContent = 'Continue'), 1200);
      } catch (err) {
        loadBtn.textContent = 'Load failed';
        console.error('[web-export] load failed', err);
      }
    });
  } catch (err) {
    console.error('[web-export] init failed:', err);
    if (container) container.innerHTML = `<div style="padding:20px;color:#e66">Failed to load the exported story: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}