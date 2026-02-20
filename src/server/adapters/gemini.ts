import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { ChatSourceAdapter, ProjectInfo, ConversationSummary, UnifiedMessage } from './types';

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    id: string;
    name: string;
    response: {
      output: string;
    };
  };
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export class GeminiAdapter implements ChatSourceAdapter {
  id = 'gemini';
  name = 'Gemini CLI';
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async listProjects(): Promise<ProjectInfo[]> {
    return [{ id: 'local', name: 'Local Files' }];
  }

  async listConversations(_projectId?: string): Promise<ConversationSummary[]> {
    try {
      const files = await readdir(this.dataDir);
      const chatFiles = files.filter(f => f.endsWith('.json') && f.includes('chat'));
      return chatFiles.map(f => ({
        id: f.replace('.json', ''),
        title: this.formatTitle(f.replace('.json', '')),
        sourceId: this.id,
        projectId: 'local',
        projectName: 'Local Files',
      }));
    } catch {
      return [];
    }
  }

  async loadConversation(conversationId: string): Promise<UnifiedMessage[]> {
    const filePath = join(this.dataDir, `${conversationId}.json`);
    const raw = await readFile(filePath, 'utf-8');
    const messages: GeminiMessage[] = JSON.parse(raw);
    return this.normalize(messages);
  }

  private formatTitle(filename: string): string {
    return filename.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private normalize(messages: GeminiMessage[]): UnifiedMessage[] {
    const result: UnifiedMessage[] = [];

    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.functionCall) {
          result.push({
            role: 'tool_call',
            content: part.functionCall.name,
            toolCall: {
              name: part.functionCall.name,
              args: Object.fromEntries(
                Object.entries(part.functionCall.args).map(([k, v]) => [k, String(v)])
              ),
            },
          });
        } else if (part.functionResponse) {
          result.push({
            role: 'tool_result',
            content: part.functionResponse.response.output,
            toolResult: {
              name: part.functionResponse.name,
              output: part.functionResponse.response.output,
            },
          });
        } else if (part.text) {
          result.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: part.text,
          });
        }
      }
    }

    return result;
  }
}
