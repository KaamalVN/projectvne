import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  BackgroundVariant
} from '@xyflow/react';
import {
  StartNode,
  EndNode,
  DialogueNode,
  ShowCharacterNode,
  ShowBackgroundNode,
  ChoiceNode,
  StoryNodeData
} from './GraphNodes';
import { ProjectIR, ID, StoryBlock, DialogueBlock, ShowCharacterBlock, ChoiceBlock } from '../shared/types';

const nodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  dialogueNode: DialogueNode,
  showCharacterNode: ShowCharacterNode,
  showBackgroundNode: ShowBackgroundNode,
  choiceNode: ChoiceNode
};

interface StoryGraphCanvasProps {
  project: ProjectIR;
  activeSceneId: ID | null;
  onSelectNode?: (nodeId: string, nodeType: string, blockData?: any) => void;
}

export const StoryGraphCanvas: React.FC<StoryGraphCanvasProps> = ({
  project,
  activeSceneId,
  onSelectNode
}) => {
  const { nodes, edges } = useMemo(() => {
    const scene = activeSceneId ? project.scenes[activeSceneId] : null;
    if (!scene) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node<StoryNodeData>[] = [];
    const generatedEdges: Edge[] = [];

    let currentX = 80;
    let currentY = 120;
    const spacingX = 340;
    const spacingY = 160;

    // 1. Start Node
    const startNodeId = `start-${scene.id}`;
    generatedNodes.push({
      id: startNodeId,
      type: 'startNode',
      position: { x: currentX, y: currentY },
      data: {
        id: startNodeId,
        type: 'start',
        title: 'Start',
        subtitle: scene.title
      }
    });

    let prevNodeId = startNodeId;
    let prevSourceHandle = 'out';
    currentX += 280;

    // 2. Background Node (if scene has background)
    if (scene.background && scene.background.assetId) {
      const bgAsset = project.assets[scene.background.assetId];
      const bgNodeId = `bg-${scene.id}`;
      generatedNodes.push({
        id: bgNodeId,
        type: 'showBackgroundNode',
        position: { x: currentX, y: currentY - 40 },
        data: {
          id: bgNodeId,
          type: 'showBackground',
          title: 'Show Background',
          content: bgAsset ? bgAsset.name : 'Background',
          backgroundImage: bgAsset ? `/${bgAsset.fileReference}` : undefined
        }
      });

      generatedEdges.push({
        id: `e-${prevNodeId}-${bgNodeId}`,
        source: prevNodeId,
        sourceHandle: prevSourceHandle,
        target: bgNodeId,
        targetHandle: 'in',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 }
      });

      prevNodeId = bgNodeId;
      prevSourceHandle = 'out';
      currentX += spacingX;
    }

    // 3. Process Scene Blocks
    scene.blocks.forEach((block: StoryBlock, idx: number) => {
      const nodeId = `block-${block.id || idx}`;

      if (block.type === 'showCharacter') {
        const charBlock = block as ShowCharacterBlock;
        const char = project.characters[charBlock.characterId];
        const portrait = char?.portraits?.[charBlock.expression];
        const asset = portrait ? project.assets[portrait.assetId] : null;

        generatedNodes.push({
          id: nodeId,
          type: 'showCharacterNode',
          position: { x: currentX, y: currentY - 50 },
          data: {
            id: nodeId,
            type: 'showCharacter',
            title: 'Show Character',
            characterName: char ? char.name : 'Character',
            characterExpression: charBlock.expression,
            characterPosition: charBlock.position,
            characterImage: asset ? `/${asset.fileReference}` : undefined,
            metadata: charBlock
          }
        });

        generatedEdges.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          sourceHandle: prevSourceHandle,
          target: nodeId,
          targetHandle: 'in',
          animated: false,
          style: { stroke: '#38bdf8', strokeWidth: 2 }
        });

        prevNodeId = nodeId;
        prevSourceHandle = 'out';
        currentX += spacingX;
      } else if (block.type === 'dialogue') {
        const dlgBlock = block as DialogueBlock;
        const char = dlgBlock.characterId ? project.characters[dlgBlock.characterId] : null;

        generatedNodes.push({
          id: nodeId,
          type: 'dialogueNode',
          position: { x: currentX, y: currentY },
          data: {
            id: nodeId,
            type: 'dialogue',
            title: char ? `Say: ${char.name}` : 'Narration',
            characterName: char ? char.name : undefined,
            characterExpression: dlgBlock.expression,
            content: dlgBlock.text,
            metadata: dlgBlock
          }
        });

        generatedEdges.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          sourceHandle: prevSourceHandle,
          target: nodeId,
          targetHandle: 'in',
          animated: false,
          style: { stroke: '#c084fc', strokeWidth: 2 }
        });

        prevNodeId = nodeId;
        prevSourceHandle = 'out';
        currentX += spacingX;
      } else if (block.type === 'choice') {
        const choiceBlock = block as ChoiceBlock;

        generatedNodes.push({
          id: nodeId,
          type: 'choiceNode',
          position: { x: currentX, y: currentY - 20 },
          data: {
            id: nodeId,
            type: 'choice',
            title: 'Choice Branch',
            prompt: choiceBlock.prompt,
            options: choiceBlock.options,
            metadata: choiceBlock
          }
        });

        generatedEdges.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          sourceHandle: prevSourceHandle,
          target: nodeId,
          targetHandle: 'in',
          animated: true,
          style: { stroke: '#fbbf24', strokeWidth: 2 }
        });

        // Branching out choices to branch outcome dialogue nodes or destination scenes
        const branchX = currentX + spacingX + 40;
        choiceBlock.options.forEach((opt, optIdx) => {
          const optTargetScene = opt.destinationSceneId ? project.scenes[opt.destinationSceneId] : null;
          const optOutcomeNodeId = `outcome-${nodeId}-${optIdx}`;

          if (optTargetScene) {
            // Destination Scene Node
            const targetDlg = optTargetScene.blocks.find(b => b.type === 'dialogue') as DialogueBlock | undefined;
            const targetChar = targetDlg?.characterId ? project.characters[targetDlg.characterId] : null;

            generatedNodes.push({
              id: optOutcomeNodeId,
              type: 'dialogueNode',
              position: { x: branchX, y: currentY - 80 + optIdx * spacingY },
              data: {
                id: optOutcomeNodeId,
                type: 'dialogue',
                title: optTargetScene.title,
                characterName: targetChar?.name || 'Alex',
                content: targetDlg?.text || `Transition to: ${optTargetScene.title}`,
                subtitle: `Scene: ${optTargetScene.title}`
              }
            });

            generatedEdges.push({
              id: `e-${nodeId}-opt-${optIdx}`,
              source: nodeId,
              sourceHandle: `opt-${optIdx}`,
              target: optOutcomeNodeId,
              targetHandle: 'in',
              animated: true,
              style: { stroke: '#fbbf24', strokeWidth: 2 }
            });

            // End node after outcome
            const branchEndNodeId = `end-${optOutcomeNodeId}`;
            generatedNodes.push({
              id: branchEndNodeId,
              type: 'endNode',
              position: { x: branchX + 340, y: currentY - 50 + optIdx * spacingY },
              data: {
                id: branchEndNodeId,
                type: 'end',
                title: 'End'
              }
            });

            generatedEdges.push({
              id: `e-${optOutcomeNodeId}-${branchEndNodeId}`,
              source: optOutcomeNodeId,
              sourceHandle: 'out',
              target: branchEndNodeId,
              targetHandle: 'in',
              style: { stroke: '#10b981', strokeWidth: 2 }
            });
          }
        });

        prevNodeId = '';
        currentX += spacingX + 400;
      }
    });

    // Final End Node if linear without terminating choice
    if (prevNodeId) {
      const endNodeId = `end-${scene.id}`;
      generatedNodes.push({
        id: endNodeId,
        type: 'endNode',
        position: { x: currentX, y: currentY },
        data: {
          id: endNodeId,
          type: 'end',
          title: 'End'
        }
      });

      generatedEdges.push({
        id: `e-${prevNodeId}-${endNodeId}`,
        source: prevNodeId,
        sourceHandle: prevSourceHandle,
        target: endNodeId,
        targetHandle: 'in',
        style: { stroke: '#10b981', strokeWidth: 2 }
      });
    }

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [project, activeSceneId]);

  return (
    <div className="w-full h-full bg-[#0b0f17] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        onNodeClick={(_, node) => {
          onSelectNode?.(node.id, node.type || '', node.data);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#1e293b" />
        <Controls
          className="!bg-slate-900/90 !border-slate-800 !rounded-xl !shadow-2xl overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!text-slate-300 hover:[&>button]:!bg-slate-800 hover:[&>button]:!text-white"
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'startNode' || n.type === 'endNode') return '#10b981';
            if (n.type === 'dialogueNode') return '#a855f7';
            if (n.type === 'showCharacterNode' || n.type === 'showBackgroundNode') return '#0284c7';
            if (n.type === 'choiceNode') return '#d97706';
            return '#475569';
          }}
          maskColor="rgba(11, 15, 23, 0.75)"
          className="!bg-[#0f172a] !border !border-slate-800 !rounded-xl overflow-hidden !shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
};
