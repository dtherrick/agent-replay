import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CursorAdapter } from './cursor';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, '..', '..', '..', 'node_modules', '.tmp', 'test-fixtures');

let projectsDir: string;
let fixtureRoot: string;
let testId = 0;

function createAdapter(): CursorAdapter {
  return new CursorAdapter(projectsDir, join(fixtureRoot, 'workspaceStorage'));
}

async function createTranscriptsDir(projectSlug: string): Promise<string> {
  const dir = join(projectsDir, projectSlug, 'agent-transcripts');
  await mkdir(dir, { recursive: true });
  return dir;
}

beforeEach(async () => {
  testId++;
  fixtureRoot = join(fixturesRoot, `run-${testId}-${Date.now()}`);
  projectsDir = join(fixtureRoot, 'projects');
  await mkdir(projectsDir, { recursive: true });
});

afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe('CursorAdapter', () => {
  describe('listProjects', () => {
    it('returns projects that have agent-transcripts directories', async () => {
      await createTranscriptsDir('Users-alice-Code-my-project');
      await mkdir(join(projectsDir, 'Users-bob-Code-no-transcripts'), { recursive: true });

      const adapter = createAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('Users-alice-Code-my-project');
      expect(projects[0].name).toBe('my-project');
    });

    it('returns empty array when projects directory does not exist', async () => {
      await rm(projectsDir, { recursive: true });

      const adapter = createAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toEqual([]);
    });

    it('returns sorted projects', async () => {
      await createTranscriptsDir('Users-x-Code-zebra');
      await createTranscriptsDir('Users-x-Code-alpha');
      await createTranscriptsDir('Users-x-Code-middle');

      const adapter = createAdapter();
      const projects = await adapter.listProjects();

      expect(projects.map(p => p.name)).toEqual(['alpha', 'middle', 'zebra']);
    });
  });

  describe('listConversations', () => {
    it('returns empty array when projectId is not provided', async () => {
      const adapter = createAdapter();
      const convs = await adapter.listConversations();

      expect(convs).toEqual([]);
    });

    it('discovers .txt transcript files', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      await writeFile(join(dir, 'abc12345-1234-5678-9abc-def012345678.txt'), 'user:\nHello\n');

      const adapter = createAdapter();
      const convs = await adapter.listConversations('Users-x-Code-proj');

      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('abc12345-1234-5678-9abc-def012345678');
      expect(convs[0].sourceId).toBe('cursor');
    });

    it('discovers .jsonl transcript directories', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir, { recursive: true });
      await writeFile(join(convDir, 'conv-001.jsonl'), '');

      const adapter = createAdapter();
      const convs = await adapter.listConversations('Users-x-Code-proj');

      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('conv-001');
    });

    it('returns empty array for non-existent transcripts directory', async () => {
      await mkdir(join(projectsDir, 'Users-x-Code-empty'), { recursive: true });

      const adapter = createAdapter();
      const convs = await adapter.listConversations('Users-x-Code-empty');

      expect(convs).toEqual([]);
    });

    it('skips non-txt files that are not directories', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      await writeFile(join(dir, 'readme.md'), 'ignore me');
      await writeFile(join(dir, 'conv.txt'), 'user:\nHi\n');

      const adapter = createAdapter();
      const convs = await adapter.listConversations('Users-x-Code-proj');

      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('conv');
    });
  });

  describe('loadConversation - JSONL format', () => {
    it('parses user and assistant messages from JSONL', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      const lines = [
        JSON.stringify({
          role: 'user',
          message: { content: [{ type: 'text', text: 'What is 2+2?' }] },
        }),
        JSON.stringify({
          role: 'assistant',
          message: { content: [{ type: 'text', text: 'The answer is 4.' }] },
        }),
      ];
      await writeFile(join(convDir, 'conv-001.jsonl'), lines.join('\n'));

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'What is 2+2?' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'The answer is 4.' });
    });

    it('extracts user_query tags from user messages', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      const lines = [
        JSON.stringify({
          role: 'user',
          message: {
            content: [{
              type: 'text',
              text: '<system_reminder>stuff</system_reminder>\n<user_query>\nPlease help me\n</user_query>',
            }],
          },
        }),
      ];
      await writeFile(join(convDir, 'conv-001.jsonl'), lines.join('\n'));

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Please help me');
    });

    it('skips malformed JSON lines without crashing', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      const lines = [
        '{ this is not valid json',
        JSON.stringify({
          role: 'assistant',
          message: { content: [{ type: 'text', text: 'Valid line.' }] },
        }),
        '}}}}',
      ];
      await writeFile(join(convDir, 'conv-001.jsonl'), lines.join('\n'));

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Valid line.');
    });

    it('returns empty array for empty JSONL file', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);
      await writeFile(join(convDir, 'conv-001.jsonl'), '');

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages).toEqual([]);
    });
  });

  describe('loadConversation - TXT format', () => {
    it('parses basic user/assistant conversation', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'user:',
        'Hello, how are you?',
        'assistant:',
        'I am doing well, thank you!',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello, how are you?' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'I am doing well, thank you!' });
    });

    it('parses thinking blocks', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'assistant:',
        '[Thinking] Let me consider this...',
        'more thinking here',
        '[Tool call] Read',
        '  path: /tmp/file.ts',
        '[Tool result] Read',
        'Here is my answer.',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(4);
      expect(messages[0]).toEqual({
        role: 'thinking',
        content: 'Let me consider this...\nmore thinking here',
      });
      expect(messages[3]).toEqual({ role: 'assistant', content: 'Here is my answer.' });
    });

    it('parses tool calls with parameters', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'assistant:',
        '[Tool call] Read',
        '  path: /src/main.ts',
        '  encoding: utf-8',
        '[Tool result] Read',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'tool_call',
        content: 'Read',
        toolCall: {
          name: 'Read',
          args: { path: '/src/main.ts', encoding: 'utf-8' },
        },
      });
      expect(messages[1]).toEqual({
        role: 'tool_result',
        content: 'Read',
        toolResult: { name: 'Read', output: '(completed)' },
      });
    });

    it('parses a complex multi-turn conversation', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'user:',
        'Fix the bug',
        'assistant:',
        '[Thinking] I see the issue.',
        '[Tool call] Write',
        '  path: /fix.ts',
        '  content: fixed code',
        '[Tool result] Write',
        'Done! I fixed the bug.',
        'user:',
        'Thanks!',
        'assistant:',
        'You are welcome!',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(7);
      expect(messages.map(m => m.role)).toEqual([
        'user', 'thinking', 'tool_call', 'tool_result', 'assistant', 'user', 'assistant',
      ]);
      expect(messages[4].content).toBe('Done! I fixed the bug.');
      expect(messages[6].content).toBe('You are welcome!');
    });

    it('strips system tags from user messages', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'user:',
        '<git_status>some git info</git_status>',
        '<user_info>info</user_info>',
        'Can you help me?',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Can you help me?');
    });
  });

  describe('loadConversation - error handling', () => {
    it('returns empty array when no transcript file exists', async () => {
      await createTranscriptsDir('Users-x-Code-proj');

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('nonexistent', 'Users-x-Code-proj');

      expect(messages).toEqual([]);
    });

    it('returns empty array when projectId is not provided', async () => {
      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv');

      expect(messages).toEqual([]);
    });

    it('prefers JSONL over TXT when both exist', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv');
      await mkdir(convDir);
      await writeFile(
        join(convDir, 'conv.jsonl'),
        JSON.stringify({
          role: 'assistant',
          message: { content: [{ type: 'text', text: 'From JSONL' }] },
        })
      );
      await writeFile(join(dir, 'conv.txt'), 'assistant:\nFrom TXT');

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('From JSONL');
    });
  });

  describe('content extraction', () => {
    it('extracts user_query when present alongside system tags', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'user:',
        '<rules>lots of rules</rules>',
        '<agent_skills>skill info</agent_skills>',
        '<user_query>',
        'Deploy the application',
        '</user_query>',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Deploy the application');
    });

    it('strips all known system tags when no user_query tag exists', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const content = [
        'user:',
        '<open_and_recently_viewed_files>files</open_and_recently_viewed_files>',
        '<system_reminder>reminder</system_reminder>',
        'Actual user question here',
      ].join('\n');
      await writeFile(join(dir, 'conv.txt'), content);

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv', 'Users-x-Code-proj');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Actual user question here');
    });
  });

  describe('loadConversation - subagent discovery', () => {
    it('loads subagent conversations from subagents/ directory', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      await writeFile(join(convDir, 'conv-001.jsonl'), [
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Build a dashboard' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'The subagent built the dashboard.' }] } }),
      ].join('\n'));

      const subDir = join(convDir, 'subagents');
      await mkdir(subDir);
      await writeFile(join(subDir, 'sub-aaa.jsonl'), [
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Build it' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Done building.' }] } }),
      ].join('\n'));

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      const subagentMsgs = messages.filter(m => m.role === 'subagent');
      expect(subagentMsgs).toHaveLength(1);
      expect(subagentMsgs[0].subagent).toBeDefined();
      expect(subagentMsgs[0].subagent!.id).toBe('sub-aaa');
      expect(subagentMsgs[0].subagent!.messages).toHaveLength(2);
      expect(subagentMsgs[0].subagent!.messages[0].content).toBe('Build it');
    });

    it('places subagent before the message that mentions "subagent"', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      await writeFile(join(convDir, 'conv-001.jsonl'), [
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Build something' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Let me plan this.' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'The subagent finished the work.' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'All done.' }] } }),
      ].join('\n'));

      const subDir = join(convDir, 'subagents');
      await mkdir(subDir);
      await writeFile(join(subDir, 'sub-bbb.jsonl'),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Subagent work.' }] } })
      );

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      const roles = messages.map(m => m.role);
      const subIdx = roles.indexOf('subagent');
      expect(subIdx).toBeGreaterThan(0);
      expect(messages[subIdx + 1].content).toContain('subagent finished');
    });

    it('appends subagent at end when no text mentions "subagent"', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      await writeFile(join(convDir, 'conv-001.jsonl'), [
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Hello' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Hi there' }] } }),
      ].join('\n'));

      const subDir = join(convDir, 'subagents');
      await mkdir(subDir);
      await writeFile(join(subDir, 'sub-ccc.jsonl'),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Work done.' }] } })
      );

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages[messages.length - 1].role).toBe('subagent');
    });

    it('does not affect conversations without subagents', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      await writeFile(join(convDir, 'conv-001.jsonl'), [
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Hello' }] } }),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }),
      ].join('\n'));

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.role !== 'subagent')).toBe(true);
    });

    it('loads multiple subagents sorted by creation time', async () => {
      const dir = await createTranscriptsDir('Users-x-Code-proj');
      const convDir = join(dir, 'conv-001');
      await mkdir(convDir);

      await writeFile(join(convDir, 'conv-001.jsonl'),
        JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Go' }] } })
      );

      const subDir = join(convDir, 'subagents');
      await mkdir(subDir);
      await writeFile(join(subDir, 'sub-first.jsonl'),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'First' }] } })
      );
      // Small delay so the second file has a later timestamp
      await new Promise(r => setTimeout(r, 50));
      await writeFile(join(subDir, 'sub-second.jsonl'),
        JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Second' }] } })
      );

      const adapter = createAdapter();
      const messages = await adapter.loadConversation('conv-001', 'Users-x-Code-proj');

      const subs = messages.filter(m => m.role === 'subagent');
      expect(subs).toHaveLength(2);
      expect(subs[0].subagent!.id).toBe('sub-first');
      expect(subs[1].subagent!.id).toBe('sub-second');
    });
  });

  describe('slugToDisplayName (via listProjects)', () => {
    it('extracts project name after Code segment', async () => {
      await createTranscriptsDir('Users-dherrick-Code-agent-replay');

      const adapter = createAdapter();
      const projects = await adapter.listProjects();

      expect(projects[0].name).toBe('agent-replay');
    });

    it('falls back to last 3 segments when no Code segment', async () => {
      await createTranscriptsDir('some-random-project-name-here');

      const adapter = createAdapter();
      const projects = await adapter.listProjects();

      expect(projects[0].name).toBe('project-name-here');
    });
  });
});
