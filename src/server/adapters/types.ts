export interface ProjectInfo {
  id: string;
  name: string;
  path?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  sourceId: string;
  projectId?: string;
  projectName?: string;
  createdAt?: number;
  updatedAt?: number;
  messageCount?: number;
}

export interface SubagentConversation {
  id: string;
  messages: UnifiedMessage[];
  createdAt?: number;
}

export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result' | 'subagent';
  content: string;
  toolCall?: {
    name: string;
    args: Record<string, string>;
  };
  toolResult?: {
    name: string;
    output: string;
  };
  subagent?: SubagentConversation;
  timestamp?: number;
}

export interface ChatSourceAdapter {
  id: string;
  name: string;
  listProjects(): Promise<ProjectInfo[]>;
  listConversations(projectId?: string): Promise<ConversationSummary[]>;
  loadConversation(conversationId: string, projectId?: string): Promise<UnifiedMessage[]>;
}
