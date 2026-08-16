import { PixiVisualNovelEngine } from './engine';
import { ProjectIR } from '../shared/types';

// Load and parse the story JSON
async function loadStory(): Promise<ProjectIR> {
  const response = await fetch('/stories/demo-story.json');
  if (!response.ok) {
    throw new Error(`Failed to load story: ${response.status}`);
  }
  const data = await response.json();
  return data as ProjectIR;
}

// Start runtime
async function bootstrap() {
  const container = document.getElementById('game-container') || document.body;
  
  try {
    const story = await loadStory();
    const engine = new PixiVisualNovelEngine(container, {
      onSceneChange: (id, title) => console.log(`[VN Engine] Scene changed: ${title} (${id})`),
      onDialogue: (speaker, text) => console.log(`[VN Engine] ${speaker}: "${text}"`),
      onChoice: (prompt, options) => console.log(`[VN Engine] Choice: ${prompt}`, options),
      onStoryEnd: () => console.log('[VN Engine] Story reached the end.')
    });

    await engine.loadStory(story);
  } catch (error) {
    console.error('Failed to initialize engine:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}