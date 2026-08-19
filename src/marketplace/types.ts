// Marketplace types. These describe the public marketplace contract. The
// commerce/backend is an external service; the editor consumes it through the
// `MarketplaceService` interface so a hosted implementation can replace the
// bundled offline catalog without touching editor code.
import type { BuiltinPluginDefinition } from '../plugins';

// Creator share (commission model). Published and fixed before any listing goes
// live (Phase 6 AC3): creators keep at least 90% of gross revenue; ProjectVNE
// takes the remainder as commission. These numbers are the source of truth shown
// to the user and documented in docs/phase6-public-ecosystem.md.
export const CREATOR_SHARE_DEFAULT = 90; // percent to the creator
export const PLATFORM_COMMISSION = 100 - CREATOR_SHARE_DEFAULT; // 10%

export type ListingPriceModel = 'free' | 'paid' | 'pay-what-you-want';
export type ListingKind = 'plugin' | 'asset';

export interface MarketplaceListing {
  id: string;
  kind: ListingKind;
  name: string;
  author: string;
  version: string;
  description: string;
  priceModel: ListingPriceModel;
  price?: number; // for 'paid'; for 'pay-what-you-want' a suggested amount
  /** percent to the creator (defaults to CREATOR_SHARE_DEFAULT). */
  creatorShare: number;
  /** categories/tags for the listing UI. */
  tags: string[];
  /**
   * Plugin source to install (plugin listings only). Providing the source inline
   * here is how "install from marketplace" works in this build: installing stores
   * the source and the plugin host loads it at construction — the third-party
   * plugin is added as data, never by modifying core-engine source.
   */
  plugin?: BuiltinPluginDefinition;
}

export interface MarketplaceInstallResult {
  ok: boolean;
  error?: string;
  pluginId?: string;
}

export interface MarketplaceService {
  fetchListings(): Promise<MarketplaceListing[]>;
  install(listingId: string): Promise<MarketplaceInstallResult>;
  /** True if a given plugin is already installed via the marketplace. */
  isInstalled(pluginId: string): boolean;
  /** The installed third-party plugin definitions (loaded into the plugin host). */
  installedPluginDefinitions(): BuiltinPluginDefinition[];
}

export interface InstalledListing {
  listingId: string;
  pluginId: string;
  name: string;
  author: string;
  version: string;
  priceModel: ListingPriceModel;
  installedAt: string;
  /** Plugin source captured at install time (plugin listings). */
  source?: string;
}