import { readFile, readdir, access, stat } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { homedir, platform } from 'os';
import type { ChatSourceAdapter, ProjectInfo, ConversationSummary, UnifiedMessage, SubagentConversation } from './types';

function getCursorWorkspaceStorageDir(): string {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Cursor', 'User', 'workspaceStorage');
    case 'linux':
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'Cursor', 'User', 'workspaceStorage');
  }
}

export class CursorAdapter implements ChatSourceAdapter {
  id = 'cursor';
  name = 'Cursor IDE';

  private projectsDir: string;
  private workspaceStorageDir: string;

  constructor(projectsDir?: string, workspaceStorageDir?: string) {
    const home = homedir();
    this.projectsDir = projectsDir ?? join(home, '.cursor', 'projects');
    this.workspaceStorageDir = workspaceStorageDir ?? getCursorWorkspaceStorageDir();
  }

  async listProjects(): Promise<ProjectInfo[]> {
    try {
      await access(this.projectsDir);
    } catch {
      console.warn(`[CursorAdapter] Projects directory not found: ${this.projectsDir}`);
      return [];
    }

    try {
      const entries = await readdir(this.projectsDir);
      const projects: ProjectInfo[] = [];

      for (const entry of entries) {
        const transcriptsDir = join(this.projectsDir, entry, 'agent-transcripts');
        try {
          await access(transcriptsDir);
          const name = this.slugToDisplayName(entry);
          projects.push({ id: entry, name, path: entry });
        } catch {
          // No transcripts directory for this entry
        }
      }

      return projects.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error(`[CursorAdapter] Failed to list projects:`, err);
      return [];
    }
  }

  async listConversations(projectId?: string): Promise<ConversationSummary[]> {
    if (!projectId) return [];

    const transcriptsDir = join(this.projectsDir, projectId, 'agent-transcripts');
    let metadata = new Map<string, { name: string; createdAt?: number; updatedAt?: number }>();
    try {
      metadata = await this.getConversationMetadata(projectId);
    } catch (err) {
      console.warn(`[CursorAdapter] Could not load metadata for ${projectId}, continuing without titles:`, err);
    }

    try {
      const entries = await readdir(transcriptsDir, { withFileTypes: true });
      const conversations: ConversationSummary[] = [];

      for (const entry of entries) {
        try {
          let conversationId: string;
          let filePath: string;

          if (entry.isDirectory()) {
            conversationId = entry.name;
            filePath = join(transcriptsDir, entry.name, `${entry.name}.jsonl`);
          } else if (entry.name.endsWith('.txt')) {
            conversationId = entry.name.replace('.txt', '');
            filePath = join(transcriptsDir, entry.name);
          } else {
            continue;
          }

          await access(filePath);
          const fileStat = await stat(filePath);
          const meta = metadata.get(conversationId);

          conversations.push({
            id: conversationId,
            title: meta?.name || conversationId.substring(0, 8) + '...',
            sourceId: this.id,
            projectId,
            projectName: this.slugToDisplayName(projectId),
            createdAt: meta?.createdAt || fileStat.birthtimeMs,
            updatedAt: meta?.updatedAt || fileStat.mtimeMs,
          });
        } catch {
          // Individual conversation not accessible, skip it
        }
      }

      conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return conversations;
    } catch (err) {
      console.warn(`[CursorAdapter] Could not read transcripts directory ${transcriptsDir}:`, err);
      return [];
    }
  }

  async loadConversation(conversationId: string, projectId?: string): Promise<UnifiedMessage[]> {
    if (!projectId) return [];

    const transcriptsDir = join(this.projectsDir, projectId, 'agent-transcripts');
    let messages: UnifiedMessage[];

    const jsonlPath = join(transcriptsDir, conversationId, `${conversationId}.jsonl`);
    try {
      await access(jsonlPath);
      messages = await this.parseJsonlTranscript(jsonlPath);
    } catch {
      const txtPath = join(transcriptsDir, `${conversationId}.txt`);
      try {
        await access(txtPath);
        messages = await this.parseTxtTranscript(txtPath);
      } catch (err) {
        console.warn(`[CursorAdapter] No readable transcript found for ${conversationId}:`, err);
        return [];
      }
    }

    const subagents = await this.loadSubagents(transcriptsDir, conversationId);
    if (subagents.length > 0) {
      messages = this.placeSubagents(messages, subagents);
    }

    return messages;
  }

