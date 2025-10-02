import type {
  ThreadInfo,
  ThreadState,
  RunInput,
  RunResponse,
  ResumeInput,
  CheckpointHistory,
  GraphInfo,
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
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
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
};
