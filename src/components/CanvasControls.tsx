import React, { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock, SlidersHorizontal } from "lucide-react";

interface CanvasControlsProps {
  interactive: boolean;
  setInteractive: (value: boolean) => void;
}

const ctrlBtn =
  "w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " +
  "hover:bg-[var(--bg-hover)] transition-colors cursor-pointer";

export const CanvasControls: React.FC<CanvasControlsProps> = ({ interactive, setInteractive }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="absolute left-3 bottom-3 z-10 flex flex-col items-stretch gap-1.5">
      <div className="flex flex-col rounded-lg overflow-hidden border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-md">
        <button className={ctrlBtn} title="Zoom in" aria-label="Zoom in" onClick={() => zoomIn()}>
          <ZoomIn size={14} />
        </button>
        <button className={ctrlBtn} title="Zoom out" aria-label="Zoom out" onClick={() => zoomOut()}>
          <ZoomOut size={14} />
        </button>
        <button
          className={ctrlBtn}
          title="Fit graph to screen"
          aria-label="Fit graph to screen"
          onClick={() => fitView({ duration: 300 })}
        >
          <Maximize size={13} />
        </button>
      </div>

      <div className="relative">
        <button
          className={`${ctrlBtn} rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-md`}
          title="Canvas settings"
          aria-label="Canvas settings"
          onClick={() => setSettingsOpen(o => !o)}
        >
          <SlidersHorizontal size={14} />
        </button>
        {settingsOpen && (
          <div className="absolute bottom-0 left-9 w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-md p-1.5 text-[11px]">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              title="Prevent accidentally moving nodes"
              onClick={() => setInteractive(!interactive)}
            >
              {interactive ? <Unlock size={13} /> : <Lock size={13} />}
              {interactive ? "Unlock canvas" : "Lock canvas"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
