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
  const [showGuide, setShowGuide] = useState(true);
  
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
      console.log(`✅ Thread created: ${response.thread_id}`);
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
      
      console.log(`⏰ Traveled to checkpoint: ${checkpointId}`);
    } catch (error) {
      console.error(`Error traveling to checkpoint:`, error);
      setMessages(prev => [...prev, {
        type: 'SystemMessage',
        content: `Error: ${error}`,
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  // Resume from checkpoint
  const resumeFromCheckpoint = async (checkpointId: string) => {
    if (!currentThreadId) return;
    
    try {
      setLoading(true);
      console.log(`▶️ Resuming from checkpoint: ${checkpointId}`);
      
      // Resume execution from this checkpoint
      await api.resumeFromCheckpoint(currentThreadId, checkpointId);
      
      // Reload current state to see the results
      await loadState();
      
      console.log(`✅ Resumed successfully`);
    } catch (error) {
      console.error(`Error resuming:`, error);
      setMessages(prev => [...prev, {
        type: 'SystemMessage',
        content: `Error: ${error}`,
      }]);
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
    }
    
    try {
      // Use streaming for real-time updates
      console.log('� [sendMessage] Starting streaming execution');
      
      for await (const event of api.streamAgent({
        thread_id: currentThreadId,
        message: shouldContinue ? '' : message,
        use_hitl: useHITL,
      })) {
        console.log('📨 [sendMessage] Stream event:', event);
        
        if (event.event === 'node') {
          // Update visual feedback for graph
          console.log(`⚙️ [sendMessage] Executing node: ${event.node}`);
          setCurrentNode(event.node);
          
          // Add the message to the chat if present
          if (event.data.message) {
            console.log('💬 [sendMessage] Adding streamed message:', event.data.message);
            setMessages(prev => [...prev, {
              type: event.data.message!.type as any,
              content: event.data.message!.content,
            }]);
          }
          
        } else if (event.event === 'interrupt') {
          // Graph interrupted at HITL checkpoint
          const nextNode = event.next && event.next.length > 0 ? event.next[0] : 'unknown';
          console.log('⏸️ [sendMessage] Graph INTERRUPTED at node:', nextNode);
          setCurrentNode(nextNode);
          setExecutingEdge(null);
          
        } else if (event.event === 'complete') {
          // Graph execution completed
          console.log('✅ [sendMessage] Graph COMPLETED');
          setCurrentNode(null);
          setExecutingEdge(null);
          
        } else if (event.event === 'error') {
          console.error('❌ [sendMessage] Stream error:', event.error);
          setMessages(prev => [...prev, {
            type: 'SystemMessage',
            content: `❌ Error: ${event.error}`,
          }]);
        }
      }
      
      // Reload state to get final messages and checkpoints
      // Load state first to get backend messages
      await loadState();
      
      // Then add a pause message if interrupted (after loadState so it doesn't get overwritten)
      if (currentThreadId) {
        const finalState = await api.getThreadState(currentThreadId);
        if (finalState.next && finalState.next.length > 0) {
          const nextNode = finalState.next[0];
          setMessages(prev => [...prev, {
            type: 'SystemMessage',
            content: `⏸️ Paused before "${nextNode}" node. Click "Send Message" to continue.`,
          }]);
        }
      }
      
    } catch (error) {
      console.error('❌ [sendMessage] Error occurred:', error);
      setMessages(prev => [...prev, {
        type: 'SystemMessage',
        content: `❌ Error: ${error}`,
      }]);
    } finally {
      console.log('🏁 [sendMessage] Setting loading to false');
      setLoading(false);
    }
  };
  
  // Approve or reject tool call
  const handleToolApproval = async (approved: boolean) => {
    if (!currentThreadId) return;
    
    setPendingToolCall(null);
    console.log(approved ? '✅ Tool call approved' : '❌ Tool call rejected');
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
      console.error(`Error in tool approval:`, error);
      setMessages(prev => [...prev, {
        type: 'SystemMessage',
        content: `Error: ${error}`,
      }]);
      setCurrentNode(null);
      setExecutingEdge(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Get helpful button text based on current state
  const getButtonText = () => {
    if (!currentThreadId) return '🚀 Send Message';
    if (loading) return '⏳ Processing...';
    if (stateInfo?.next && stateInfo.next.length > 0) {
      // Paused at a node - show what will execute next
      return `▶️ Execute Next Step: "${stateInfo.next[0]}"`;
    }
    return '🚀 Send Message';
  };
  
  // Get helpful guide message based on current state
  const getGuideMessage = () => {
    if (!currentThreadId) {
      return '👋 Welcome! Click "New Thread" to start, then type your essay topic (e.g., "Write about artificial intelligence").';
    }
    if (messages.length === 0) {
      return '📝 Type your essay topic below and click "Send Message" to begin the multi-step essay writing process.';
    }
    if (stateInfo?.next && stateInfo.next.length > 0) {
      const nextNode = stateInfo.next[0];
      if (nextNode === 'planner') {
        return '📋 The planner will create an outline for your essay. Click "Execute Next Step" to start planning.';
      } else if (nextNode === 'generate') {
        return '✍️ The generator will write the essay draft based on the outline and research. Click "Execute Next Step" to generate.';
      } else if (nextNode === 'reflect') {
        return '🤔 The critic will review the draft and provide feedback. Click "Execute Next Step" to get critique.';
      }
      return `⏸️ Ready to execute: ${nextNode}. Click "Execute Next Step" to continue.`;
    }
    if (loading) {
      return '⏳ The AI is working on your essay. This may take a moment...';
    }
    return '✅ Process complete! Start a new thread for another essay, or explore the Graph Flow and State Inspector tabs.';
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
          
          <label className="hitl-toggle" title="When enabled, the process pauses at each major step for your approval">
            <input
              type="checkbox"
              checked={useHITL}
              onChange={(e) => setUseHITL(e.target.checked)}
            />
            <span>Human-in-the-Loop {useHITL ? '(Manual Control)' : '(Auto Run)'}</span>
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
                {/* Guide Message */}
                {showGuide && (
                  <div className="message system" style={{ backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div className="message-label">💡 Guide</div>
                        <div>{getGuideMessage()}</div>
                        {useHITL && stateInfo?.next && (
                          <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#555' }}>
                            <strong>Human-in-the-Loop is ON:</strong> You control each step. Review the output and click "Execute Next Step" to continue.
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setShowGuide(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
                        title="Hide guide"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
                
                {!showGuide && (
                  <button 
                    onClick={() => setShowGuide(true)}
                    style={{ 
                      margin: '10px', 
                      padding: '5px 10px', 
                      background: '#2196f3', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    💡 Show Guide
                  </button>
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
                  placeholder={stateInfo?.next && stateInfo.next.length > 0 
                    ? "(Optional) Add instructions or just click the button to continue..." 
                    : "Type your essay topic... (e.g., 'Write about climate change')"}
                  rows={3}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                />
                
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !currentThreadId}
                  style={{
                    fontSize: stateInfo?.next && stateInfo.next.length > 0 ? '0.95em' : '1em',
                    fontWeight: 'bold'
                  }}
                >
                  {getButtonText()}
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

