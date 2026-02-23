import { readFile, readdir, access, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { ChatSourceAdapter, ProjectInfo, ConversationSummary, UnifiedMessage } from './types';

interface GeminiThought {
  subject: string;
  description: string;
  timestamp: string;
}

interface GeminiSessionMessage {
  id: string;
  timestamp: string;
  type: string;
  content: string;
  thoughts?: GeminiThought[];
  toolName?: string;
  args?: Record<string, unknown>;
  output?: string;
}

interface GeminiSession {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated: string;
  messages: GeminiSessionMessage[];
}

export class GeminiAdapter implements ChatSourceAdapter {
  id = 'gemini';
  name = 'Gemini CLI';
  private baseDir: string;

  constructor() {
    this.baseDir = join(homedir(), '.gemini', 'tmp');
  }

  async listProjects(): Promise<ProjectInfo[]> {
    try {
      await access(this.baseDir);
    } catch {
      console.warn(`[GeminiAdapter] Gemini CLI directory not found: ${this.baseDir}`);
      return [];
    }

    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      const projects: ProjectInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'bin') continue;

        const chatsDir = join(this.baseDir, entry.name, 'chats');
        try {
          await access(chatsDir);
          projects.push({
            id: entry.name,
            name: entry.name.substring(0, 8) + '...',
            path: entry.name,
          });
        } catch {
          // No chats directory
        }
      }

      return projects.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error(`[GeminiAdapter] Failed to list projects:`, err);
      return [];
    }
  }

  async listConversations(projectId?: string): Promise<ConversationSummary[]> {
    if (!projectId) return [];

    const chatsDir = join(this.baseDir, projectId, 'chats');
    try {
      const files = await readdir(chatsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));
      const conversations: ConversationSummary[] = [];

      for (const file of sessionFiles) {
        try {
          const filePath = join(chatsDir, file);
          const fileStat = await stat(filePath);
          const content = await readFile(filePath, 'utf-8');
          const session: GeminiSession = JSON.parse(content);

          const firstUserMsg = session.messages?.find(m => m.type === 'user');
          const title = firstUserMsg
            ? this.truncateTitle(firstUserMsg.content)
            : file.replace('.json', '');

          conversations.push({
            id: file.replace('.json', ''),
            title,
            sourceId: this.id,
            projectId,
            createdAt: session.startTime ? new Date(session.startTime).getTime() : fileStat.birthtimeMs,
            updatedAt: session.lastUpdated ? new Date(session.lastUpdated).getTime() : fileStat.mtimeMs,
          });
        } catch {
          // Skip unreadable session files
        }
      }

      conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return conversations;
    } catch (err) {
      console.warn(`[GeminiAdapter] Could not read chats directory ${chatsDir}:`, err);
      return [];
    }
  }

  async loadConversation(conversationId: string, projectId?: string): Promise<UnifiedMessage[]> {
    if (!projectId) return [];

    const filePath = join(this.baseDir, projectId, 'chats', `${conversationId}.json`);

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      console.warn(`[GeminiAdapter] Could not read session file ${filePath}:`, err);
      return [];
    }

    try {
      const session: GeminiSession = JSON.parse(content);
      return this.normalizeSession(session);
    } catch (err) {
      console.error(`[GeminiAdapter] Failed to parse session ${filePath}:`, err);
      return [];
    }
  }

  private normalizeSession(session: GeminiSession): UnifiedMessage[] {
    const result: UnifiedMessage[] = [];

    for (const msg of session.messages || []) {
      const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : undefined;

      switch (msg.type) {
        case 'user':
          if (msg.content) {
            result.push({ role: 'user', content: msg.content, timestamp });
          }
          break;

        case 'gemini':
          if (msg.thoughts) {
            for (const thought of msg.thoughts) {
              const text = thought.description || thought.subject;
              if (text) {
                result.push({ role: 'thinking', content: text, timestamp });
              }
            }
          }
          if (msg.content) {
            result.push({ role: 'assistant', content: msg.content, timestamp });
          }
          break;

        case 'tool_use':
          result.push({
            role: 'tool_call',
            content: msg.toolName || msg.content || 'tool',
            toolCall: {
              name: msg.toolName || msg.content || 'tool',
              args: msg.args
                ? Object.fromEntries(Object.entries(msg.args).map(([k, v]) => [k, String(v)]))
                : {},
            },
            timestamp,
          });
          break;

        case 'tool_result':
          result.push({
            role: 'tool_result',
            content: msg.output || msg.content || '(completed)',
            toolResult: {
              name: msg.toolName || '',
              output: msg.output || msg.content || '(completed)',
            },
            timestamp,
          });
          break;

        case 'error':
          break;

        default:
          break;
      }
    }

    return result;
  }

  private truncateTitle(text: string): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 60) return cleaned;
    return cleaned.substring(0, 57) + '...';
  }
}
