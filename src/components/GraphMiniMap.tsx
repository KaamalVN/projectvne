import { useMemo } from "react";
import {
  useStore,
  useNodes,
  useEdges,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";

interface MiniStyle {
  border: string;
  header: string;
  text: string;
}
const STYLE: Record<string, MiniStyle> = {
  startNode: { border: "var(--green-border)", header: "var(--green-dim)", text: "var(--green-text)" },
  endNode: { border: "var(--green-border)", header: "var(--green-dim)", text: "var(--green-text)" },
  sceneCard: { border: "var(--green-border)", header: "var(--green-dim)", text: "var(--green-text)" },
  dialogueNode: { border: "var(--blue-border)", header: "var(--blue-dim)", text: "var(--blue-text)" },
  showCharacterNode: { border: "var(--violet-border)", header: "var(--violet-dim)", text: "var(--violet-text)" },
  showBackgroundNode: { border: "var(--teal-border)", header: "var(--teal-dim)", text: "var(--teal-text)" },
  choiceNode: { border: "var(--amber-border)", header: "var(--amber-dim)", text: "var(--amber-text)" },
};

const titleFor = (n: Node): string => {
  const d = n.data as any;
  switch (n.type) {
    case "startNode": return "Start";
    case "endNode": return "End";
    case "dialogueNode": return d.characterName ? `Say: ${d.characterName}` : "Narration";
    case "showCharacterNode": return `Show: ${d.characterName ?? "Character"}`;
    case "showBackgroundNode": return `BG: ${d.content ?? "Background"}`;
    case "choiceNode": return "Choice";
    case "sceneCard": return d.title ?? "Scene";
    default: return (n.type as string) ?? "Node";
  }
};

const bodyFor = (n: Node): string => {
  const d = n.data as any;
  switch (n.type) {
    case "dialogueNode": return d.content ?? "";
    case "choiceNode": return d.prompt ?? "";
    case "showCharacterNode": return d.characterExpression ?? "";
    case "showBackgroundNode": return d.content ?? "";
    case "sceneCard": return `${d.blockCount ?? 0} blocks`;
    default: return "";
  }
};

const PAD = 22;

const posOf = (n: Node) => ({ x: n.position.x, y: n.position.y });
const sizeOf = (n: Node) => ({
  w: n.width ?? n.measured?.width ?? 160,
  h: n.height ?? n.measured?.height ?? 60,
});

export function GraphMiniMap({ width = 220, height = 164 }: { width?: number; height?: number }) {
  const nodes = useNodes() as Node[];
  const edges = useEdges() as Edge[];
  const transform = useStore((s) => s.transform);
  const rfWidth = useStore((s) => s.width);
  const rfHeight = useStore((s) => s.height);
  const { setCenter } = useReactFlow();

  const layout = useMemo(() => {
    if (!nodes.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const { x, y } = posOf(n);
      const { w, h } = sizeOf(n);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    minX -= PAD;
    minY -= PAD;
    maxX += PAD;
    maxY += PAD;
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const s = Math.min((width - 6) / gw, (height - 6) / gh);
    const offsetX = (width - gw * s) / 2 - minX * s;
    const offsetY = (height - gh * s) / 2 - minY * s;
    return { s, offsetX, offsetY };
  }, [nodes, width, height]);

  if (!layout) return null;
  const { s, offsetX, offsetY } = layout;

  const toSX = (fx: number) => offsetX + fx * s;
  const toSY = (fy: number) => offsetY + fy * s;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const zoom = transform[2] || 1;
  const vx = toSX(-transform[0] / zoom);
  const vy = toSY(-transform[1] / zoom);
  const vw = ((rfWidth || width) / zoom) * s;
  const vh = ((rfHeight || height) / zoom) * s;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left - offsetX) / s;
    const fy = (e.clientY - rect.top - offsetY) / s;
    setCenter(fx, fy, { zoom, duration: 300 });
  };

  return (
    <div
      className="graph-minimap"
      onClick={handleClick}
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        width,
        height,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
        zIndex: 5,
      }}
      title="Click to navigate"
    >
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {edges.map((e: Edge) => {
          const src = nodeMap.get(e.source);
          const tgt = nodeMap.get(e.target);
          if (!src || !tgt) return null;
          const sp = posOf(src);
          const ss = sizeOf(src);
          const tp = posOf(tgt);
          const ts = sizeOf(tgt);
          const x1 = toSX(sp.x + ss.w);
          const y1 = toSY(sp.y + ss.h / 2);
          const x2 = toSX(tp.x);
          const y2 = toSY(tp.y + ts.h / 2);
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={e.id}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={1}
              opacity={0.8}
            />
          );
        })}

        <rect
          className="mm-viewport"
          x={vx}
          y={vy}
          width={Math.max(2, vw)}
          height={Math.max(2, vh)}
        />
      </svg>

      {nodes.map((n) => {
        const { x, y } = posOf(n);
        const { w, h } = sizeOf(n);
        const st = STYLE[n.type as string] ?? STYLE.dialogueNode;
        const left = toSX(x);
        const top = toSY(y);
        const cw = Math.max(6, w * s);
        const ch = Math.max(5, h * s);
        const headerH = Math.max(7, 26 * s);
        const title = titleFor(n);
        const body = bodyFor(n);
        return (
          <div
            key={n.id}
            className="mm-node"
            style={{
              position: "absolute",
              left,
              top,
              width: cw,
              height: ch,
              background: "var(--bg-card)",
              border: `1px solid ${st.border}`,
              borderRadius: 3,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: st.header,
                color: st.text,
                fontSize: 6,
                lineHeight: `${headerH}px`,
                height: headerH,
                padding: "0 3px",
                fontWeight: 700,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            {body && (
              <div
                style={{
                  fontSize: 5,
                  lineHeight: "7px",
                  padding: "1px 3px",
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
