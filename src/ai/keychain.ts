// Secret storage abstraction for API keys.
//
// Desktop build: OS keychain via Tauri commands (keyring crate).
// Web build: localStorage fallback.
// Keys are NEVER written into the project IR/JSON.

const LS_PREFIX = 'projectvne.ai.keys.';

function isTauri(): boolean {
  try {
    const w = window as any;
    return typeof w.__TAURI_INTERNALS__?.invoke === 'function';
  } catch {
    return false;
  }
}

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const w = window as any;
  return w.__TAURI_INTERNALS__.invoke(cmd, args);
}

export async function getSecret(providerId: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const value = (await tauriInvoke('ai_get_secret', { service: 'projectvne', account: providerId })) as string | null;
      if (value) return value;
    } catch (_) {
      // Fall back to web storage so dev/preview builds keep working.
    }
  }
  try {
    return localStorage.getItem(LS_PREFIX + providerId);
  } catch {
    return null;
  }
}

export async function setSecret(providerId: string, value: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke('ai_set_secret', { service: 'projectvne', account: providerId, value });
      return;
    } catch (_) {
      // Fall through to web storage.
    }
  }
  try {
    localStorage.setItem(LS_PREFIX + providerId, value);
  } catch (_) {}
}

export async function deleteSecret(providerId: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke('ai_delete_secret', { service: 'projectvne', account: providerId });
      return;
    } catch (_) {
      // Fall through to web storage.
    }
  }
  try {
    localStorage.removeItem(LS_PREFIX + providerId);
  } catch (_) {}
}

export function keyStorageMode(): 'keychain' | 'web' {
  return isTauri() ? 'keychain' : 'web';
}