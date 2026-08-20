import React, { useEffect, useState } from "react";
import { getMarketplaceService } from "../marketplace/service";
import { CREATOR_SHARE_DEFAULT, type MarketplaceListing } from "../marketplace/types";
import { ShoppingBag, X, Search, Check, Download } from "lucide-react";

interface MarketplaceModalProps {
  onClose?: () => void;
  onInstalledChange: () => void;
}

const modalBox = "bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl w-full h-[620px] flex flex-col overflow-hidden";

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  onClose,
  onInstalledChange,
}) => {
  const svc = getMarketplaceService();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    svc.fetchListings().then(setListings).catch(() => setListings([]));
  }, [svc]);

  const doInstall = async (listing: MarketplaceListing) => {
    setBusy(listing.id);
    setNotice(null);
    const res = await svc.install(listing.id);
    setBusy(null);
    if (res.ok) {
      setNotice({ kind: "ok", text: `Successfully installed "${listing.name}". Enabled in Plugin Manager.` });
      onInstalledChange();
    } else {
      setNotice({ kind: "error", text: res.error || "Installation failed." });
    }
  };

  const priceLabel = (l: MarketplaceListing) =>
    l.priceModel === "free" ? "Free" : l.priceModel === "paid" ? `$${l.price}` : `PWYW ($${l.price || 0})`;

  const filtered = listings.filter((l) => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || l.kind === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={modalBox} data-testid="marketplace-modal">
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center">
            <ShoppingBag size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Community Marketplace</h3>
            <p className="text-[10px] text-[var(--text-muted)]">Extend ProjectVNE with templates, custom blocks, and portraits.</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* FILTER BAR */}
      <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["all", "plugin", "template", "asset"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                selectedCategory === cat
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-default)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-transparent"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}s
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-2 text-[var(--text-ghost)]" />
          <input
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)] font-sans"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* RESULTS GRID */}
      <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
        {notice && (
          <div
            className={`p-3 rounded-lg border text-xs font-semibold mb-4 ${
              notice.kind === "ok"
                ? "bg-[var(--green-dim)] border-[var(--green-border)] text-[var(--green-text)]"
                : "bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error-text)]"
            }`}
          >
            {notice.text}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--text-ghost)]">
            <ShoppingBag size={32} className="opacity-30 mb-2" />
            <div className="text-xs font-semibold">No assets found</div>
            <div className="text-[10px] text-[var(--text-muted)]">Try adjusting your filter or search query.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((l) => {
              const installed = l.kind === "plugin" && svc.isInstalled(l.id);

              return (
                <div
                  key={l.id}
                  className="p-4 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl flex flex-col justify-between hover:border-[var(--border-strong)] transition-all shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">{l.name}</h4>
                        <span className="text-[9px] text-[var(--text-ghost)] font-mono">by {l.author}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)]">
                        {priceLabel(l)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">{l.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-ghost)]">
                      {l.creatorShare}% revenue to creator
                    </span>

                    {l.kind === "plugin" && (
                      <button
                        onClick={() => doInstall(l)}
                        disabled={busy === l.id || installed}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          installed
                            ? "bg-[var(--green-dim)] text-[var(--green-text)] border border-[var(--green-border)]"
                            : "bg-[var(--accent)] hover:brightness-110 text-black shadow-sm disabled:opacity-40"
                        }`}
                      >
                        {installed ? (
                          <>
                            <Check size={12} /> Installed
                          </>
                        ) : busy === l.id ? (
                          "Installing..."
                        ) : (
                          <>
                            <Download size={12} /> Install
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="px-6 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)] text-xs text-[var(--text-muted)]">
        <span>Creators receive {CREATOR_SHARE_DEFAULT}% transparent revenue share.</span>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
