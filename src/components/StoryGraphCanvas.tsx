import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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
import { GraphMiniMap } from './GraphMiniMap';
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
  theme: "dark" | "light";
  onSelectNode?: (nodeId: string, nodeType: string, blockData?: any) => void;
}

export const StoryGraphCanvas: React.FC<StoryGraphCanvasProps> = ({
  project,
  activeSceneId,
  theme,
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
      width: 192,
      height: 68,
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
        width: 240,
        height: 98,
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
        style: { stroke: '#6b7280', strokeWidth: 2 }
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
          width: 240,
          height: 106,
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
          style: { stroke: '#6b7280', strokeWidth: 2 }
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
          width: 272,
          height: 120,
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
          style: { stroke: '#6b7280', strokeWidth: 2 }
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
          width: 296,
          height: 158,
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

        // Branching out choices
        const branchX = currentX + spacingX + 40;
        choiceBlock.options.forEach((opt, optIdx) => {
          const optTargetScene = opt.destinationSceneId ? project.scenes[opt.destinationSceneId] : null;
          const optOutcomeNodeId = `outcome-${nodeId}-${optIdx}`;

          if (optTargetScene) {
            const targetDlg = optTargetScene.blocks.find(b => b.type === 'dialogue') as DialogueBlock | undefined;
            const targetChar = targetDlg?.characterId ? project.characters[targetDlg.characterId] : null;

            generatedNodes.push({
              id: optOutcomeNodeId,
              type: 'dialogueNode',
              position: { x: branchX, y: currentY - 80 + optIdx * spacingY },
              width: 272,
              height: 120,
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

            const branchEndNodeId = `end-${optOutcomeNodeId}`;
            generatedNodes.push({
              id: branchEndNodeId,
              type: 'endNode',
              position: { x: branchX + 340, y: currentY - 50 + optIdx * spacingY },
              width: 176,
              height: 68,
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
              style: { stroke: '#22c55e', strokeWidth: 2 }
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
        width: 176,
        height: 68,
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
        style: { stroke: '#22c55e', strokeWidth: 2 }
      });
    }

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [project, activeSceneId]);

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--canvas-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme === "light" ? "light" : "dark"}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        onNodeClick={(_, node) => {
          onSelectNode?.(node.id, node.type || "", node.data);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#3a3a46" />
        <Controls />
        <GraphMiniMap />
      </ReactFlow>
    </div>
  );
};
