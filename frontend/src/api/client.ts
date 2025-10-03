import type {
  ThreadInfo,
  ThreadState,
  RunInput,
  RunResponse,
  ResumeInput,
  CheckpointHistory,
  GraphInfo,
  GraphNodesResponse,
  StateFieldsResponse,
  StateUpdateRequest,
  StateUpdateResponse,
  HealthResponse,
} from '../types/api';

/**
 * Get API base URL
 * In development: uses Vite proxy (empty string)
 * In production: uses Vite's BASE_URL which matches the base config
 */
function getApiBase(): string {
  // In development mode, Vite proxy handles routing
  if (import.meta.env.DEV) {
    return '';
  }
  
  // In production, use Vite's BASE_URL (e.g., '/langgraphplayground/')
  // Remove trailing slash to avoid double slashes in API calls
  const base = import.meta.env.BASE_URL || '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
}

const API_BASE = getApiBase();

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  console.log(`🌐 [API] ${options?.method || 'GET'} ${url}`);
  if (options?.body) {
    console.log('📤 [API] Request body:', JSON.parse(options.body as string));
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    console.log(`📥 [API] Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      console.error('❌ [API] Error response:', error);
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ [API] Response data:', data);
    return data;
  } catch (error) {
    console.error(`❌ [API] Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * API Client for LangGraph Playground
 */
export const api = {
  // Health check
  async health(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/health');
  },
  
  // Thread management
  async createThread(threadId?: string): Promise<ThreadInfo> {
    return apiFetch<ThreadInfo>('/threads', {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId }),
    });
  },
  
  async getThread(threadId: string): Promise<ThreadInfo> {
    return apiFetch<ThreadInfo>(`/threads/${threadId}`);
  },
  
  async getThreadState(threadId: string): Promise<ThreadState> {
    return apiFetch<ThreadState>(`/threads/${threadId}/state`);
  },
  
  async getThreadHistory(threadId: string, limit = 10): Promise<CheckpointHistory> {
    return apiFetch<CheckpointHistory>(
      `/threads/${threadId}/history?limit=${limit}`
    );
  },
  
  // Agent interaction
  async invokeAgent(input: RunInput): Promise<RunResponse> {
    return apiFetch<RunResponse>('/runs/invoke', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  
  async resumeAgent(input: ResumeInput): Promise<RunResponse> {
    return apiFetch<RunResponse>('/runs/resume', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  
  // Graph information
  async getGraphInfo(): Promise<GraphInfo> {
    return apiFetch<GraphInfo>('/graph/info');
  },
  
  async getGraphNodes(): Promise<GraphNodesResponse> {
    return apiFetch<GraphNodesResponse>('/graph/nodes');
  },
  
  // State management
  async getStateFields(threadId: string): Promise<StateFieldsResponse> {
    return apiFetch<StateFieldsResponse>(`/threads/${threadId}/state/fields`);
  },
  
  async updateStateFields(
    threadId: string,
    stateUpdate: StateUpdateRequest
  ): Promise<StateUpdateResponse> {
    return apiFetch<StateUpdateResponse>(`/threads/${threadId}/state/update`, {
      method: 'POST',
      body: JSON.stringify(stateUpdate),
    });
  },
  
  // Time travel / Checkpoint navigation
  async getCheckpointState(
    threadId: string,
    checkpointId: string
  ): Promise<ThreadState> {
    return apiFetch<ThreadState>(
      `/threads/${threadId}/checkpoints/${checkpointId}/state`
    );
  },
  
  async resumeFromCheckpoint(
    threadId: string,
    checkpointId: string,
    newInput?: Record<string, any>
  ): Promise<RunResponse> {
    return apiFetch<RunResponse>(
      `/threads/${threadId}/checkpoints/${checkpointId}/resume`,
      {
        method: 'POST',
        body: JSON.stringify(newInput || {}),
      }
    );
  },
  
  // Educational endpoints - Prompts
  async getPrompts(threadId: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/prompts`);
  },
  
  async getPrompt(threadId: string, promptName: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/prompts/${promptName}`);
  },
  
  async updatePrompt(threadId: string, promptName: string, prompt: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/prompts/${promptName}`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },
  
  async resetPrompt(threadId: string, promptName: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/prompts/${promptName}/reset`, {
      method: 'POST',
    });
  },
  
  async initializePrompts(threadId: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/prompts/initialize`, {
      method: 'POST',
    });
  },
  
  // Educational endpoints - Parameters
  async getParameters(threadId: string): Promise<any> {
    return apiFetch(`/threads/${threadId}/parameters`);
  },
  
  async updateParameters(threadId: string, parameters: Record<string, any>): Promise<any> {
    return apiFetch(`/threads/${threadId}/parameters`, {
      method: 'POST',
      body: JSON.stringify(parameters),
    });
  },
};

// Export convenience functions
export const {
  health,
  createThread,
  getThread,
  getThreadState,
  getThreadHistory,
  invokeAgent,
  resumeAgent,
  getGraphInfo,
  getGraphNodes,
  getStateFields,
  updateStateFields,
  getCheckpointState,
  resumeFromCheckpoint,
} = api;
