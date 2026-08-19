import React, { useEffect, useState } from 'react';
import { getMarketplaceService } from '../marketplace/service';
import { CREATOR_SHARE_DEFAULT, type MarketplaceListing } from '../marketplace/types';
import { PluginManager } from './PluginManager';
import type { PluginHost } from '../plugins';
import type { ProjectIR } from '../shared/types';

interface MarketplaceManagerProps {
  host: PluginHost;
  project: ProjectIR;
  onTogglePlugin: (id: string, enabled: boolean) => void;
  onInstalledChange: () => void;
}

export const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ host, project, onTogglePlugin, onInstalledChange }) => {
  const svc = getMarketplaceService();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    svc.fetchListings().then(setListings).catch(() => setListings([]));
  }, [svc]);

  const doInstall = async (listing: MarketplaceListing) => {
    setBusy(listing.id);
    setNotice(null);
    const res = await svc.install(listing.id);
    setBusy(null);
    if (res.ok) {
      setNotice({ kind: 'ok', text: `Installed "${listing.name}". Enable it under Plugins if you want to use it.` });
      onInstalledChange();
    } else {
      setNotice({ kind: 'error', text: res.error || 'Install failed.' });
    }
  };

  const priceLabel = (l: MarketplaceListing) =>
    l.priceModel === 'free' ? 'Free' : l.priceModel === 'paid' ? `$${l.price}` : `Pay what you want${l.price ? ` (suggest $${l.price})` : ''}`;

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-ghost)] block mb-1">Marketplace</span>
        <div className="text-[10px] text-[var(--text-muted)] mb-2">
          Plugins and assets published by third parties. Creators keep {CREATOR_SHARE_DEFAULT}% of gross revenue; the platform
          takes {100 - CREATOR_SHARE_DEFAULT}%. These numbers are published and fixed before any listing goes live.
        </div>
        {notice && (
          <div className={`p-2 mb-2 rounded-md border text-[10px] ${notice.kind === 'ok' ? 'bg-[var(--green-dim)] border-[var(--green-border)] text-[var(--green-text)]' : 'bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error-text)]'}`}>
            {notice.text}
          </div>
        )}
        <div className="space-y-2">
          {listings.length === 0 && <div className="text-[var(--text-ghost)] italic text-center py-6 text-[11px]">Marketplace is empty.</div>}
          {listings.map((l) => {
            const installed = l.plugin ? svc.isInstalled(l.plugin.id) : false;
            return (
              <div key={l.id} className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]" data-testid={`marketplace-${l.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[var(--text-primary)]">{l.name}</div>
                    <div className="text-[9px] font-mono text-[var(--text-ghost)]">{l.author} · v{l.version} · {l.kind}</div>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] shrink-0">{priceLabel(l)}</span>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">{l.description}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] text-[var(--text-muted)]">{l.creatorShare}% to creator</span>
                  {l.kind === 'plugin' && (
                    <button
                      onClick={() => doInstall(l)}
                      disabled={busy === l.id}
                      data-testid={`marketplace-install-${l.id}`}
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] disabled:opacity-40"
                    >
                      {installed ? 'Installed' : busy === l.id ? 'Installing…' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-3">
        <div className="text-[10px] text-[var(--text-muted)] mb-1">
          Installed plugins (reuses the Plugins management surface — enable/disable here works the same as in the Plugins tab):
        </div>
        <PluginManager host={host} project={project} onTogglePlugin={onTogglePlugin} />
      </div>
    </div>
  );
};