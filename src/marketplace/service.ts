// The marketplace service. The bundled `LocalMarketplaceService` serves the
// offline catalog and records installs in local storage, which makes the whole
// install-from-marketplace surface real and testable. A hosted marketplace
// implements the identical interface over HTTP (auth, payments, listing CRUD)
// and the editor code does not change — see docs/cloud-services.md for that
// contract.
import type {
  MarketplaceInstallResult,
  MarketplaceListing,
  MarketplaceService,
} from './types';
import { fetchCatalog, THIRD_PARTY_PLUGINS } from './catalog';
import { isInstalled, recordInstalled, uninstall, getInstalledPluginDefinitions } from './installed';

export class LocalMarketplaceService implements MarketplaceService {
  async fetchListings(): Promise<MarketplaceListing[]> {
    return fetchCatalog();
  }

  async install(listingId: string): Promise<MarketplaceInstallResult> {
    const listing = fetchCatalog().find((l) => l.id === listingId);
    if (!listing) return { ok: false, error: `Listing '${listingId}' was not found in the marketplace.` };
    if (listing.kind === 'plugin') {
      const plugin = listing.plugin || THIRD_PARTY_PLUGINS.find((p) => p.id === listing.id);
      if (!plugin) return { ok: false, error: `Listing '${listingId}' has no installable plugin payload.` };
      recordInstalled({
        listingId: listing.id,
        pluginId: plugin.id,
        name: listing.name,
        author: listing.author,
        version: listing.version,
        priceModel: listing.priceModel,
        installedAt: new Date().toISOString(),
        source: plugin.source,
      });
      return { ok: true, pluginId: plugin.id };
    }
    // Asset listings: in this build they resolve to downloadable assets via the
    // marketplace; for now we record the intent (no plugin source).
    recordInstalled({
      listingId: listing.id,
      pluginId: `asset-${listing.id}`,
      name: listing.name,
      author: listing.author,
      version: listing.version,
      priceModel: listing.priceModel,
      installedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  isInstalled(pluginId: string): boolean {
    return isInstalled(pluginId);
  }

  installedPluginDefinitions() {
    return getInstalledPluginDefinitions();
  }

  uninstall(pluginId: string): void {
    uninstall(pluginId);
  }
}

let service: MarketplaceService | null = null;
export function getMarketplaceService(): MarketplaceService {
  if (!service) service = new LocalMarketplaceService();
  return service;
}