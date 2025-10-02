// API Types matching FastAPI backend

export interface Message {
  type: 'HumanMessage' | 'AIMessage' | 'ToolMessage' | 'SystemMessage';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  id: string;
}

export interface ThreadInfo {
  thread_id: string;
  created?: boolean;
  state?: {
    messages: number;
  };
}

export interface ThreadState {
  thread_id: string;
  messages: Message[];
  next: string[] | null;
  checkpoint_id?: string;
}

export interface RunInput {
  thread_id: string;
  message: string;
  use_hitl: boolean;
}

export interface RunResponse {
  status: 'interrupted' | 'completed' | 'error';
  thread_id: string;
  awaiting_approval?: boolean;
  tool_calls?: ToolCall[];
  next?: string[];
  messages?: Message[];
  message?: string;
}

export interface ResumeInput {
  thread_id: string;
  approved: boolean;
  modified_args?: Record<string, any>;
}

export interface Checkpoint {
  index: number;
  checkpoint_id?: string;
  messages_count: number;
  next: string[] | null;
  parent_checkpoint_id?: string;
}

export interface CheckpointHistory {
  thread_id: string;
  total: number;
  checkpoints: Checkpoint[];
}

export interface GraphInfo {
  nodes: string[];
  edges: Array<{
    from: string;
    to: string;
    conditional?: boolean;
  }>;
  interrupt_before: string[];
  checkpointer: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'entry' | 'exit' | 'function' | 'interrupt';
  description: string;
  edges_to: string[];
  edges_conditional?: boolean;
  can_interrupt: boolean;
  interrupt_before?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  conditional: boolean;
  description: string;
}

export interface GraphNodesResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_point: string;
  interrupt_before: string[];
  checkpointer: string;
  state_schema: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
    };
  };
}

export interface StateField {
  type: string;
  count?: number;
  editable: boolean;
  description: string;
  value: any;
}

export interface StateFieldsResponse {
  thread_id: string;
  fields: {
    [key: string]: StateField;
  };
  metadata: {
    next: string[] | null;
    checkpoint_id: string | null;
    parent_checkpoint_id: string | null;
  };
}

export interface StateUpdateRequest {
  [key: string]: any;
}

export interface StateUpdateResponse {
  status: string;
  thread_id: string;
  updates_applied: StateUpdateRequest;
  current_state: {
    messages_count: number;
    next: string[] | null;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
}
