// --- Unified types (used by the adapter API and frontend) ---

export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result';
  content: string;
  toolCall?: {
    name: string;
    args: Record<string, string>;
  };
  toolResult?: {
    name: string;
    output: string;
  };
  timestamp?: number;
}

export interface ConversationInfo {
  id: string;
  title: string;
  sourceId: string;
  projectId?: string;
  projectName?: string;
  createdAt?: number;
  updatedAt?: number;
  messageCount?: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path?: string;
}

export interface SourceInfo {
  id: string;
  name: string;
}

export interface DisplaySettings {
  showThinking: boolean;
  showToolCalls: boolean;
  showToolResults: boolean;
  playbackSpeed: number;
}

// --- Playback types (used by the animation system) ---

export interface ApprovalState {
  status: 'pending' | 'approved' | 'rejected' | 'ended';
  action?: 'yes' | 'no' | 'end';
}

export interface PlaybackMessage {
  role:
    | 'user'
    | 'assistant'
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'approval'
    | 'thinking_animation';
  content: string;
  toolCall?: {
    name: string;
    args: Record<string, string>;
  };
  toolResult?: {
    name: string;
    output: string;
  };
  approval?: ApprovalState;
  isAnimating?: boolean;
}

export type PlaybackHistory = PlaybackMessage[];
