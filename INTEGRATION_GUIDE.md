# Integration Guide - Adding Tabs to App.tsx

## Quick Integration Steps

To complete the integration of GraphVisualization and StateEditor components into the main app, follow these steps:

### 1. Import the New Components

Add these imports at the top of `App.tsx`:

```tsx
import { GraphVisualization } from './components/GraphVisualization';
import { StateEditor } from './components/StateEditor';
```

### 2. Add Tab State

Inside the `App` component, add state for active tab:

```tsx
const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'state'>('chat');
```

### 3. Add Tab Navigation UI

Add this HTML before the main content area (after the header, before messages):

```tsx
<div className="tabs">
  <button 
    className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
    onClick={() => setActiveTab('chat')}
  >
    💬 Chat
  </button>
  <button 
    className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
    onClick={() => setActiveTab('graph')}
  >
    🔷 Graph
  </button>
  <button 
    className={`tab ${activeTab === 'state' ? 'active' : ''}`}
    onClick={() => setActiveTab('state')}
    disabled={!currentThreadId}
  >
    ⚙️ State
  </button>
</div>
```

### 4. Conditional Rendering

Wrap the existing chat UI and add new components:

```tsx
<div className="content-area">
  {activeTab === 'chat' && (
    <div className="chat-view">
      {/* All existing chat UI code */}
      <div className="messages">
        {messages.map((msg, idx) => (
          // ... existing message rendering
        ))}
      </div>
      {/* ... rest of chat UI */}
    </div>
  )}
  
  {activeTab === 'graph' && (
    <GraphVisualization />
  )}
  
  {activeTab === 'state' && currentThreadId && (
    <StateEditor 
      threadId={currentThreadId}
      onStateUpdated={() => loadState()}
    />
  )}
  
  {activeTab === 'state' && !currentThreadId && (
    <div className="no-thread-message">
      <p>Please create a thread first to view and edit state</p>
      <button onClick={createThread}>Create Thread</button>
    </div>
  )}
</div>
```

### 5. Add Tab Styles to index.css

```css
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px 8px 0 0;
  color: #9ca3af;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

.tab:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tab.active {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
  border-bottom-color: #60a5fa;
}

.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.chat-view,
.no-thread-message {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.no-thread-message {
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #9ca3af;
}

.no-thread-message p {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.no-thread-message button {
  padding: 0.75rem 1.5rem;
  background: #60a5fa;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.no-thread-message button:hover {
  background: #3b82f6;
}
```

## Alternative: Side Panel Layout

If you prefer a side panel instead of tabs:

```tsx
<div className="app-layout">
  <div className="main-panel">
    {/* Chat interface */}
  </div>
  
  <div className="side-panel">
    <div className="panel-toggle">
      <button onClick={() => setPanel('graph')}>Graph</button>
      <button onClick={() => setPanel('state')}>State</button>
    </div>
    
    {panel === 'graph' && <GraphVisualization />}
    {panel === 'state' && currentThreadId && (
      <StateEditor threadId={currentThreadId} />
    )}
  </div>
</div>
```

## Testing the Integration

1. **Start the backend:**
   ```bash
   uvicorn src.agent.webapp:app --reload --port 2024
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test flow:**
   - Click "Chat" tab → See normal chat interface
   - Click "Graph" tab → See graph visualization with nodes and edges
   - Create a thread and send a message
   - Click "State" tab → See and edit conversation state
   - Edit a message in State tab → Click Save → Check Chat tab to see changes

## Keyboard Shortcuts (Optional Enhancement)

Add keyboard shortcuts for tab navigation:

```tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.altKey) {
      if (e.key === '1') setActiveTab('chat');
      if (e.key === '2') setActiveTab('graph');
      if (e.key === '3' && currentThreadId) setActiveTab('state');
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentThreadId]);
```

## Mobile Responsive (Optional)

For mobile devices, make tabs scrollable:

```css
@media (max-width: 768px) {
  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  
  .tabs::-webkit-scrollbar {
    display: none;
  }
  
  .tab {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
}
```

## Done!

Your LangGraph Playground now has:
- ✅ Interactive graph visualization
- ✅ State inspection and editing
- ✅ Three-tab navigation
- ✅ Real-time updates
- ✅ Better debugging capabilities

Enjoy exploring your LangGraph agents! 🎉
