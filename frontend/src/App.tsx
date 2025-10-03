import { useState, useEffect, useRef } from 'react';
import { api } from './api/client';
import type { Message, ToolCall, Checkpoint } from './types/api';
import { LiveGraphFlow } from './components/LiveGraphFlow';
import { LiveStatePanel } from './components/LiveStatePanel';
import StateInspector from './components/StateInspector';
import { PromptEditor } from './components/PromptEditor';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'state' | 'prompts'>('chat');
  
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
      console.log('📊 [loadState] Loading state for thread:', currentThreadId);
      const state = await api.getThreadState(currentThreadId);
      console.log('📊 [loadState] Received state:', {
        messageCount: state.messages.length,
        next: state.next,
        checkpointId: state.checkpoint_id
      });
      setMessages(state.messages);
      setStateInfo({
        messageCount: state.messages.length,
        next: state.next,
        checkpointId: state.checkpoint_id,
      });
      
      // Auto-load checkpoints when state loads
      await loadHistory();
    } catch (error) {
      console.error('❌ [loadState] Error loading state:', error);
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
      console.log('📜 [loadHistory] Loading checkpoint history for thread:', currentThreadId);
      const history = await api.getThreadHistory(currentThreadId);
      console.log('📜 [loadHistory] Received history:', history.total, 'checkpoints');
      setCheckpoints(history.checkpoints);
    } catch (error) {
      console.error('❌ [loadHistory] Error loading history:', error);
    }
  };
  
  // Send message
    const sendMessage = async () => {
    if (!currentThreadId) {
      alert('Please create or select a thread first');
      return;
    }
    
    // Check if we should continue an interrupted graph or start new
    const shouldContinue = stateInfo?.next && stateInfo.next.length > 0;
    
    console.log('🔵 [sendMessage] Starting sendMessage function');
    console.log('🔵 [sendMessage] currentThreadId:', currentThreadId);
    console.log('🔵 [sendMessage] messageInput:', messageInput);
    console.log('🔵 [sendMessage] shouldContinue:', shouldContinue);
    console.log('🔵 [sendMessage] stateInfo.next:', stateInfo?.next);
    console.log('🔵 [sendMessage] useHITL:', useHITL);
    
    if (!shouldContinue && !messageInput.trim()) {
      // Need a message to start new graph
      console.log('⚠️ [sendMessage] No message and not continuing - returning');
      return;
    }
    
    const message = messageInput.trim();
    setMessageInput('');
    setLoading(true);
    
    // Add user message only if starting new (not continuing)
    if (!shouldContinue && message) {
      console.log('📤 [sendMessage] Adding user message to chat:', message);
      setMessages(prev => [...prev, {
        type: 'HumanMessage',
        content: message,
      }]);
    } else if (shouldContinue) {
      // Continuing interrupted graph
      console.log('▶️ [sendMessage] Continuing interrupted graph from node:', stateInfo?.next?.[0]);
      addSystemMessage('▶️ Continuing graph execution...');
    }
    
    try {
      // Visual feedback: agent is thinking
      const nextNode = (shouldContinue && stateInfo?.next) ? stateInfo.next[0] : 'planner';
      console.log('🎨 [sendMessage] Setting currentNode to:', nextNode);
      setCurrentNode(nextNode);
      setExecutingEdge(shouldContinue ? null : {from: 'START', to: 'planner'});
      
      console.log('🌐 [sendMessage] Calling api.invokeAgent with:', {
        thread_id: currentThreadId,
        message: shouldContinue ? '(empty - continuing)' : message,
        use_hitl: useHITL
      });
      
      const response = await api.invokeAgent({
        thread_id: currentThreadId,
        message: shouldContinue ? '' : message,  // Empty message when continuing
        use_hitl: useHITL,
      });
      
      console.log('📨 [sendMessage] Received response:', response);
      console.log('📊 [sendMessage] Response status:', response.status);
      
      if (response.status === 'interrupted') {
        // Graph interrupted at a node (HITL checkpoint)
        const nextNode = response.next && response.next.length > 0 ? response.next[0] : 'unknown';
        console.log('⏸️ [sendMessage] Graph INTERRUPTED at node:', nextNode);
        console.log('📋 [sendMessage] Current state:', (response as any).current_state);
        setCurrentNode(nextNode);
        setExecutingEdge(null);
        
        // Show what node we're waiting at
        addSystemMessage(`⏸️ Graph paused at node: "${nextNode}". Click "Send Message" again to continue.`);
        
        // Load checkpoints to show current state
        await loadHistory();
        await loadState();
      } else if (response.status === 'completed') {
        // Reload state to get all messages
        console.log('✅ [sendMessage] Graph COMPLETED');
        console.log('📄 [sendMessage] Final result:', (response as any).result);
        setCurrentNode(null);
        setExecutingEdge(null);
        await loadState(); // This now auto-loads checkpoints
      }
    } catch (error) {
      console.error('❌ [sendMessage] Error occurred:', error);
      addSystemMessage(`Error: ${error}`);
    } finally {
      console.log('🏁 [sendMessage] Setting loading to false');
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
        <h1>🎮 Essay Writer - LangGraph Playground</h1>
        <p>Multi-node essay writing agent with editable prompts</p>
      </header>
      
      <div className="main-content">
        {/* Thread Controls Bar */}
        <div className="thread-controls">
          <button onClick={createThread} className="btn-primary">➕ New Thread</button>
          <button onClick={loadState} className="btn-secondary">🔄 Refresh</button>
          
          {currentThreadId && (
            <div className="thread-badge">
              <span className="thread-label">Thread:</span>
              <span className="thread-id">{currentThreadId.slice(0, 8)}...</span>
            </div>
          )}
          
          <label className="hitl-toggle">
            <input
              type="checkbox"
              checked={useHITL}
              onChange={(e) => setUseHITL(e.target.checked)}
            />
            <span>Human-in-the-Loop</span>
          </label>
          
          {stateInfo && (
            <div className={`status-badge ${pendingToolCall ? 'waiting' : loading ? 'processing' : 'ready'}`}>
              {pendingToolCall ? '⏸️ Waiting' : loading ? '⏳ Processing' : '✅ Ready'}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat & Essay
          </button>
          <button 
            className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            📊 Graph Flow
          </button>
          <button 
            className={`tab ${activeTab === 'state' ? 'active' : ''}`}
            onClick={() => setActiveTab('state')}
          >
            🔍 State Inspector
          </button>
          <button 
            className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            🎨 Edit Prompts
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="chat-panel">
              {/* Chat Messages */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="message system">
                    <div className="message-label">System</div>
                    Create a thread to start chatting!
                  </div>
                )}
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
              
              {/* Chat Input */}
              <div className="chat-input">
                <textarea
                  placeholder="Type your message or essay topic..."
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
            </div>
          )}

          {/* GRAPH TAB */}
          {activeTab === 'graph' && (
            <div className="graph-panel">
              <LiveGraphFlow 
                currentNode={currentNode}
                nextNodes={stateInfo?.next || null}
                executingEdge={executingEdge}
                messageCount={messages.length}
                checkpointId={stateInfo?.checkpointId}
              />
              
              {/* Live State & Checkpoints Sidebar */}
              <div className="graph-sidebar">
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
            </div>
          )}

          {/* STATE TAB */}
          {activeTab === 'state' && (
            <div className="state-panel">
              <StateInspector 
                threadId={currentThreadId}
                onRefresh={handleStateRefresh}
              />
            </div>
          )}

          {/* PROMPTS TAB */}
          {activeTab === 'prompts' && (
            <div className="prompts-panel">
              <PromptEditor
                threadId={currentThreadId}
                onPromptUpdate={handleStateRefresh}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

