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
  
  // Define nodes with FIXED positions and disabled dragging - ESSAY WRITER GRAPH
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'START',
      type: 'input',
      data: { label: '▶️ START' },
      position: { x: 300, y: 30 },
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
      id: 'planner',
      data: { label: '📝 Planner' },
      position: { x: 275, y: 130 },
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
      id: 'travel_plan',
      data: { label: '�️ Travel Planning' },
      position: { x: 250, y: 230 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        background: '#a78bfa',
        color: '#fff',
        border: '2px solid #8b5cf6',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'generate',
      data: { label: '✍️ Generator' },
      position: { x: 260, y: 330 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        background: '#34d399',
        color: '#fff',
        border: '2px solid #10b981',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'reflect',
      data: { label: '👨‍🏫 Critic' },
      position: { x: 50, y: 430 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: '#fb923c',
        color: '#fff',
        border: '2px solid #f97316',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'travel_critique',
      data: { label: '🔍 Travel Planning Critique' },
      position: { x: 200, y: 530 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: '#f472b6',
        color: '#fff',
        border: '2px solid #ec4899',
        borderRadius: '8px',
        padding: '15px 25px',
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
    },
    {
      id: 'END',
      type: 'output',
      data: { label: '⬛ END' },
      position: { x: 300, y: 640 },
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

  // Define edges for ESSAY WRITER GRAPH
  const initialEdges: Edge[] = useMemo(() => [
    {
      id: 'e-start-planner',
      source: 'START',
      target: 'planner',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-planner-travel_plan',
      source: 'planner',
      target: 'travel_plan',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-travel_plan-generate',
      source: 'travel_plan',
      target: 'generate',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-generate-reflect',
      source: 'generate',
      target: 'reflect',
      type: 'smoothstep',
      label: 'needs revision',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fontSize: 12, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-reflect-travel_critique',
      source: 'reflect',
      target: 'travel_critique',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-travel_critique-generate',
      source: 'travel_critique',
      target: 'generate',
      type: 'smoothstep',
      label: 'revise',
      animated: false,
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fontSize: 12, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
    },
    {
      id: 'e-generate-end',
      source: 'generate',
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