  private async loadSubagents(
    transcriptsDir: string,
    conversationId: string,
  ): Promise<{ sub: SubagentConversation; createdAt: number }[]> {
    const subDir = join(transcriptsDir, conversationId, 'subagents');
    try {
      await access(subDir);
    } catch {
      return [];
    }

    const entries = await readdir(subDir);
    const results: { sub: SubagentConversation; createdAt: number }[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue;
      const filePath = join(subDir, entry);
      const subMessages = await this.parseJsonlTranscript(filePath);
      const fileStat = await stat(filePath);
      results.push({
        sub: {
          id: entry.replace('.jsonl', ''),
          messages: subMessages,
          createdAt: fileStat.birthtimeMs,
        },
        createdAt: fileStat.birthtimeMs,
      });
    }

    results.sort((a, b) => a.createdAt - b.createdAt);
    return results;
  }

  private placeSubagents(
    messages: UnifiedMessage[],
    subagents: { sub: SubagentConversation }[],
  ): UnifiedMessage[] {
    const result = [...messages];
    const placed = new Set<number>();

    for (let si = 0; si < subagents.length; si++) {
      const { sub } = subagents[si];
      const subMsg: UnifiedMessage = {
        role: 'subagent',
        content: `Subagent: ${sub.id.substring(0, 8)}`,
        subagent: sub,
      };

      let insertIdx = -1;
      for (let mi = 0; mi < result.length; mi++) {
        if (result[mi].role === 'subagent') continue;
        if (result[mi].content.toLowerCase().includes('subagent')) {
          insertIdx = mi;
          break;
        }
      }

      if (insertIdx >= 0 && !placed.has(insertIdx)) {
        placed.add(insertIdx);
        result.splice(insertIdx, 0, subMsg);
      } else {
        result.push(subMsg);
      }
    }

    return result;
  }

  // --- JSONL Parser ---

