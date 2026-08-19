// Per-plugin enable/disable persistence. Enablement is app-level (not stored in
// the IR). The store holds the DISABLED ids: an empty list means everything is
// enabled (the default), and a plugin is enabled unless it appears in the list.
const STORAGE_KEY = 'projectvne.plugins.disabled';

export function getDisabledPluginIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function isPluginEnabled(id: string): boolean {
  return !getDisabledPluginIds().includes(id);
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  try {
    const current = new Set(getDisabledPluginIds());
    if (enabled) {
      current.delete(id);
    } else {
      current.add(id);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // storage unavailable; enable state stays as-is
  }
}