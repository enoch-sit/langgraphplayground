/**
 * PromptEditor Component
 * 
 * Educational UI for editing node prompts and model parameters.
 * Students can modify prompts to see how it changes agent behavior!
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './PromptEditor.css';

interface PromptEditorProps {
  threadId: string | null;
  onPromptUpdate?: () => void;
}

interface Prompts {
  agent_system_prompt: string;
  tool_execution_message: string;
}

interface Parameters {
  temperature: number;
  max_tokens: number;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({ threadId, onPromptUpdate }) => {
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load prompts and parameters
  useEffect(() => {
    if (threadId) {
      loadPrompts();
      loadParameters();
    }
  }, [threadId]);

  const loadPrompts = async () => {
    if (!threadId) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/threads/${threadId}/prompts`);
      setPrompts(response.data.prompts);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const loadParameters = async () => {
    if (!threadId) return;
    
    try {
      const response = await apiClient.get(`/threads/${threadId}/parameters`);
      setParameters(response.data.parameters);
    } catch (err: any) {
      console.error('Failed to load parameters:', err);
    }
  };

  const handleEditPrompt = (promptName: string) => {
    if (prompts) {
      setEditingPrompt(promptName);
      setEditValue(prompts[promptName as keyof Prompts]);
    }
  };

  const handleSavePrompt = async () => {
    if (!threadId || !editingPrompt) return;

    try {
      setLoading(true);
      await apiClient.post(`/threads/${threadId}/prompts/${editingPrompt}`, {
        prompt: editValue
      });
      
      setSuccessMessage(`✅ Prompt '${editingPrompt}' updated!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      setEditingPrompt(null);
      await loadPrompts();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPrompt = async (promptName: string) => {
    if (!threadId || !confirm(`Reset '${promptName}' to default?`)) return;

    try {
      setLoading(true);
      await apiClient.post(`/threads/${threadId}/prompts/${promptName}/reset`);
      
      setSuccessMessage(`✅ Prompt '${promptName}' reset to default!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await loadPrompts();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParameter = async (paramName: string, value: number) => {
    if (!threadId) return;

    try {
      setLoading(true);
      await apiClient.post(`/threads/${threadId}/parameters`, {
        [paramName]: value
      });
      
      setSuccessMessage(`✅ Parameter '${paramName}' updated to ${value}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await loadParameters();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update parameter');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePrompts = async () => {
    if (!threadId) return;

    try {
      setLoading(true);
      await apiClient.post(`/threads/${threadId}/prompts/initialize`);
      
      setSuccessMessage('✅ Prompts initialized in state!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await loadPrompts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initialize prompts');
    } finally {
      setLoading(false);
    }
  };

  if (!threadId) {
    return (
      <div className="prompt-editor">
        <div className="prompt-editor-empty">
          <p>💡 Create or select a thread to edit prompts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-editor">
      <div className="prompt-editor-header">
        <h3>🎨 Prompt & Parameter Editor</h3>
        <p className="prompt-editor-subtitle">
          Experiment with prompts to change agent behavior!
        </p>
      </div>

      {error && (
        <div className="prompt-editor-error">
          ❌ {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="prompt-editor-success">
          {successMessage}
        </div>
      )}

      {/* Parameters Section */}
      <div className="prompt-editor-section">
        <h4>⚙️ Model Parameters</h4>
        {parameters ? (
          <div className="parameters-grid">
            <div className="parameter-item">
              <label>
                🌡️ Temperature: {parameters.temperature.toFixed(2)}
                <span className="parameter-help">
                  Controls randomness (0.0 = deterministic, 1.0 = creative)
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={parameters.temperature}
                onChange={(e) => handleUpdateParameter('temperature', parseFloat(e.target.value))}
                disabled={loading}
              />
              <div className="parameter-labels">
                <span>Deterministic</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="parameter-item">
              <label>
                📏 Max Tokens: {parameters.max_tokens}
                <span className="parameter-help">
                  Maximum length of LLM response
                </span>
              </label>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={parameters.max_tokens}
                onChange={(e) => handleUpdateParameter('max_tokens', parseInt(e.target.value))}
                disabled={loading}
              />
              <div className="parameter-labels">
                <span>256</span>
                <span>8192</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="loading">Loading parameters...</div>
        )}
      </div>

      {/* Prompts Section */}
      <div className="prompt-editor-section">
        <div className="section-header">
          <h4>📝 Editable Prompts</h4>
          {!prompts && (
            <button 
              onClick={handleInitializePrompts}
              disabled={loading}
              className="btn-secondary"
            >
              Initialize Prompts
            </button>
          )}
        </div>

        {prompts ? (
          <div className="prompts-list">
            {/* Agent System Prompt */}
            <div className="prompt-item">
              <div className="prompt-item-header">
                <h5>🤖 Agent System Prompt</h5>
                <div className="prompt-actions">
                  <button 
                    onClick={() => handleEditPrompt('agent_system_prompt')}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {editingPrompt === 'agent_system_prompt' ? 'Cancel' : 'Edit'}
                  </button>
                  <button 
                    onClick={() => handleResetPrompt('agent_system_prompt')}
                    disabled={loading}
                    className="btn-secondary"
                  >
                    Reset
                  </button>
                </div>
              </div>
              
              <p className="prompt-description">
                This prompt guides the AI agent's behavior, tool usage, and response style.
                Try modifying it to change how the agent behaves!
              </p>

              {editingPrompt === 'agent_system_prompt' ? (
                <div className="prompt-editor-form">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={15}
                    className="prompt-textarea"
                    placeholder="Enter system prompt..."
                  />
                  <div className="prompt-editor-actions">
                    <button 
                      onClick={handleSavePrompt}
                      disabled={loading}
                      className="btn-save"
                    >
                      💾 Save Changes
                    </button>
                    <button 
                      onClick={() => setEditingPrompt(null)}
                      disabled={loading}
                      className="btn-cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="prompt-preview">
                  {prompts.agent_system_prompt.substring(0, 300)}
                  {prompts.agent_system_prompt.length > 300 && '...\n\n[Click Edit to see full prompt]'}
                </pre>
              )}
            </div>

            {/* Tool Execution Message */}
            <div className="prompt-item">
              <div className="prompt-item-header">
                <h5>🔧 Tool Execution Message</h5>
                <div className="prompt-actions">
                  <button 
                    onClick={() => handleEditPrompt('tool_execution_message')}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {editingPrompt === 'tool_execution_message' ? 'Cancel' : 'Edit'}
                  </button>
                  <button 
                    onClick={() => handleResetPrompt('tool_execution_message')}
                    disabled={loading}
                    className="btn-secondary"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <p className="prompt-description">
                Message displayed when tools are being executed.
              </p>

              {editingPrompt === 'tool_execution_message' ? (
                <div className="prompt-editor-form">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="prompt-input"
                    placeholder="Enter message..."
                  />
                  <div className="prompt-editor-actions">
                    <button 
                      onClick={handleSavePrompt}
                      disabled={loading}
                      className="btn-save"
                    >
                      💾 Save
                    </button>
                    <button 
                      onClick={() => setEditingPrompt(null)}
                      disabled={loading}
                      className="btn-cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="prompt-preview-short">
                  {prompts.tool_execution_message}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="prompts-empty">
            <p>Prompts not yet initialized in state.</p>
            <p>Click "Initialize Prompts" to enable editing.</p>
          </div>
        )}
      </div>

      {/* Educational Tips */}
      <div className="prompt-editor-tips">
        <h4>💡 Experiment Ideas</h4>
        <ul>
          <li>Change temperature to 0.9 and see more creative responses</li>
          <li>Modify the system prompt to make the agent speak like a pirate 🏴‍☠️</li>
          <li>Add "Always use emojis" to the prompt for fun responses</li>
          <li>Lower temperature to 0.0 for completely deterministic behavior</li>
          <li>Change tool descriptions to see how it affects tool calling</li>
        </ul>
      </div>
    </div>
  );
};
