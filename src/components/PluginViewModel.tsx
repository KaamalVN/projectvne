import React from "react";
import type { NodeViewModel } from "../plugins";

// The only shapes a plugin may render into the editor chrome.
export const PluginViewModelView: React.FC<{ vm: NodeViewModel }> = ({ vm }) => {
  if (vm.kind === "kv") {
    return (
      <div className="space-y-1.5">
        {vm.rows.map((row, idx) => (
          <div key={idx}>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">{row.label}</label>
            <div className="p-1.5 bg-[var(--bg-input)] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] whitespace-pre-wrap">
              {row.value || "—"}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (vm.kind === "list") {
    return (
      <ul className="space-y-1">
        {vm.items.map((item, idx) => (
          <li key={idx} className="text-[11px] text-[var(--text-secondary)]">• {item}</li>
        ))}
      </ul>
    );
  }
  return <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{vm.text}</div>;
};