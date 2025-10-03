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

  const isNodeActive = (nodeId: string) => currentNode === nodeId;
  const isNodeNext = (nodeId: string) => nextNodes?.includes(nodeId) || false;
  const isEdgeActive = (from: string, to: string) => 
    executingEdge?.from === from && executingEdge?.to === to;

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
      
      {/* Simple Static Graph */}
      <div className="static-graph">
        {/* START Node */}
        <div className={`graph-node start-node ${isNodeActive('START') ? 'active' : ''} ${isNodeNext('START') ? 'next' : ''}`}>
          <span className="node-icon">▶️</span>
          <span className="node-label">START</span>
        </div>
        
        {/* Edge: START -> agent */}
        <div className={`graph-edge vertical ${isEdgeActive('START', 'agent') ? 'active' : ''}`}>
          <div className="edge-line"></div>
          <div className="edge-arrow">↓</div>
        </div>
        
        {/* Agent Node */}
        <div className={`graph-node agent-node ${isNodeActive('agent') ? 'active' : ''} ${isNodeNext('agent') ? 'next' : ''}`}>
          <span className="node-icon">🤖</span>
          <span className="node-label">agent</span>
          <span className="node-sublabel">LLM Processing</span>
        </div>
        
        {/* Branching Section */}
        <div className="graph-branch">
          <div className="branch-left">
            <div className={`graph-edge vertical ${isEdgeActive('agent', 'tools') ? 'active' : ''}`}>
              <div className="edge-line"></div>
              <div className="edge-arrow">↓</div>
              <div className="edge-label">tools needed</div>
            </div>
            
            {/* Tools Node */}
            <div className={`graph-node tools-node ${isNodeActive('tools') ? 'active' : ''} ${isNodeNext('tools') ? 'next' : ''}`}>
              <span className="node-icon">🔧</span>
              <span className="node-label">tools</span>
              <span className="node-sublabel">HITL Approval</span>
            </div>
            
            <div className={`graph-edge vertical ${isEdgeActive('tools', 'agent') ? 'active' : ''}`}>
              <div className="edge-line"></div>
              <div className="edge-arrow">↓</div>
              <div className="edge-label">after execution</div>
            </div>
          </div>
          
          <div className="branch-right">
            <div className={`graph-edge diagonal ${isEdgeActive('agent', 'END') ? 'active' : ''}`}>
              <div className="edge-label">complete</div>
              <div className="edge-arrow">↘</div>
            </div>
          </div>
        </div>
        
        {/* END Node */}
        <div className={`graph-node end-node ${isNodeActive('END') ? 'active' : ''} ${isNodeNext('END') ? 'next' : ''}`}>
          <span className="node-icon">⬛</span>
          <span className="node-label">END</span>
        </div>
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
