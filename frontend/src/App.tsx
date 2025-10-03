import { useState, useEffect, useRef } from 'react';
import { api } from './api/client';
import type { Message, ToolCall, Checkpoint } from './types/api';
import { LiveGraphFlow } from './components/LiveGraphFlow';
import { LiveStatePanel } from './components/LiveStatePanel';
import StateInspector from './components/StateInspector';
import './index.css';

function App() {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useHITL, setUseHITL] = useState(true);
  const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [stateInfo, setStateInfo] = useState<{
    messageCount: number;
    next: string[] | null;
    checkpointId?: string;
  } | null>(null);
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [executingEdge, setExecutingEdge] = useState<{from: string, to: string} | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Refresh handler for StateInspector
  const handleStateRefresh = () => {
    loadState();
  };
  
  // Create new thread
  const createThread = async () => {
    try {
      const response = await api.createThread();
      setCurrentThreadId(response.thread_id);
      setMessages([]);
      setPendingToolCall(null);
      addSystemMessage(`Thread created: ${response.thread_id.slice(0, 8)}...`);
    } catch (error) {
      alert(`Failed to create thread: ${error}`);
    }
  };
  
  // Load thread state
  const loadState = async () => {
    if (!currentThreadId) return;
    
    try {
      const state = await api.getThreadState(currentThreadId);
      setMessages(state.messages);
      setStateInfo({
        messageCount: state.messages.length,
        next: state.next,
        checkpointId: state.checkpoint_id,
      });
      
      // Auto-load checkpoints when state loads
      await loadHistory();
    } catch (error) {
      console.error('Error loading state:', error);
    }
  };
  
  // Time travel to checkpoint
  const travelToCheckpoint = async (checkpointId: string) => {
    if (!currentThreadId) return;
    
    try {
      setLoading(true);
      
      // Get the state at this checkpoint
      const checkpointState = await api.getCheckpointState(currentThreadId, checkpointId);
      
      // Update UI to show messages from that checkpoint
      setMessages(checkpointState.messages);
      setStateInfo({
        messageCount: checkpointState.messages.length,
        next: checkpointState.next,
        checkpointId: checkpointState.checkpoint_id,
      });
      
      addSystemMessage(`⏰ Traveled to checkpoint ${checkpointId.slice(0, 8)}... (${checkpointState.messages.length} messages)`);
    } catch (error) {
      addSystemMessage(`Error traveling to checkpoint: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Resume from checkpoint
  const resumeFromCheckpoint = async (checkpointId: string) => {
    if (!currentThreadId) return;
    
    try {
      setLoading(true);
      addSystemMessage(`▶️ Resuming from checkpoint ${checkpointId.slice(0, 8)}...`);
      
      // Resume execution from this checkpoint
      const response = await api.resumeFromCheckpoint(currentThreadId, checkpointId);
      
      // Reload current state to see the results
      await loadState();
      
      const msgCount = response.messages?.length || 0;
      addSystemMessage(`✅ Resumed successfully - ${msgCount} messages in final state`);
    } catch (error) {
      addSystemMessage(`Error resuming from checkpoint: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Load checkpoint history
  const loadHistory = async () => {
    if (!currentThreadId) return;
    
    try {
      const history = await api.getThreadHistory(currentThreadId);
      setCheckpoints(history.checkpoints);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };
  
  // Send message
  const sendMessage = async () => {
    if (!currentThreadId || !messageInput.trim()) {
      if (!currentThreadId) {
        alert('Please create or select a thread first');
      }
      return;
    }
    
    const message = messageInput.trim();
    setMessageInput('');
    setLoading(true);
    
    // Add user message immediately
    setMessages(prev => [...prev, {
      type: 'HumanMessage',
      content: message,
    }]);
    
    try {
      // Visual feedback: agent is thinking
      setCurrentNode('agent');
      setExecutingEdge({from: 'START', to: 'agent'});
      
      const response = await api.invokeAgent({
        thread_id: currentThreadId,
        message,
        use_hitl: useHITL,
      });
      
      if (response.status === 'interrupted') {
        // Show approval dialog - visual feedback on tools node
        setCurrentNode('tools');
        setExecutingEdge({from: 'agent', to: 'tools'});
        if (response.tool_calls && response.tool_calls.length > 0) {
          setPendingToolCall(response.tool_calls[0]);
        }
        // Load checkpoints to show current state
        await loadHistory();
      } else if (response.status === 'completed') {
        // Reload state to get all messages
        setCurrentNode(null);
        setExecutingEdge(null);
        await loadState(); // This now auto-loads checkpoints
      }
    } catch (error) {
      addSystemMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Approve or reject tool call
  const handleToolApproval = async (approved: boolean) => {
    if (!currentThreadId) return;
    
    setPendingToolCall(null);
    addSystemMessage(approved ? '✅ Tool call approved' : '❌ Tool call rejected');
    setLoading(true);
    
    try {
      if (approved) {
        // Visual: executing tools
        setCurrentNode('tools');
        setExecutingEdge({from: 'agent', to: 'tools'});
      }
      
      await api.resumeAgent({
        thread_id: currentThreadId,
        approved,
      });
      
      // Visual: back to agent after tool execution
      if (approved) {
        setExecutingEdge({from: 'tools', to: 'agent'});
        await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for visual feedback
      }
      
      // Reload state to get updated messages
      setCurrentNode(null);
      setExecutingEdge(null);
      await loadState(); // This now auto-loads checkpoints
    } catch (error) {
      addSystemMessage(`Error: ${error}`);
      setCurrentNode(null);
      setExecutingEdge(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Add system message
  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      type: 'SystemMessage',
      content,
    }]);
  };
  
  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <div className="container">
      <header>
        <h1>🎮 LangGraph Playground - Live Execution Monitor</h1>
        <p>Real-time graph state visualization with human-in-the-loop workflows</p>
      </header>
      
      <div className="main-content">
        {/* Left Panel: Thread Management & Live State */}
        <div className="panel left-panel">
          <h2>📝 Controls</h2>
          <button onClick={createThread}>➕ New Thread</button>
          <button onClick={loadState}>🔄 Refresh State</button>
          
          {currentThreadId && (
            <div className="thread-info">
              <div className="info-label">Current Thread</div>
              <div className="thread-id">{currentThreadId}</div>
            </div>
          )}
          
          <div className="hitl-control">
            <label>
              <input
                type="checkbox"
                checked={useHITL}
                onChange={(e) => setUseHITL(e.target.checked)}
              />
              {' '}Use Human-in-the-Loop
            </label>
          </div>
          
          {/* Live State Panel */}
          <LiveStatePanel
            currentNode={currentNode}
            nextNodes={stateInfo?.next || null}
            messageCount={messages.length}
            checkpointId={stateInfo?.checkpointId}
            status={pendingToolCall ? 'Waiting' : currentThreadId ? 'Active' : 'Inactive'}
          />
          
          <h3 style={{ marginTop: '20px', fontSize: '1em' }}>⏱️ Time Travel</h3>
          <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '10px' }}>
            {checkpoints.length > 0 ? `${checkpoints.length} checkpoint${checkpoints.length !== 1 ? 's' : ''} available` : 'Checkpoints will appear here'}
          </div>
          
          <div className="checkpoint-list">
            {checkpoints.length === 0 ? (
              <div style={{ padding: '10px', color: '#666', fontSize: '0.85em' }}>No checkpoints yet</div>
            ) : (
              checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.index}
                  className="checkpoint-item"
                >
                  <div><strong>#{checkpoint.index}</strong> ({checkpoint.messages_count} msgs)</div>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <button
                      onClick={() => checkpoint.checkpoint_id && travelToCheckpoint(checkpoint.checkpoint_id)}
                      disabled={loading || !checkpoint.checkpoint_id}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#764ba2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      ⏰ View
                    </button>
                    <button
                      onClick={() => checkpoint.checkpoint_id && resumeFromCheckpoint(checkpoint.checkpoint_id)}
                      disabled={loading || !checkpoint.checkpoint_id}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      ▶️ Resume
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Center Panel: Live Graph Visualization */}
        <div className="panel center-panel" style={{ padding: 0 }}>
          <LiveGraphFlow 
            currentNode={currentNode}
            nextNodes={stateInfo?.next || null}
            executingEdge={executingEdge}
            messageCount={messages.length}
            checkpointId={stateInfo?.checkpointId}
          />
        </div>
        
        {/* Right Panel: Chat Interface */}
        <div className="panel right-panel">
          <h2>Conversation</h2>
          
          {/* Chat Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="message system">
                <div className="message-label">System</div>
                Create a thread to start chatting!
              </div>
            )}
            
            {messages.map((msg, idx) => {
              let className = 'message ';
              let label = '';
              
              if (msg.type === 'HumanMessage') {
                className += 'user';
                label = 'You';
              } else if (msg.type === 'AIMessage') {
                className += 'ai';
                label = 'Agent';
              } else if (msg.type === 'ToolMessage') {
                className += 'tool';
                label = 'Tool Result';
              } else {
                className += 'system';
                label = 'System';
              }
              
              // Skip AI messages with no content (tool call only)
              if (msg.type === 'AIMessage' && !msg.content) {
                return null;
              }
              
              return (
                <div key={idx} className={className}>
                  <div className="message-label">{label}</div>
                  <div>{msg.content}</div>
                </div>
              );
            })}
            
            {/* Show approval inline with messages when tool call is pending */}
            {pendingToolCall && (
              <div className="message approval-message">
                <div className="message-label">🛑 Approval Required</div>
                <div className="tool-call-info">
                  <div><strong>Tool:</strong> {pendingToolCall.name}</div>
                  <div><strong>Arguments:</strong></div>
                  <pre>{JSON.stringify(pendingToolCall.args, null, 2)}</pre>
                </div>
                <div className="button-group">
                  <button className="success" onClick={() => handleToolApproval(true)}>
                    ✅ Approve
                  </button>
                  <button className="danger" onClick={() => handleToolApproval(false)}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            )}
            
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Agent thinking...</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <textarea
            placeholder="Type your message..."
            rows={3}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          
          <button onClick={sendMessage} disabled={loading || !currentThreadId}>
            🚀 Send Message
          </button>
        </div>

        {/* Fourth Panel: State Inspector */}
        <div className="panel state-inspector-panel">
          <StateInspector 
            threadId={currentThreadId}
            onRefresh={handleStateRefresh}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
