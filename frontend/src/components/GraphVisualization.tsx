import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { GraphNodesResponse, GraphNode } from '../types/api';
import './GraphVisualization.css';

interface GraphVisualizationProps {
  currentNode?: string | null;
  executingEdge?: {from: string, to: string} | null;
}

export function GraphVisualization({ currentNode, executingEdge }: GraphVisualizationProps) {
  const [graphData, setGraphData] = useState<GraphNodesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await api.getGraphNodes();
      setGraphData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (type: GraphNode['type']) => {
    switch (type) {
      case 'entry':
        return '#4ade80'; // green
      case 'exit':
        return '#f87171'; // red
      case 'function':
        return '#60a5fa'; // blue
      case 'interrupt':
        return '#fbbf24'; // yellow
      default:
        return '#9ca3af'; // gray
    }
  };

  const getNodeIcon = (type: GraphNode['type']) => {
    switch (type) {
      case 'entry':
        return '▶';
      case 'exit':
        return '■';
      case 'function':
        return '⚙';
      case 'interrupt':
        return '⏸';
      default:
        return '●';
    }
  };

  if (loading) {
    return (
      <div className="graph-visualization loading">
        <div className="spinner">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-visualization error">
        <p>Error: {error}</p>
        <button onClick={loadGraphData}>Retry</button>
      </div>
    );
  }

  if (!graphData) {
    return null;
  }

  return (
    <div className="graph-visualization">
      <h3>Visual Graph</h3>
      
      {/* Simple Visual Graph Representation */}
      <div className="graph-flow-visual">
        <div className={`flow-node ${currentNode === 'START' ? 'active' : ''}`}>
          <span className="node-icon">▶</span>
          <span className="node-name">START</span>
        </div>
        
        <div className={`flow-edge ${executingEdge?.from === 'START' && executingEdge?.to === 'agent' ? 'active' : ''}`}>
          ↓
        </div>
        
        <div className={`flow-node ${currentNode === 'agent' ? 'active' : ''}`} style={{ borderLeftColor: '#60a5fa' }}>
          <span className="node-icon">⚙</span>
          <span className="node-name">agent</span>
        </div>
        
        <div className="flow-branch">
          <div className="branch-path">
            <div className={`flow-edge ${executingEdge?.from === 'agent' && executingEdge?.to === 'tools' ? 'active' : ''}`}>
              ↓ (tools needed)
            </div>
            <div className={`flow-node ${currentNode === 'tools' ? 'active' : ''}`} style={{ borderLeftColor: '#fbbf24' }}>
              <span className="node-icon">🔧</span>
              <span className="node-name">tools</span>
              <span className="node-badge">HITL</span>
            </div>
            <div className={`flow-edge ${executingEdge?.from === 'tools' && executingEdge?.to === 'agent' ? 'active' : ''}`}>
              ↓
            </div>
            <div className="flow-merge">↓</div>
          </div>
          
          <div className="branch-path">
            <div className={`flow-edge ${executingEdge?.from === 'agent' && executingEdge?.to === 'END' ? 'active' : ''}`}>
              → (no tools)
            </div>
            <div className="flow-merge">→</div>
          </div>
        </div>
        
        <div className={`flow-node ${currentNode === 'END' ? 'active' : ''}`} style={{ borderLeftColor: '#f87171' }}>
          <span className="node-icon">■</span>
          <span className="node-name">END</span>
        </div>
      </div>
      
      <div className="graph-info">
        <div className="info-item">
          <strong>Entry Point:</strong> {graphData.entry_point}
        </div>
        <div className="info-item">
          <strong>Checkpointer:</strong> {graphData.checkpointer}
        </div>
        <div className="info-item">
          <strong>Interrupt Before:</strong> {graphData.interrupt_before.join(', ')}
        </div>
      </div>

      <div className="graph-nodes">
        <h4>Nodes</h4>
        {graphData.nodes.map((node) => (
          <div
            key={node.id}
            className="node-card"
            style={{ borderLeftColor: getNodeColor(node.type) }}
          >
            <div className="node-header">
              <span className="node-icon">{getNodeIcon(node.type)}</span>
              <span className="node-name">{node.name}</span>
              <span className="node-type">{node.type}</span>
            </div>
            <p className="node-description">{node.description}</p>
            <div className="node-details">
              {node.edges_to.length > 0 && (
                <div className="node-detail">
                  <strong>Edges to:</strong> {node.edges_to.join(', ')}
                </div>
              )}
              {node.edges_conditional && (
                <div className="node-detail">
                  <span className="badge">Conditional Routing</span>
                </div>
              )}
              {node.interrupt_before && (
                <div className="node-detail">
                  <span className="badge interrupt">Interrupt Point</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="graph-edges">
        <h4>Edges ({graphData.edges.length})</h4>
        <div className="edges-list">
          {graphData.edges.map((edge, idx) => (
            <div key={idx} className="edge-card">
              <div className="edge-flow">
                <span className="edge-from">{edge.from}</span>
                <span className="edge-arrow">→</span>
                <span className="edge-to">{edge.to}</span>
              </div>
              <p className="edge-description">{edge.description}</p>
              {edge.conditional && (
                <span className="badge conditional">Conditional</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="state-schema">
        <h4>State Schema</h4>
        {Object.entries(graphData.state_schema).map(([key, schema]) => (
          <div key={key} className="schema-field">
            <strong>{key}:</strong> {schema.type}
            {schema.required && <span className="badge required">Required</span>}
            <p>{schema.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
