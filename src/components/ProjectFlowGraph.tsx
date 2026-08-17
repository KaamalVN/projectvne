import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ProjectIR, ID } from '../shared/types';
import { GraphMiniMap } from './GraphMiniMap';
import { Play, CheckCircle2, Split } from 'lucide-react';

const SceneCardNode = ({ data }: { data: any }) => {
  const isEntry = data.isEntry;
  const blockCount = data.blockCount || 0;

  return (
    <div className="w-56 rounded-lg overflow-hidden shadow-md transition-all hover:shadow-lg"
      style={{ background: 'var(--bg-card)', border: `1px solid ${isEntry ? 'var(--green-border)' : 'var(--border-default)'}` }}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ background: isEntry ? 'var(--green-text)' : 'var(--text-secondary)', width: 10, height: 10, border: '2px solid var(--canvas-bg, #121216)' }} />

      <div className="px-3 py-2 flex items-center justify-between"
        style={{ background: isEntry ? 'var(--green-dim)' : 'var(--bg-surface)', borderBottom: `1px solid ${isEntry ? 'var(--green-border)' : 'var(--border-subtle)'}` }}>
        <div className="flex items-center gap-1.5">
          {isEntry ? <Play size={11} style={{ color: 'var(--green-text)' }} /> : <CheckCircle2 size={11} style={{ color: 'var(--text-muted)' }} />}
          <span className="text-[11px] font-bold" style={{ color: isEntry ? 'var(--green-text)' : 'var(--text-primary)' }}>{data.title}</span>
        </div>
        {isEntry && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}>START</span>}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: 'var(--text-muted)' }}>Blocks</span>
          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{blockCount}</span>
        </div>
        {data.hasChoices && (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Split size={9} />
            <span>Has branching</span>
          </div>
        )}
        <div className="text-[9px] font-mono truncate" style={{ color: 'var(--text-ghost)' }}>{data.id}</div>
      </div>

      <Handle type="source" position={Position.Right} id="out"
        style={{ background: isEntry ? 'var(--green-text)' : 'var(--text-secondary)', width: 10, height: 10, border: '2px solid var(--canvas-bg, #121216)' }} />
    </div>
  );
};

const nodeTypes = {
  sceneCard: SceneCardNode,
};

interface ProjectFlowGraphProps {
  project: ProjectIR;
  theme: "dark" | "light";
  onSelectScene?: (sceneId: ID) => void;
}

const ProjectFlowGraphContent: React.FC<ProjectFlowGraphProps> = ({
  project,
  theme,
  onSelectScene
}) => {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    const sceneIds = Object.keys(project.scenes);
    const entrySceneId = project.flow.entrySceneId;

    const levels: Map<string, number> = new Map();
    const sceneConnections: Map<string, string[]> = new Map();

    project.flow.connections.forEach(conn => {
      if (!sceneConnections.has(conn.fromSceneId)) {
        sceneConnections.set(conn.fromSceneId, []);
      }
      sceneConnections.get(conn.fromSceneId)!.push(conn.toSceneId);
    });

    if (entrySceneId && project.scenes[entrySceneId]) {
      levels.set(entrySceneId, 0);
      const queue: [string, number][] = [[entrySceneId, 0]];

      while (queue.length > 0) {
        const [sceneId, level] = queue.shift()!;
        const connections = sceneConnections.get(sceneId) || [];

        connections.forEach(targetId => {
          if (!levels.has(targetId)) {
            levels.set(targetId, level + 1);
            queue.push([targetId, level + 1]);
          }
        });
      }
    }

    sceneIds.forEach(id => {
      if (!levels.has(id)) {
        levels.set(id, 0);
      }
    });

    const scenesByLevel: Map<number, string[]> = new Map();
    levels.forEach((level, sceneId) => {
      if (!scenesByLevel.has(level)) {
        scenesByLevel.set(level, []);
      }
      scenesByLevel.get(level)!.push(sceneId);
    });

    const levelHeight = 180;
    const horizontalSpacing = 280;

    scenesByLevel.forEach((sceneIdsAtLevel, level) => {
      const totalWidth = (sceneIdsAtLevel.length - 1) * horizontalSpacing;
      const startX = -totalWidth / 2;

      sceneIdsAtLevel.forEach((sceneId, index) => {
        const scene = project.scenes[sceneId];
        const hasChoices = scene.blocks.some(b => b.type === 'choice');

        generatedNodes.push({
          id: sceneId,
          type: 'sceneCard',
          position: {
            x: startX + index * horizontalSpacing,
            y: level * levelHeight
          },
          width: 224,
          height: 104,
          data: {
            id: sceneId,
            title: scene.title,
            isEntry: sceneId === entrySceneId,
            blockCount: scene.blocks.length,
            hasChoices
          }
        });
      });
    });

    project.flow.connections.forEach((conn, index) => {
      const sourceNode = generatedNodes.find(n => n.id === conn.fromSceneId);
      const targetNode = generatedNodes.find(n => n.id === conn.toSceneId);

      if (sourceNode && targetNode) {
        generatedEdges.push({
          id: `flow-${index}`,
          source: conn.fromSceneId,
          sourceHandle: 'out',
          target: conn.toSceneId,
          targetHandle: 'in',
          animated: true,
          style: { stroke: '#6b7280', strokeWidth: 2 },
          label: conn.conditionId ? 'Conditional' : '',
          labelStyle: { fill: '#888', fontSize: 10, fontWeight: 500 }
        });
      }
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [project]);

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView();
      }, 100);
    }
  }, [nodes, fitView]);

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--canvas-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme === "light" ? "light" : "dark"}
        fitView
        minZoom={0.1}
        maxZoom={2}
        onNodeClick={(_, node) => {
          onSelectScene?.(node.id);
        }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#6b7280', strokeWidth: 2 }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#3a3a46" />
        <Controls />
        <GraphMiniMap />
      </ReactFlow>
    </div>
  );
};

export const ProjectFlowGraph: React.FC<ProjectFlowGraphProps> = (props) => (
  <ReactFlowProvider>
    <ProjectFlowGraphContent {...props} />
  </ReactFlowProvider>
);
