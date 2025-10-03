import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './LiveGraphFlow.css';

interface LiveGraphFlowProps {
  currentNode?: string | null;
  nextNodes?: string[] | null;
  executingEdge?: {from: string, to: string} | null;
  messageCount?: number;
  checkpointId?: string;
}

export function LiveGraphFlow({ 
  currentNode, 
  nextNodes, 
  executingEdge,
  messageCount = 0,
  checkpointId 
}: LiveGraphFlowProps) {
  
  // Define nodes with FIXED positions and disabled dragging
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'START',
      type: 'input',
      data: { label: '▶️ START' },
      position: { x: 300, y: 50 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      style: {
        background: '#4ade80',
        color: '#fff',
        border: '2px solid #22c55e',
        borderRadius: '8px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 'bold',
      },
    },
    {
      id: 'agent',
      data: { label: '🤖 Agent' },
      position: { x: 275, y: 180 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        background: '#60a5fa',
        color: '#fff',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'tools',
      data: { label: '🔧 Tools' },
      position: { x: 275, y: 340 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Left,
      targetPosition: Position.Bottom,
      style: {
        background: '#fbbf24',
        color: '#000',
        border: '2px solid #f59e0b',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'END',
      type: 'output',
      data: { label: '⬛ END' },
      position: { x: 300, y: 480 },
      draggable: false,
      selectable: false,
      targetPosition: Position.Top,
      style: {
        background: '#f87171',
        color: '#fff',
        border: '2px solid #ef4444',
        borderRadius: '8px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 'bold',
      },
    },
  ], []);

  // Define edges with smooth curves for the loop
  const initialEdges: Edge[] = useMemo(() => [
    {
      id: 'e-start-agent',
      source: 'START',
      target: 'agent',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-agent-tools',
      source: 'agent',
      target: 'tools',
      type: 'smoothstep',
      label: 'needs tools',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fontSize: 12, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-tools-agent',
      source: 'tools',
      target: 'agent',
      type: 'smoothstep',
      label: 'loop back',
      animated: false,
      // Curve to the left to show the loop clearly
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fontSize: 12, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
      sourceHandle: 'left',
      targetHandle: 'left',
    },
    {
      id: 'e-agent-end',
      source: 'agent',
      target: 'END',
      type: 'smoothstep',
      label: 'complete',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fontSize: 12, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
  ], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes based on current execution state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const isActive = node.id === currentNode;
        const isNext = nextNodes?.includes(node.id);
        
        let style = { ...initialNodes.find(n => n.id === node.id)?.style };
        
        if (isActive) {
          style = {
            ...style,
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.8)',
            border: '3px solid #f59e0b',
          };
        } else if (isNext) {
          style = {
            ...style,
            boxShadow: '0 0 20px rgba(96, 165, 250, 0.5)',
            border: '2px dashed #60a5fa',
          };
        }
        
        return {
          ...node,
          style,
          className: isActive ? 'active-node' : isNext ? 'next-node' : '',
        };
      })
    );
  }, [currentNode, nextNodes, setNodes, initialNodes]);

  // Update edges based on executing edge
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        const isExecuting = 
          executingEdge && 
          edge.source === executingEdge.from && 
          edge.target === executingEdge.to;
        
        if (isExecuting) {
          return {
            ...edge,
            animated: true,
            style: { stroke: '#f59e0b', strokeWidth: 3 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
          };
        }
        
        return {
          ...edge,
          animated: false,
          style: { stroke: '#888', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
        };
      })
    );
  }, [executingEdge, setEdges]);

  return (
    <div className="live-graph-container">
      <div className="graph-header">
        <h2>🔀 Live Graph Execution</h2>
        <div className="graph-stats">
          <div className="stat-item">
            <span className="stat-label">Current:</span>
            <span className="stat-value">{currentNode || 'None'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Next:</span>
            <span className="stat-value">
              {nextNodes && nextNodes.length > 0 ? nextNodes.join(', ') : 'None'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Messages:</span>
            <span className="stat-value">{messageCount}</span>
          </div>
          {checkpointId && (
            <div className="stat-item">
              <span className="stat-label">Checkpoint:</span>
              <span className="stat-value">{checkpointId.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="graph-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false,
          }}
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.id === 'START') return '#4ade80';
              if (node.id === 'agent') return '#60a5fa';
              if (node.id === 'tools') return '#fbbf24';
              if (node.id === 'END') return '#f87171';
              return '#ccc';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
      </div>
      
      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-indicator active-indicator"></div>
          <span>Currently Executing</span>
        </div>
        <div className="legend-item">
          <div className="legend-indicator next-indicator"></div>
          <span>Next Node(s)</span>
        </div>
        <div className="legend-item">
          <div className="legend-indicator inactive-indicator"></div>
          <span>Inactive</span>
        </div>
      </div>
    </div>
  );
}