  private async parseJsonlTranscript(filePath: string): Promise<UnifiedMessage[]> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      console.error(`[CursorAdapter] Failed to read JSONL file ${filePath}:`, err);
      return [];
    }

    const lines = content.trim().split('\n').filter(l => l.trim());
    const messages: UnifiedMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const role: 'user' | 'assistant' = entry.role === 'assistant' ? 'assistant' : 'user';
        const textParts = (entry.message?.content || [])
          .filter((c: Record<string, unknown>) => c.type === 'text')
          .map((c: Record<string, string>) => c.text);

        if (textParts.length > 0) {
          let text = textParts.join('\n');
          if (role === 'user') {
            text = this.extractUserContent(text);
          }
          if (text) {
            messages.push({ role, content: text });
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    return messages;
  }

  // --- TXT Parser (state machine) ---

  private async parseTxtTranscript(filePath: string): Promise<UnifiedMessage[]> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      console.error(`[CursorAdapter] Failed to read TXT file ${filePath}:`, err);
      return [];
    }

    const lines = content.split('\n');
    const messages: UnifiedMessage[] = [];

    let i = 0;
    while (i < lines.length) {
      if (lines[i] === 'user:') {
        i++;
        const blockLines: string[] = [];
        while (i < lines.length && lines[i] !== 'user:' && lines[i] !== 'assistant:') {
          blockLines.push(lines[i]);
          i++;
        }
        const text = this.extractUserContent(blockLines.join('\n').trim());
        if (text) {
          messages.push({ role: 'user', content: text });
        }
      } else if (lines[i] === 'assistant:') {
        i++;
        i = this.parseAssistantBlock(lines, i, messages);
      } else {
        i++;
      }
    }

    return messages;
  }

  private parseAssistantBlock(lines: string[], startIdx: number, messages: UnifiedMessage[]): number {
    let i = startIdx;
    let assistantText: string[] = [];

    const flushAssistantText = () => {
      const text = assistantText.join('\n').trim();
      if (text) {
        messages.push({ role: 'assistant', content: text });
      }
      assistantText = [];
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line === 'user:' || line === 'assistant:') {
        break;
      }

      if (line.startsWith('[Thinking]')) {
        flushAssistantText();
        const thinkingText = line.substring('[Thinking]'.length).trim();

        const thinkingLines: string[] = [];
        if (thinkingText) thinkingLines.push(thinkingText);
        i++;

        while (i < lines.length) {
          const nextLine = lines[i];
          if (nextLine === 'user:' || nextLine === 'assistant:' ||
              nextLine.startsWith('[Thinking]') ||
              nextLine.startsWith('[Tool call]') ||
              nextLine.startsWith('[Tool result]')) {
            break;
          }
          thinkingLines.push(nextLine);
          i++;
        }

        const fullText = thinkingLines.join('\n').trim();
        if (fullText) {
          messages.push({ role: 'thinking', content: fullText });
        }
        continue;
      }

      if (line.startsWith('[Tool call]')) {
        flushAssistantText();
        const toolName = line.substring('[Tool call]'.length).trim();
        const args: Record<string, string> = {};
        let lastKey = '';
        i++;

        while (i < lines.length) {
          const nextLine = lines[i];
          if (nextLine === 'user:' || nextLine === 'assistant:' ||
              nextLine.startsWith('[Thinking]') ||
              nextLine.startsWith('[Tool call]') ||
              nextLine.startsWith('[Tool result]')) {
            break;
          }
          if (nextLine.startsWith('  ')) {
            const paramLine = nextLine.substring(2);
            const colonIdx = paramLine.indexOf(': ');
            if (colonIdx > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramLine.substring(0, colonIdx))) {
              lastKey = paramLine.substring(0, colonIdx);
              args[lastKey] = paramLine.substring(colonIdx + 2);
            } else if (lastKey) {
              args[lastKey] += '\n' + paramLine;
            }
          } else if (nextLine.trim() === '') {
            lastKey = '';
          }
          i++;
        }

        messages.push({
          role: 'tool_call',
          content: toolName,
          toolCall: { name: toolName, args },
        });
        continue;
      }

      if (line.startsWith('[Tool result]')) {
        flushAssistantText();
        const resultName = line.substring('[Tool result]'.length).trim();
        messages.push({
          role: 'tool_result',
          content: resultName || '(completed)',
          toolResult: { name: resultName, output: '(completed)' },
        });
        i++;
        continue;
      }

      assistantText.push(line);
      i++;
    }

    flushAssistantText();
    return i;
  }

  // --- Content Extraction ---

  private extractUserContent(text: string): string {
    const userQueryMatch = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
    if (userQueryMatch) {
      return userQueryMatch[1].trim();
    }

    let cleaned = text;
    const tagsToStrip = [
      'external_links', 'manually_attached_skills', 'open_and_recently_viewed_files',
      'system_reminder', 'git_status', 'user_info', 'rules', 'agent_skills',
      'agent_transcripts', 'mcp_file_system', 'tool_calling', 'making_code_changes',
      'citing_code', 'inline_line_numbers', 'terminal_files_information',
      'task_management', 'tone_and_style', 'system-communication',
    ];
    for (const tag of tagsToStrip) {
      const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'g');
      cleaned = cleaned.replace(regex, '');
    }

    return cleaned.trim();
  }

  // --- Metadata & Workspace Mapping ---

  private slugToDisplayName(slug: string): string {
    const parts = slug.split('-');
    const codeIndex = parts.indexOf('Code');
    if (codeIndex >= 0 && codeIndex < parts.length - 1) {
      return parts.slice(codeIndex + 1).join('-');
    }
    return parts.slice(-3).join('-');
  }

  private pathToSlug(fsPath: string): string {
    return fsPath
      .replace(/[/\\_. ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/, '');
  }

  private async getConversationMetadata(
    projectId: string
  ): Promise<Map<string, { name: string; createdAt?: number; updatedAt?: number }>> {
    const metadata = new Map<string, { name: string; createdAt?: number; updatedAt?: number }>();

    let workspaceHash: string | null;
    try {
      workspaceHash = await this.findWorkspaceHash(projectId);
    } catch (err) {
      console.warn(`[CursorAdapter] Could not locate workspace storage for ${projectId}:`, err);
      return metadata;
    }

    if (!workspaceHash) return metadata;

    const dbPath = join(this.workspaceStorageDir, workspaceHash, 'state.vscdb');

    try {
      await access(dbPath);
    } catch {
      console.warn(`[CursorAdapter] Workspace database not found: ${dbPath}`);
      return metadata;
    }

    try {
      const result = execSync(
        `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key='composer.composerData';"`,
        { encoding: 'utf-8', timeout: 5000 }
      );

      const data = JSON.parse(result.trim());
      for (const composer of data.allComposers || []) {
        if (composer.composerId) {
          metadata.set(composer.composerId, {
            name: composer.name || composer.composerId,
            createdAt: composer.createdAt,
            updatedAt: composer.lastUpdatedAt,
          });
        }
      }
    } catch (err) {
      console.warn(
        `[CursorAdapter] Could not read metadata from ${dbPath} (sqlite3 may not be installed):`,
        err instanceof Error ? err.message : err
      );
    }

    return metadata;
  }

  private async findWorkspaceHash(projectId: string): Promise<string | null> {
    try {
      const entries = await readdir(this.workspaceStorageDir);

      for (const entry of entries) {
        try {
          const wsJsonPath = join(this.workspaceStorageDir, entry, 'workspace.json');
          const content = await readFile(wsJsonPath, 'utf-8');
          const data = JSON.parse(content);
          const folderUri: string = data.folder || '';

          const folderPath = decodeURIComponent(folderUri.replace('file://', ''));
          const derivedSlug = this.pathToSlug(folderPath);

          if (derivedSlug === projectId) {
            return entry;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // workspaceStorage not accessible
    }

    return null;
  }
}
