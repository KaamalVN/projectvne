// Persistence for marketplace-installed third-party plugins. Installed plugin
// definitions are stored as plain data (id + source) and loaded into the plugin
// host at construction time — a plugin is installed as data, never compiled into
// the editor. This is the mechanical proof of the Phase 6 AC1 requirement.
import type { BuiltinPluginDefinition } from '../plugins';
import type { InstalledListing } from './types';

const STORAGE_KEY = 'projectvne.marketplace.installed';

export function getInstalledListings(): InstalledListing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isInstalled(pluginId: string): boolean {
  return getInstalledListings().some((l) => l.pluginId === pluginId);
}

export function recordInstalled(listing: InstalledListing): void {
  try {
    const list = getInstalledListings().filter((l) => l.pluginId !== listing.pluginId);
    list.push(listing);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable; treat as not installed
  }
}

export function uninstall(pluginId: string): void {
  try {
    const list = getInstalledListings().filter((l) => l.pluginId !== pluginId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
}

/**
 * The third-party plugin sources currently installed. `createDefaultPluginHost()`
 * appends these after the builtins so installed plugins participate in the same
 * capability model, enablement, and dispatch as first-party ones.
 */
export function getInstalledPluginDefinitions(): BuiltinPluginDefinition[] {
  const out: BuiltinPluginDefinition[] = [];
  for (const listing of getInstalledListings()) {
    if (listing.pluginId && listing.source) {
      out.push({ id: listing.pluginId, source: listing.source });
    }
  }
  return out;
}