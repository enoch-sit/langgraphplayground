import React, { useEffect, useState } from 'react';
import { getStateFields, updateStateFields } from '../api/client';
import { StateFieldsResponse, StateUpdateRequest } from '../types/api';
import './StateInspector.css';

interface StateInspectorProps {
  threadId: string | null;
  onRefresh?: () => void;
}

const StateInspector: React.FC<StateInspectorProps> = ({ threadId, onRefresh }) => {
  const [stateFields, setStateFields] = useState<StateFieldsResponse | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (threadId) {
      fetchStateFields();
    }
  }, [threadId]);

  const fetchStateFields = async () => {
    if (!threadId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getStateFields(threadId);
      setStateFields(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch state fields');
      console.error('Error fetching state fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName);
    // Convert value to editable string format
    if (typeof currentValue === 'object') {
      setEditValue(JSON.stringify(currentValue, null, 2));
    } else {
      setEditValue(String(currentValue));
    }
  };

  const handleSave = async (fieldName: string) => {
    if (!threadId) return;

    try {
      // Parse the edited value
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // If JSON parse fails, use as string
        parsedValue = editValue;
      }

      const updates: StateUpdateRequest = {
        [fieldName]: parsedValue
      };

      await updateStateFields(threadId, updates);
      
      // Refresh state fields
      await fetchStateFields();
      
      // Notify parent to refresh
      if (onRefresh) {
        onRefresh();
      }

      setEditingField(null);
      setEditValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update state');
      console.error('Error updating state:', err);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const renderFieldValue = (field: any, fieldName: string) => {
    if (editingField === fieldName) {
      return (
        <div className="field-edit">
          <textarea
            className="edit-textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={10}
          />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSave(fieldName)}>
              💾 Save
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              ✖ Cancel
            </button>
          </div>
        </div>
      );
    }

    // Display-only view
    if (Array.isArray(field.value)) {
      return (
        <div className="field-value-list">
          {field.value.map((item: any, idx: number) => (
            <div key={idx} className="field-value-item">
              {typeof item === 'object' ? (
                <pre>{JSON.stringify(item, null, 2)}</pre>
              ) : (
                <div>{String(item)}</div>
              )}
            </div>
          ))}
        </div>
      );
    } else if (typeof field.value === 'object' && field.value !== null) {
      return <pre className="field-value-json">{JSON.stringify(field.value, null, 2)}</pre>;
    } else {
      return <div className="field-value-text">{String(field.value)}</div>;
    }
  };

  if (!threadId) {
    return (
      <div className="state-inspector">
        <div className="inspector-empty">
          <p>No thread selected</p>
          <p className="inspector-hint">Start a conversation to inspect state</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="state-inspector">
        <div className="inspector-loading">Loading state fields...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-inspector">
        <div className="inspector-error">
          <p>⚠ Error: {error}</p>
          <button onClick={fetchStateFields}>Retry</button>
        </div>
      </div>
    );
  }

  if (!stateFields) {
    return (
      <div className="state-inspector">
        <div className="inspector-empty">No state data available</div>
      </div>
    );
  }

  return (
    <div className="state-inspector">
      <div className="inspector-header">
        <h2>State Inspector</h2>
        <button className="refresh-btn" onClick={fetchStateFields} title="Refresh state">
          🔄
        </button>
      </div>

      {/* Metadata section */}
      <div className="inspector-metadata">
        <div className="metadata-item">
          <span className="metadata-label">Thread ID:</span>
          <span className="metadata-value">{stateFields.thread_id}</span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Next Node:</span>
          <span className="metadata-value">
            {stateFields.metadata.next ? stateFields.metadata.next.join(', ') : 'END'}
          </span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Checkpoint ID:</span>
          <span className="metadata-value checkpoint-id">
            {stateFields.metadata.checkpoint_id || 'N/A'}
          </span>
        </div>
        {stateFields.metadata.parent_checkpoint_id && (
          <div className="metadata-item">
            <span className="metadata-label">Parent Checkpoint:</span>
            <span className="metadata-value checkpoint-id">
              {stateFields.metadata.parent_checkpoint_id}
            </span>
          </div>
        )}
      </div>

      {/* State fields */}
      <div className="inspector-fields">
        <h3>State Fields</h3>
        {Object.entries(stateFields.fields).map(([fieldName, field]) => (
          <div key={fieldName} className="state-field">
            <div className="field-header">
              <div className="field-name-row">
                <h4>{fieldName}</h4>
                <span className="field-type">{field.type}</span>
                {field.editable && editingField !== fieldName && (
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(fieldName, field.value)}
                    title="Edit this field"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
              <div className="field-description">{field.description}</div>
              {field.count !== undefined && (
                <div className="field-count">Count: {field.count}</div>
              )}
            </div>
            <div className="field-content">
              {renderFieldValue(field, fieldName)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateInspector;
