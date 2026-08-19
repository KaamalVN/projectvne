import type { AiProviderId, AiScope } from './types';

// App-level AI preferences. These are authoring preferences and live OUTSIDE the
// project IR (the per-project `ai.enabled` switch lives in the IR instead).
export interface AiPreferences {
  providerId: AiProviderId;
  model: string;
  ollamaEndpoint: string;
  scope: AiScope;
}

const KEY = 'projectvne.ai.preferences';

export const DEFAULT_PREFERENCES: AiPreferences = {
  providerId: 'mock',
  model: '',
  ollamaEndpoint: 'http://localhost:11434',
  scope: 'scene',
};

export function loadPreferences(): AiPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_PREFERENCES };
}

export function savePreferences(prefs: AiPreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (_) {}
}