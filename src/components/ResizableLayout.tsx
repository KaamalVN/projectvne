import React, { useState, useEffect, useRef, useCallback } from "react";

interface ResizableLayoutProps {
  leftContent: React.ReactNode;
  centerContent: React.ReactNode;
  rightContent: React.ReactNode;
  bottomContent: React.ReactNode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  defaultBottomHeight?: number;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftContent,
  centerContent,
  rightContent,
  bottomContent,
  leftCollapsed,
  rightCollapsed,
  bottomCollapsed,
  defaultLeftWidth = 240,
  defaultRightWidth = 280,
  defaultBottomHeight = 200,
}) => {
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem("projectvne_left_width");
    return saved ? Number(saved) : defaultLeftWidth;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem("projectvne_right_width");
    return saved ? Number(saved) : defaultRightWidth;
  });
  const [bottomHeight, setBottomHeight] = useState(() => {
    const saved = localStorage.getItem("projectvne_bottom_height");
    return saved ? Number(saved) : defaultBottomHeight;
  });

  const isDraggingRef = useRef<"left" | "right" | "bottom" | null>(null);

  const startDrag = (split: "left" | "right" | "bottom") => (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = split;
    document.body.style.cursor = split === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    if (isDraggingRef.current === "left") {
      const newWidth = Math.max(160, Math.min(450, e.clientX));
      setLeftWidth(newWidth);
      localStorage.setItem("projectvne_left_width", String(newWidth));
    } else if (isDraggingRef.current === "right") {
      const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
      localStorage.setItem("projectvne_right_width", String(newWidth));
    } else if (isDraggingRef.current === "bottom") {
      const newHeight = Math.max(100, Math.min(500, window.innerHeight - e.clientY));
      setBottomHeight(newHeight);
      localStorage.setItem("projectvne_bottom_height", String(newHeight));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* LEFT SIDEBAR */}
      {!leftCollapsed && (
        <div
          style={{ width: `${leftWidth}px` }}
          className="bg-[var(--bg-panel)] flex flex-col shrink-0 overflow-hidden relative border-r border-[var(--border-subtle)]"
        >
          {leftContent}
        </div>
      )}

      {/* LEFT SPLITTER */}
      {!leftCollapsed && (
        <div
          onMouseDown={startDrag("left")}
          className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--accent)] transition-colors cursor-col-resize shrink-0 z-20 relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* CENTER & BOTTOM COLUMN */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* CENTER VIEWPORT */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          {centerContent}
        </div>

        {/* BOTTOM SPLITTER */}
        {!bottomCollapsed && (
          <div
            onMouseDown={startDrag("bottom")}
            className="h-1 bg-[var(--border-subtle)] hover:bg-[var(--accent)] transition-colors cursor-row-resize shrink-0 z-20 relative group"
          >
            <div className="absolute -top-1 -bottom-1 inset-x-0" />
          </div>
        )}

        {/* BOTTOM DOCK */}
        {!bottomCollapsed && (
          <div
            style={{ height: `${bottomHeight}px` }}
            className="bg-[var(--bg-surface)] flex shrink-0 overflow-hidden border-t border-[var(--border-subtle)] relative"
          >
            {bottomContent}
          </div>
        )}
      </div>

      {/* RIGHT SPLITTER */}
      {!rightCollapsed && (
        <div
          onMouseDown={startDrag("right")}
          className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--accent)] transition-colors cursor-col-resize shrink-0 z-20 relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* RIGHT SIDEBAR */}
      {!rightCollapsed && (
        <div
          style={{ width: `${rightWidth}px` }}
          className="bg-[var(--bg-panel)] flex flex-col shrink-0 overflow-hidden relative border-l border-[var(--border-subtle)]"
        >
          {rightContent}
        </div>
      )}
    </div>
  );
};
