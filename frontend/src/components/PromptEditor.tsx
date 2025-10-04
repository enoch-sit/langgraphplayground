/**
 * PromptEditor Component
 * 
 * Educational UI for editing node prompts and model parameters.
 * Students can modify prompts to see how it changes agent behavior!
 * 
 * Updated for Trip Planner Graph with multiple editable node prompts!
 */

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './PromptEditor.css';

interface PromptEditorProps {
  threadId: string | null;
  onPromptUpdate?: () => void;
}

interface Prompts {
  planner_prompt?: string;
  travel_plan_prompt?: string;
  generator_prompt?: string;
  critic_prompt?: string;
  travel_critique_prompt?: string;
  agent_system_prompt?: string;
  tool_execution_message?: string;
}

interface Parameters {
  temperature: number;
  max_tokens: number;
}

// Node prompt metadata for Trip Planner
const TRIP_PLANNER_PROMPTS = [
  {
    name: 'planner_prompt',
    title: '📝 Planner',
    icon: '📝',
    description: 'Controls how the trip outline is created',
    node: 'planner'
  },
  {
    name: 'travel_plan_prompt',
    title: '�️ Travel Planning',
    icon: '�️',
    description: 'Controls what travel information to search for',
    node: 'travel_plan'
  },
  {
    name: 'generator_prompt',
    title: '✍️ Generator',
    icon: '✍️',
    description: 'Controls the writing style and approach',
    node: 'generate'
  },
  {
    name: 'critic_prompt',
    title: '👨‍🏫 Critic',
    icon: '👨‍🏫',
    description: 'Controls how the trip itinerary is evaluated',
    node: 'reflect'
  },
  {
    name: 'travel_critique_prompt',
    title: '🚗 Travel Planning Critique',
    icon: '🚗',
    description: 'Controls additional travel research after critique',
    node: 'travel_critique'
  }
];

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
      const response = await api.getPrompts(threadId);
      setPrompts(response.prompts);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const loadParameters = async () => {
    if (!threadId) return;
    
    try {
      const response = await api.getParameters(threadId);
      setParameters(response.parameters);
    } catch (err: any) {
      console.error('Failed to load parameters:', err);
    }
  };

  const handleEditPrompt = (promptName: string) => {
    if (prompts) {
      setEditingPrompt(promptName);
      setEditValue(prompts[promptName as keyof Prompts] || '');
    }
  };

  const handleSavePrompt = async () => {
    if (!threadId || !editingPrompt) return;

    try {
      setLoading(true);
      await api.updatePrompt(threadId, editingPrompt, editValue);
      
      setSuccessMessage(`✅ Prompt '${editingPrompt}' updated!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      setEditingPrompt(null);
      await loadPrompts();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPrompt = async (promptName: string) => {
    if (!threadId || !confirm(`Reset '${promptName}' to default?`)) return;

    try {
      setLoading(true);
      await api.resetPrompt(threadId, promptName);
      
      setSuccessMessage(`✅ Prompt '${promptName}' reset to default!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await loadPrompts();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParameter = async (paramName: string, value: number) => {
    if (!threadId) return;

    try {
      setLoading(true);
      await api.updateParameters(threadId, { [paramName]: value });
      
      setSuccessMessage(`✅ Parameter '${paramName}' updated to ${value}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      await loadParameters();
      
      if (onPromptUpdate) {
        onPromptUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update parameter');
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
          <h4>✈️ Trip Planner Node Prompts</h4>
          <p className="section-subtitle">Each node has its own editable prompt!</p>
        </div>

        {prompts ? (
          <div className="prompts-list">
            {TRIP_PLANNER_PROMPTS.map((promptInfo) => {
              const promptValue = prompts[promptInfo.name as keyof Prompts];
              const isEditing = editingPrompt === promptInfo.name;
              
              return (
                <div key={promptInfo.name} className="prompt-item">
                  <div className="prompt-item-header">
                    <h5>
                      <span className="prompt-icon">{promptInfo.icon}</span>
                      {promptInfo.title}
                    </h5>
                    <div className="prompt-actions">
                      <button 
                        onClick={() => isEditing ? setEditingPrompt(null) : handleEditPrompt(promptInfo.name)}
                        disabled={loading}
                        className="btn-primary"
                      >
                        {isEditing ? '❌ Cancel' : '✏️ Edit'}
                      </button>
                      <button 
                        onClick={() => handleResetPrompt(promptInfo.name)}
                        disabled={loading}
                        className="btn-secondary"
                      >
                        🔄 Reset
                      </button>
                    </div>
                  </div>
                  
                  <p className="prompt-description">
                    {promptInfo.description} <span className="prompt-node-badge">Node: {promptInfo.node}</span>
                  </p>

                  {isEditing ? (
                    <div className="prompt-editor-form">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={12}
                        className="prompt-textarea"
                        placeholder="Enter prompt text..."
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
                      <div className="prompt-char-count">
                        {editValue.length} characters
                      </div>
                    </div>
                  ) : (
                    <pre className="prompt-preview">
                      {promptValue || 'Not set - will use default'}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="prompts-empty">
            <p>Loading prompts...</p>
          </div>
        )}
      </div>

      {/* Educational Tips */}
      <div className="prompt-editor-tips">
        <h4>💡 Experiment Ideas</h4>
        <ul>
          <li><strong>Planner:</strong> Change to "Create a detailed 7-day outline" for longer trips</li>
          <li><strong>Generator:</strong> Add "Use simple language for beginners" to change writing style</li>
          <li><strong>Critic:</strong> Modify to "Be extremely harsh and critical" to see stricter feedback</li>
          <li><strong>Temperature:</strong> Increase to 0.9 for more creative writing</li>
          <li><strong>Research:</strong> Change to "Focus on recent news articles only"</li>
          <li>Try making the critic prompt very encouraging vs very critical!</li>
          <li>Experiment with different max_tokens to control itinerary length</li>
        </ul>
      </div>
    </div>
  );
};
