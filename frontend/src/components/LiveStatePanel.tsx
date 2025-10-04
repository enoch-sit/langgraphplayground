import { useEffect, useState } from 'react';
import './LiveStatePanel.css';

interface LiveStatePanelProps {
  currentNode?: string | null;
  nextNodes?: string[] | null;
  messageCount?: number;
  checkpointId?: string;
  status?: string;
}

interface ExecutionStep {
  timestamp: string;
  node: string;
  action: string;
}

export function LiveStatePanel({
  currentNode,
  nextNodes,
  messageCount = 0,
  checkpointId,
  status = 'Inactive'
}: LiveStatePanelProps) {
  const [executionHistory, setExecutionHistory] = useState<ExecutionStep[]>([]);

  // Track execution history
  useEffect(() => {
    if (currentNode) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      
      setExecutionHistory(prev => {
        const newStep: ExecutionStep = {
          timestamp,
          node: currentNode,
          action: currentNode === 'START' ? 'Started' : 
                  currentNode === 'END' ? 'Completed' :
                  currentNode === 'agent' ? 'Processing' :
                  currentNode === 'tools' ? 'Awaiting Approval' :
                  currentNode === 'planner' ? 'Planning Trip' :
                  currentNode === 'travel_plan' ? 'Researching' :
                  currentNode === 'generate' ? 'Generating' :
                  currentNode === 'reflect' ? 'Reviewing' :
                  currentNode === 'travel_critique' ? 'Additional Research' :
                  'Executing'
        };
        
        // Keep last 15 entries
        const newHistory = [...prev, newStep];
        return newHistory.slice(-15);
      });
    }
  }, [currentNode]);

  const getStatusColor = () => {
    if (status === 'Waiting') return '#fbbf24';
    if (status === 'Active') return '#4ade80';
    return '#94a3b8';
  };

  const getNodeEmoji = (node: string) => {
    switch(node) {
      case 'START': return '▶️';
      case 'agent': return '🤖';
      case 'tools': return '🔧';
      case 'planner': return '📝';
      case 'travel_plan': return '🗺️';
      case 'generate': return '✍️';
      case 'reflect': return '👨‍🏫';
      case 'travel_critique': return '🔍';
      case 'END': return '⬛';
      default: return '●';
    }
  };

  return (
    <div className="live-state-panel">
      <h3>📊 Real-Time State</h3>
      
      {/* Current Execution Status */}
      <div className="state-card">
        <div className="state-card-header">
          <span className="state-card-title">Execution Status</span>
          <span 
            className="status-indicator" 
            style={{ backgroundColor: getStatusColor() }}
          >
            {status}
          </span>
        </div>
        
        <div className="state-details">
          <div className="state-row">
            <span className="state-key">Current Node:</span>
            <span className="state-value current-node">
              {currentNode ? (
                <>
                  {getNodeEmoji(currentNode)} {currentNode}
                </>
              ) : (
                <span className="muted">None</span>
              )}
            </span>
          </div>
          
          <div className="state-row">
            <span className="state-key">Next Node(s):</span>
            <span className="state-value">
              {nextNodes && nextNodes.length > 0 ? (
                nextNodes.map((node, idx) => (
                  <span key={idx} className="next-node-badge">
                    {getNodeEmoji(node)} {node}
                  </span>
                ))
              ) : (
                <span className="muted">None</span>
              )}
            </span>
          </div>
          
          <div className="state-row">
            <span className="state-key">Messages:</span>
            <span className="state-value message-count">{messageCount}</span>
          </div>
          
          {checkpointId && (
            <div className="state-row">
              <span className="state-key">Checkpoint:</span>
              <span className="state-value checkpoint-id">
                {checkpointId.slice(0, 12)}...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Execution History */}
      <div className="state-card">
        <div className="state-card-header">
          <span className="state-card-title">Execution History</span>
          <span className="history-count">{executionHistory.length}</span>
        </div>
        
        <div className="execution-history">
          {executionHistory.length === 0 ? (
            <div className="empty-history">
              No execution steps yet
            </div>
          ) : (
            <div className="history-list">
              {[...executionHistory].reverse().map((step, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-time">{step.timestamp}</div>
                  <div className="history-content">
                    <span className="history-node">
                      {getNodeEmoji(step.node)} {step.node}
                    </span>
                    <span className="history-action">{step.action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph Legend */}
      <div className="state-card">
        <div className="state-card-header">
          <span className="state-card-title">Trip Planner Node Legend</span>
        </div>
        
        <div className="node-legend">
          <div className="legend-row">
            <span className="legend-emoji">▶️</span>
            <span className="legend-name">START</span>
            <span className="legend-desc">Entry point</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">📝</span>
            <span className="legend-name">planner</span>
            <span className="legend-desc">Creates trip outline</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">🗺️</span>
            <span className="legend-name">travel_plan</span>
            <span className="legend-desc">Researches destination</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">✍️</span>
            <span className="legend-name">generate</span>
            <span className="legend-desc">Generates itinerary</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">👨‍🏫</span>
            <span className="legend-name">reflect</span>
            <span className="legend-desc">Reviews & critiques</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">🔍</span>
            <span className="legend-name">travel_critique</span>
            <span className="legend-desc">Additional research</span>
          </div>
          <div className="legend-row">
            <span className="legend-emoji">⬛</span>
            <span className="legend-name">END</span>
            <span className="legend-desc">Completion</span>
          </div>
        </div>
      </div>
    </div>
  );
}
