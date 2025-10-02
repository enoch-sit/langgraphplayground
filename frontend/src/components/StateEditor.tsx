import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { StateFieldsResponse, Message } from '../types/api';
import './StateEditor.css';

interface StateEditorProps {
  threadId: string;
  onStateUpdated?: () => void;
}

export function StateEditor({ threadId, onStateUpdated }: StateEditorProps) {
  const [stateData, setStateData] = useState<StateFieldsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedMessages, setEditedMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (threadId) {
      loadStateData();
    }
  }, [threadId]);

  const loadStateData = async () => {
    try {
      setLoading(true);
      const data = await api.getStateFields(threadId);
      setStateData(data);
      setEditedMessages(data.fields.messages?.value || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load state');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.updateStateFields(threadId, {
        messages: editedMessages,
      });
      setEditing(false);
      await loadStateData();
      onStateUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update state');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedMessages(stateData?.fields.messages?.value || []);
    setEditing(false);
  };

  const handleDeleteMessage = (index: number) => {
    setEditedMessages(editedMessages.filter((_, i) => i !== index));
  };

  const handleEditMessage = (index: number, newContent: string) => {
    const updated = [...editedMessages];
    updated[index] = { ...updated[index], content: newContent };
    setEditedMessages(updated);
  };

  if (loading && !stateData) {
    return <div className="state-editor loading">Loading state...</div>;
  }

  if (error && !stateData) {
    return (
      <div className="state-editor error">
        <p>Error: {error}</p>
        <button onClick={loadStateData}>Retry</button>
      </div>
    );
  }

  if (!stateData) {
    return <div className="state-editor">No state data available</div>;
  }

  return (
    <div className="state-editor">
      <div className="state-header">
        <h3>State Editor</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-edit">
            Edit State
          </button>
        ) : (
          <div className="edit-actions">
            <button onClick={handleSave} className="btn-save" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} className="btn-cancel" disabled={loading}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="state-metadata">
        <div className="metadata-item">
          <strong>Thread ID:</strong> {stateData.thread_id}
        </div>
        {stateData.metadata.next && (
          <div className="metadata-item">
            <strong>Next:</strong> {stateData.metadata.next.join(', ')}
          </div>
        )}
        {stateData.metadata.checkpoint_id && (
          <div className="metadata-item">
            <strong>Checkpoint:</strong> {stateData.metadata.checkpoint_id.slice(0, 8)}...
          </div>
        )}
      </div>

      <div className="state-fields">
        <h4>Messages ({editedMessages.length})</h4>
        <div className="messages-list">
          {editedMessages.map((msg, idx) => (
            <div key={idx} className={`message-card ${msg.type.toLowerCase()}`}>
              <div className="message-header">
                <span className="message-type">{msg.type}</span>
                {editing && (
                  <button
                    onClick={() => handleDeleteMessage(idx)}
                    className="btn-delete"
                    title="Delete message"
                  >
                    ×
                  </button>
                )}
              </div>
              {editing ? (
                <textarea
                  value={msg.content}
                  onChange={(e) => handleEditMessage(idx, e.target.value)}
                  className="message-editor"
                  rows={3}
                />
              ) : (
                <p className="message-content">{msg.content}</p>
              )}
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="tool-calls">
                  <strong>Tool Calls:</strong>
                  {msg.tool_calls.map((call, i) => (
                    <div key={i} className="tool-call">
                      <code>{call.name}</code>
                      <pre>{JSON.stringify(call.args, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
