import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Node,
  Edge,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge
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
import { CanvasControls } from './CanvasControls';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ProjectIR, ID, StoryBlock, DialogueBlock, ShowCharacterBlock, ChoiceBlock } from '../shared/types';
import { Trash2, MessageSquare, Split, User } from 'lucide-react';

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
  onDeleteBlock?: (blockIdOrIndex: string) => void;
  onAddDialogue?: () => void;
  onAddChoice?: () => void;
  onAddCharacter?: () => void;
}

export const StoryGraphCanvas: React.FC<StoryGraphCanvasProps> = ({
  project,
  activeSceneId,
  theme,
  onSelectNode,
  onDeleteBlock,
  onAddDialogue,
  onAddChoice,
  onAddCharacter
}) => {
  const [interactive, setInteractive] = useState(true);
  const [nodes, setNodes] = useState<Node<StoryNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  // Generate initial layout whenever project/scene changes
  useEffect(() => {
    const scene = activeSceneId ? project.scenes[activeSceneId] : null;
    if (!scene) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const generatedNodes: Node<StoryNodeData>[] = [];
    const generatedEdges: Edge[] = [];

    let currentX = 80;
    let currentY = 140;
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

    // 2. Background Node (if present)
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
        style: { stroke: '#6b7280', strokeWidth: 2 }
      });

      prevNodeId = bgNodeId;
      prevSourceHandle = 'out';
      currentX += spacingX;
    }

    // 3. Scene Blocks
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

        choiceBlock.options.forEach((opt, optIdx) => {
          const optTargetScene = opt.destinationSceneId ? project.scenes[opt.destinationSceneId] : null;
          const optOutcomeNodeId = `outcome-${nodeId}-${optIdx}`;

          if (optTargetScene) {
            const targetDlg = optTargetScene.blocks.find(b => b.type === 'dialogue') as DialogueBlock | undefined;
            const targetChar = targetDlg?.characterId ? project.characters[targetDlg.characterId] : null;

            generatedNodes.push({
              id: optOutcomeNodeId,
              type: 'dialogueNode',
              position: { x: currentX + spacingX + 40, y: currentY - 80 + optIdx * spacingY },
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
          }
        });

        prevNodeId = '';
        currentX += spacingX + 400;
      }
    });

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
        style: { stroke: '#22c55e', strokeWidth: 2 }
      });
    }

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [project, activeSceneId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as Node<StoryNodeData>[]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => {
        if (node.id.startsWith('block-')) {
          onDeleteBlock?.(node.id.replace('block-', ''));
        }
      });
    },
    [onDeleteBlock]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();

      const items: ContextMenuItem[] = [
        {
          id: 'inspect',
          label: `Inspect ${node.type || 'Node'}`,
          onClick: () => onSelectNode?.(node.id, node.type || '', node.data)
        }
      ];

      if (node.id.startsWith('block-')) {
        items.push(
          { id: 'divider-1', label: '', divider: true },
          {
            id: 'delete',
            label: 'Delete Node',
            icon: <Trash2 size={13} />,
            danger: true,
            shortcut: 'Del',
            onClick: () => onDeleteBlock?.(node.id.replace('block-', ''))
          }
        );
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        items
      });
    },
    [onSelectNode, onDeleteBlock]
  );

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            id: 'add-dialogue',
            label: 'Add Dialogue Block',
            icon: <MessageSquare size={13} className="text-[var(--blue-text)]" />,
            onClick: () => onAddDialogue?.()
          },
          {
            id: 'add-choice',
            label: 'Add Choice Block',
            icon: <Split size={13} className="text-[var(--amber-text)]" />,
            onClick: () => onAddChoice?.()
          },
          {
            id: 'add-character',
            label: 'Add Show Character',
            icon: <User size={13} className="text-[var(--violet-text)]" />,
            onClick: () => onAddCharacter?.()
          }
        ]
      });
    },
    [onAddDialogue, onAddChoice, onAddCharacter]
  );

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--canvas-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme === 'light' ? 'light' : 'dark'}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable={interactive}
        nodesConnectable={interactive}
        elementsSelectable={interactive}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={handleNodesDelete}
        onNodeClick={(_, node) => {
          onSelectNode?.(node.id, node.type || '', node.data);
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#3a3a46" />
        <CanvasControls interactive={interactive} setInteractive={setInteractive} />
        <GraphMiniMap />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
