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
  
  // Define nodes with FIXED positions - ESSAY WRITER GRAPH
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
      data: { label: '🗺️ Travel Planning\n🔍 Web Search' },
      position: { x: 230, y: 240 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        background: '#fbbf24',
        color: '#000',
        border: '3px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'center',
        whiteSpace: 'pre-line' as const,
      },
    },
    {
      id: 'generate',
      data: { label: '✍️ Generator' },
      position: { x: 260, y: 360 },
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
      position: { x: 50, y: 470 },
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
      data: { label: '🔍 Travel Planning Critique\n🔍 Web Search' },
      position: { x: 180, y: 580 },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: '#fbbf24',
        color: '#000',
        border: '3px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'center',
        whiteSpace: 'pre-line' as const,
      },
    },
    {
      id: 'END',
      type: 'output',
      data: { label: '⬛ END' },
      position: { x: 300, y: 690 },
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
            boxShadow: '0 0 20px 5px rgba(251, 191, 36, 0.8)',
            border: '4px solid #fbbf24',
            transform: 'scale(1.05)',
          };
        } else if (isNext) {
          style = {
            ...style,
            border: '3px dashed #10b981',
            boxShadow: '0 0 15px 3px rgba(16, 185, 129, 0.5)',
          };
        }

        return {
          ...node,
          style,
        };
      })
    );
  }, [currentNode, nextNodes, initialNodes, setNodes]);

  // Update edges based on executing edge
  useEffect(() => {
    if (executingEdge) {
      setEdges((eds) =>
        eds.map((edge) => {
          const isExecuting = edge.source === executingEdge.from && edge.target === executingEdge.to;
          
          return {
            ...edge,
            animated: isExecuting,
            style: isExecuting 
              ? { ...edge.style, stroke: '#fbbf24', strokeWidth: 4 }
              : edge.style,
          };
        })
      );
    }
  }, [executingEdge, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={true}
        panOnScroll={false}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            if (node.id === currentNode) return '#fbbf24';
            if (nextNodes?.includes(node.id)) return '#10b981';
            return '#888';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Status Badge */}
      <div className="graph-status-badge">
        <div className="status-item">
          <span className="status-label">Current Node:</span>
          <span className="status-value">{currentNode || 'None'}</span>
        </div>
        {nextNodes && nextNodes.length > 0 && (
          <div className="status-item">
            <span className="status-label">Next:</span>
            <span className="status-value">{nextNodes.join(', ')}</span>
          </div>
        )}
        <div className="status-item">
          <span className="status-label">Messages:</span>
          <span className="status-value">{messageCount}</span>
        </div>
        {checkpointId && (
          <div className="status-item">
            <span className="status-label">Checkpoint:</span>
            <span className="status-value">{checkpointId.slice(0, 8)}...</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="graph-legend">
        <h4>Legend</h4>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#60a5fa' }}></div>
          <span>LLM Node (AI thinking)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#fbbf24', border: '2px solid #f59e0b' }}></div>
          <span>Tool Node (Web Search)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#34d399' }}></div>
          <span>Generator (Essay Writing)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#fb923c' }}></div>
          <span>Critic (Feedback)</span>
        </div>
      </div>
    </div>
  );
}
