import { readFile, readdir, access, stat } from 'fs/promises';
import { join, basename } from 'path';
import type { ChatSourceAdapter, ProjectInfo, ConversationSummary, UnifiedMessage } from './types';

interface GeminiApiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { id: string; name: string; response: { output: string } };
}

interface GeminiApiMessage {
  role: 'user' | 'model';
  parts: GeminiApiPart[];
}

export class SamplesAdapter implements ChatSourceAdapter {
  id = 'samples';
  name = 'Sample Conversations';
  private samplesDir: string;

  constructor(projectRoot: string) {
    this.samplesDir = join(projectRoot, 'samples');
  }

  async listProjects(): Promise<ProjectInfo[]> {
    try {
      await access(this.samplesDir);
      return [{ id: 'samples', name: 'Samples' }];
    } catch {
      return [];
    }
  }

  async listConversations(_projectId?: string): Promise<ConversationSummary[]> {
    try {
      const files = await readdir(this.samplesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const conversations: ConversationSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = join(this.samplesDir, file);
          const fileStat = await stat(filePath);
          const name = basename(file, '.json');

          conversations.push({
            id: name,
            title: this.formatTitle(name),
            sourceId: this.id,
            projectId: 'samples',
            projectName: 'Samples',
            createdAt: fileStat.birthtimeMs,
            updatedAt: fileStat.mtimeMs,
          });
        } catch {
          // Skip unreadable files
        }
      }

      conversations.sort((a, b) => (a.title).localeCompare(b.title));
      return conversations;
    } catch (err) {
      console.warn(`[SamplesAdapter] Could not read samples directory:`, err);
      return [];
    }
  }

  async loadConversation(conversationId: string): Promise<UnifiedMessage[]> {
    const filePath = join(this.samplesDir, `${conversationId}.json`);

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      console.warn(`[SamplesAdapter] Could not read file ${filePath}:`, err);
      return [];
    }

    try {
      const data = JSON.parse(content);
      return this.parseAuto(data);
    } catch (err) {
      console.error(`[SamplesAdapter] Failed to parse ${filePath}:`, err);
      return [];
    }
  }

  private parseAuto(data: unknown): UnifiedMessage[] {
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      const first = data[0];

      if (first.role && first.parts) {
        return this.parseGeminiApi(data as GeminiApiMessage[]);
      }

      if (first.role && typeof first.content === 'string') {
        return data as UnifiedMessage[];
      }
    }

    console.warn(`[SamplesAdapter] Unrecognized JSON format`);
    return [];
  }

  private parseGeminiApi(messages: GeminiApiMessage[]): UnifiedMessage[] {
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

  private formatTitle(filename: string): string {
    return filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
