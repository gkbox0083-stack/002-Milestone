import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import type { Connection, Edge, Node, OnSelectionChangeFunc } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { findCriticalPath, wouldCreateCycle, getChildren, getEffectiveMilestone } from '../utils';
import MilestoneNode from './MilestoneNode';
import GroupNode from './GroupNode';

const nodeTypes = { milestone: MilestoneNode, group: GroupNode };

const GROUP_HEADER_HEIGHT = 36;
const CHILD_NODE_WIDTH = 180;
const CHILD_NODE_HEIGHT = 90;
const GROUP_PADDING_X = 20;
const GROUP_PADDING_Y = 16;
const CHILD_SPACING_Y = 16;

export default function NetworkView() {
  const {
    project,
    selectedMilestoneId,
    selectMilestone,
    selectMilestones,
    clearSelection,
    setEditingMilestone,
    addDependency,
    darkMode,
  } = useStore();

  const { t } = useTranslation();
  const milestones = project.milestones;
  const criticalPath = useMemo(() => findCriticalPath(milestones), [milestones]);

  // Compute initial node positions using a simple layered layout
  const { initialNodes, initialEdges } = useMemo(() => {
    const byId = new Map(milestones.map((m) => [m.id, m]));

    // Identify parents (milestones that have children)
    const parentIds = new Set<string>();
    const childIdSet = new Set<string>();
    for (const m of milestones) {
      if (m.parentId) {
        parentIds.add(m.parentId);
        childIdSet.add(m.id);
      }
    }

    // Compute layer (depth) for each milestone (only top-level + parents)
    const topLevel = milestones.filter((m) => !m.parentId);
    const layers = new Map<string, number>();
    const visiting = new Set<string>();
    function getLayer(id: string): number {
      if (layers.has(id)) return layers.get(id)!;
      if (visiting.has(id)) return 0; // cycle detected — break with 0
      visiting.add(id);
      const ms = byId.get(id);
      if (!ms || ms.dependencies.length === 0) {
        layers.set(id, 0);
        visiting.delete(id);
        return 0;
      }
      // For dependencies, resolve child -> parent for layer calculation
      const depLayers = ms.dependencies.map((d) => {
        const depMs = byId.get(d);
        if (depMs?.parentId && parentIds.has(depMs.parentId)) {
          // Use parent's layer if dep is a child
          return getLayer(depMs.parentId);
        }
        return getLayer(d);
      });
      const maxDepLayer = Math.max(...depLayers);
      const layer = maxDepLayer + 1;
      layers.set(id, layer);
      visiting.delete(id);
      return layer;
    }
    topLevel.forEach((m) => getLayer(m.id));

    // Group by layer
    const layerGroups = new Map<number, string[]>();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(id);
    }

    const nodes: Node[] = [];
    const xSpacing = 280;
    const ySpacing = 120;

    for (const [layer, ids] of layerGroups) {
      ids.forEach((id, idx) => {
        const ms = byId.get(id)!;
        const totalInLayer = ids.length;
        const yOffset = (idx - (totalInLayer - 1) / 2) * ySpacing;
        const baseX = layer * xSpacing + 50;
        const baseY = 300 + yOffset;

        if (parentIds.has(id)) {
          // This is a group parent
          const children = getChildren(milestones, id);
          const effective = getEffectiveMilestone(milestones, ms);

          // Compute group dimensions
          const groupWidth = CHILD_NODE_WIDTH + GROUP_PADDING_X * 2;
          const groupHeight = GROUP_HEADER_HEIGHT + GROUP_PADDING_Y + children.length * (CHILD_NODE_HEIGHT + CHILD_SPACING_Y) - CHILD_SPACING_Y + GROUP_PADDING_Y;

          nodes.push({
            id: ms.id,
            type: 'group',
            position: { x: baseX, y: baseY },
            data: {
              label: ms.title,
              color: ms.color,
              darkMode,
              status: effective.status,
              progress: effective.progress,
            },
            style: { width: groupWidth, height: groupHeight },
          });

          // Add children inside parent
          children.forEach((child, childIdx) => {
            nodes.push({
              id: child.id,
              type: 'milestone',
              position: {
                x: GROUP_PADDING_X,
                y: GROUP_HEADER_HEIGHT + GROUP_PADDING_Y + childIdx * (CHILD_NODE_HEIGHT + CHILD_SPACING_Y),
              },
              parentId: ms.id,
              extent: 'parent' as const,
              data: {
                label: child.title,
                status: child.status,
                color: child.color,
                progress: child.progress,
                isSelected: child.id === selectedMilestoneId,
                isCritical: criticalPath.has(child.id),
                darkMode,
              },
            });
          });
        } else {
          // Normal top-level milestone
          nodes.push({
            id: ms.id,
            type: 'milestone',
            position: { x: baseX, y: baseY },
            data: {
              label: ms.title,
              status: ms.status,
              color: ms.color,
              progress: ms.progress,
              isSelected: ms.id === selectedMilestoneId,
              isCritical: criticalPath.has(ms.id),
              darkMode,
            },
          });
        }
      });
    }

    // Edges work on all milestones unchanged
    const edges: Edge[] = milestones.flatMap((ms) =>
      ms.dependencies.map((depId) => {
        const isCritical = criticalPath.has(ms.id) && criticalPath.has(depId);
        return {
          id: `e-${depId}-${ms.id}`,
          source: depId,
          target: ms.id,
          type: 'default',
          animated: isCritical,
          style: {
            stroke: isCritical ? '#ef4444' : darkMode ? '#4b5563' : '#94a3b8',
            strokeWidth: isCritical ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isCritical ? '#ef4444' : darkMode ? '#4b5563' : '#94a3b8',
          },
        };
      }),
    );

    return { initialNodes: nodes, initialEdges: edges };
  }, [milestones, selectedMilestoneId, criticalPath, darkMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes/edges when data changes
  useEffect(() => {
    setNodes((prevNodes) => {
      return initialNodes.map((newNode) => {
        const existing = prevNodes.find((n) => n.id === newNode.id);
        if (existing) {
          // Keep user-dragged position, update data + style
          return { ...existing, data: newNode.data, style: newNode.style };
        }
        return newNode;
      });
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (wouldCreateCycle(milestones, connection.source, connection.target)) {
        return;
      }
      addDependency(connection.target, connection.source);
      setEdges((eds) => addEdge(connection, eds));
    },
    [milestones, addDependency, setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectMilestone(node.id);
    },
    [selectMilestone],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const ms = milestones.find((m) => m.id === node.id);
      if (ms) setEditingMilestone(ms);
    },
    [milestones, setEditingMilestone],
  );

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length > 0) {
        selectMilestones(selectedNodes.map((n) => n.id));
      }
    },
    [selectMilestones],
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  if (milestones.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-900'}`}>
        <p className="text-gray-500">{t('network.empty')}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        selectionOnDrag
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode={darkMode ? 'dark' : 'light'}
        defaultEdgeOptions={{
          type: 'default',
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={darkMode ? '#374151' : '#e5e7eb'}
        />
        <Controls
          showInteractive={false}
          className={darkMode ? '[&>button]:!bg-gray-800 [&>button]:!border-gray-600 [&>button]:!text-white' : ''}
        />
        <MiniMap
          nodeColor={(node) => (node.data as any)?.color ?? '#888'}
          style={{
            backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
            border: `1px solid ${darkMode ? '#374151' : '#e2e8f0'}`,
          }}
        />
      </ReactFlow>
    </div>
  );
}
