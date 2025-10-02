import { useState, useEffect, useRef } from 'react';
import { api } from './api/client';
import type { Message, ToolCall, Checkpoint } from './types/api';
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
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
      const response = await api.invokeAgent({
        thread_id: currentThreadId,
        message,
        use_hitl: useHITL,
      });
      
      if (response.status === 'interrupted') {
        // Show approval dialog
        if (response.tool_calls && response.tool_calls.length > 0) {
          setPendingToolCall(response.tool_calls[0]);
        }
      } else if (response.status === 'completed') {
        // Reload state to get all messages
        await loadState();
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
      await api.resumeAgent({
        thread_id: currentThreadId,
        approved,
      });
      
      // Reload state to get updated messages
      await loadState();
    } catch (error) {
      addSystemMessage(`Error: ${error}`);
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
  
  // Format thread ID for display
  const formatThreadId = (id: string) => {
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  };
  
  return (
    <div className="container">
      <header>
        <h1>🎮 LangGraph Playground</h1>
        <p>Explore threads, state, persistence, streaming, and human-in-the-loop workflows</p>
      </header>
      
      <div className="main-content">
        {/* Left Panel: Thread Management */}
        <div className="panel">
          <h2>📝 Threads</h2>
          <button onClick={createThread}>➕ New Thread</button>
          <button onClick={loadState}>🔄 Refresh</button>
          
          <ul className="thread-list">
            {currentThreadId && (
              <li className="thread-item active">
                <div>Thread</div>
                <div className="thread-id">{currentThreadId}</div>
              </li>
            )}
          </ul>
        </div>
        
        {/* Center Panel: Chat Interface */}
        <div className="panel">
          <h2>💬 Conversation</h2>
          
          <div className="state-viewer">
            <div className="state-item">
              <span className="state-label">Thread:</span>
              <span>{currentThreadId ? formatThreadId(currentThreadId) : 'None selected'}</span>
            </div>
            <div className="state-item">
              <span className="state-label">Status:</span>
              <span className={`status-badge ${currentThreadId ? (pendingToolCall ? 'waiting' : 'active') : ''}`}>
                {pendingToolCall ? 'Waiting' : currentThreadId ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          {/* HITL Approval Box */}
          {pendingToolCall && (
            <div className="approval-box">
              <h3>🛑 Human Approval Required</h3>
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
          
          {/* Chat Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="message system">
                <div className="message-label">System</div>
                Create or select a thread to start chatting!
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
            
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Agent thinking...</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div>
            <label>
              <input
                type="checkbox"
                checked={useHITL}
                onChange={(e) => setUseHITL(e.target.checked)}
              />
              {' '}Use Human-in-the-Loop (pause before tools)
            </label>
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
        
        {/* Right Panel: State & Checkpoints */}
        <div className="panel">
          <h2>📊 State & Time Travel</h2>
          <button onClick={loadState} disabled={!currentThreadId}>🔍 View State</button>
          <button onClick={loadHistory} disabled={!currentThreadId}>📜 Load History</button>
          
          {stateInfo && (
            <div className="state-viewer">
              <div className="state-item">
                <span className="state-label">Messages:</span>
                {stateInfo.messageCount}
              </div>
              <div className="state-item">
                <span className="state-label">Next Node:</span>
                {stateInfo.next ? stateInfo.next.join(', ') : 'None (completed)'}
              </div>
              <div className="state-item">
                <span className="state-label">Checkpoint:</span>
                {stateInfo.checkpointId ? `${stateInfo.checkpointId.slice(0, 8)}...` : 'None'}
              </div>
            </div>
          )}
          
          <h3 style={{ marginTop: '20px', color: '#667eea', fontSize: '1em' }}>Checkpoints</h3>
          <ul className="checkpoint-list">
            {checkpoints.length === 0 ? (
              <li style={{ padding: '10px', color: '#666' }}>No checkpoints yet</li>
            ) : (
              checkpoints.map((checkpoint) => (
                <li
                  key={checkpoint.index}
                  className="checkpoint-item"
                  style={{ cursor: 'pointer' }}
                >
                  <div><strong>Checkpoint {checkpoint.index}</strong></div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {checkpoint.messages_count} messages
                  </div>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <button
                      onClick={() => checkpoint.checkpoint_id && travelToCheckpoint(checkpoint.checkpoint_id)}
                      disabled={loading || !checkpoint.checkpoint_id}
                      style={{
                        padding: '3px 8px',
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
                        padding: '3px 8px',
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
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
