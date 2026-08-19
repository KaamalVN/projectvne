import { useEffect, useState } from 'react';
import type { AiProviderId } from './types';
import type { AiPreferences } from './preferences';
import { loadPreferences, savePreferences } from './preferences';
import { getSecret, setSecret, deleteSecret, keyStorageMode } from './keychain';

// Single source of truth for app-level AI state (provider prefs + keys). Shared
// by the AI panel and the general Settings modal so both surfaces never drift.
export function useAiState() {
  const [prefs, setPrefsState] = useState<AiPreferences>(() => loadPreferences());
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [storageMode, setStorageMode] = useState<string>(() => keyStorageMode());

  useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  const setPrefs = (patch: Partial<AiPreferences>) => {
    setPrefsState(prev => ({ ...prev, ...patch }));
  };

  const loadKey = async (providerId: string): Promise<string | null> => {
    const value = await getSecret(providerId);
    if (value) setKeys(prev => ({ ...prev, [providerId]: value }));
    return value;
  };

  const saveKey = async (providerId: string, value: string): Promise<void> => {
    if (!value.trim()) {
      await deleteSecret(providerId);
      setKeys(prev => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      return;
    }
    await setSecret(providerId, value.trim());
    setKeys(prev => ({ ...prev, [providerId]: value.trim() }));
  };

  const refreshStorageMode = () => setStorageMode(keyStorageMode());

  return { prefs, setPrefs, keys, loadKey, saveKey, storageMode, refreshStorageMode };
}

export type AiKeyState = {
  prefs: AiPreferences;
  setPrefs: (patch: Partial<AiPreferences>) => void;
  keys: Record<AiProviderId | string, string>;
  loadKey: (providerId: string) => Promise<string | null>;
  saveKey: (providerId: string, value: string) => Promise<void>;
  storageMode: string;
};