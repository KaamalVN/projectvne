import React, { useEffect, useRef } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Ensure menu stays within screen bounds
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - (items.length * 30 + 20));

  return (
    <div
      ref={menuRef}
      style={{ left: `${Math.max(10, adjustedX)}px`, top: `${Math.max(10, adjustedY)}px` }}
      className="fixed z-50 min-w-[200px] bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl py-1 text-xs text-[var(--text-primary)] animate-in fade-in zoom-in-95 duration-75 select-none"
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`div-${index}`} className="my-1 border-t border-[var(--border-subtle)]" />;
        }

        return (
          <button
            key={item.id || index}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
              item.disabled
                ? "opacity-40 cursor-not-allowed text-[var(--text-ghost)]"
                : item.danger
                ? "text-[var(--error-text)] hover:bg-[var(--error-bg)]"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="opacity-70 text-xs">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] font-mono text-[var(--text-ghost)] ml-4">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
