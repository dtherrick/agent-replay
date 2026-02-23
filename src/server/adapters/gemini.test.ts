import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GeminiAdapter } from './gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, '..', '..', '..', 'node_modules', '.tmp', 'test-fixtures-gemini');

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => testHome };
});

let testHome: string;
let geminiDir: string;
let testId = 0;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'test-session-id',
    projectHash: 'abc123',
    startTime: '2026-01-15T10:00:00.000Z',
    lastUpdated: '2026-01-15T10:30:00.000Z',
    messages: [],
    ...overrides,
  };
}

async function createProjectWithSession(
  projectHash: string,
  sessionName: string,
  session: Record<string, unknown>,
): Promise<string> {
  const chatsDir = join(geminiDir, projectHash, 'chats');
  await mkdir(chatsDir, { recursive: true });
  await writeFile(join(chatsDir, `${sessionName}.json`), JSON.stringify(session));
  return chatsDir;
}

beforeEach(async () => {
  testId++;
  testHome = join(fixturesRoot, `run-${testId}-${Date.now()}`);
  geminiDir = join(testHome, '.gemini', 'tmp');
  await mkdir(geminiDir, { recursive: true });
});

afterEach(async () => {
  await rm(testHome, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('GeminiAdapter', () => {
  describe('listProjects', () => {
    it('discovers project directories with chats/ subdirectories', async () => {
      const hash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      await createProjectWithSession(hash, 'session-2026-01-15', makeSession());

      const adapter = new GeminiAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(hash);
      expect(projects[0].name).toBe('a1b2c3d4...');
    });

    it('skips the bin directory', async () => {
      await mkdir(join(geminiDir, 'bin'), { recursive: true });
      const hash = 'abc12345deadbeef';
      await createProjectWithSession(hash, 'session-1', makeSession());

      const adapter = new GeminiAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(hash);
    });

    it('skips directories without a chats/ subdirectory', async () => {
      await mkdir(join(geminiDir, 'somehash'), { recursive: true });

      const adapter = new GeminiAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toEqual([]);
    });

    it('returns empty array when .gemini/tmp does not exist', async () => {
      await rm(geminiDir, { recursive: true });

      const adapter = new GeminiAdapter();
      const projects = await adapter.listProjects();

      expect(projects).toEqual([]);
    });
  });

  describe('listConversations', () => {
    it('returns empty array when projectId is not provided', async () => {
      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations();

      expect(convs).toEqual([]);
    });

    it('lists sessions with titles from first user message', async () => {
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'user', content: 'How do I deploy?' },
          { id: '2', timestamp: '2026-01-15T10:01:00Z', type: 'gemini', content: 'Here is how...' },
        ],
      });
      await createProjectWithSession('proj-hash', 'session-2026-01-15T10-00-abc123', session);

      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations('proj-hash');

      expect(convs).toHaveLength(1);
      expect(convs[0].title).toBe('How do I deploy?');
      expect(convs[0].id).toBe('session-2026-01-15T10-00-abc123');
      expect(convs[0].sourceId).toBe('gemini');
    });

    it('truncates long titles', async () => {
      const longText = 'A'.repeat(100);
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'user', content: longText },
        ],
      });
      await createProjectWithSession('proj-hash', 'session-long', session);

      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations('proj-hash');

      expect(convs[0].title.length).toBeLessThanOrEqual(60);
      expect(convs[0].title).toMatch(/\.\.\.$/);
    });

    it('uses filename as title when no user message exists', async () => {
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'error', content: 'MCP error' },
        ],
      });
      await createProjectWithSession('proj-hash', 'session-error-only', session);

      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations('proj-hash');

      expect(convs[0].title).toBe('session-error-only');
    });

    it('returns empty array for non-existent project', async () => {
      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations('nonexistent');

      expect(convs).toEqual([]);
    });

    it('uses startTime/lastUpdated for dates', async () => {
      const session = makeSession({
        startTime: '2026-02-01T08:00:00.000Z',
        lastUpdated: '2026-02-01T09:30:00.000Z',
      });
      await createProjectWithSession('proj-hash', 'session-dated', session);

      const adapter = new GeminiAdapter();
      const convs = await adapter.listConversations('proj-hash');

      expect(convs[0].createdAt).toBe(new Date('2026-02-01T08:00:00.000Z').getTime());
      expect(convs[0].updatedAt).toBe(new Date('2026-02-01T09:30:00.000Z').getTime());
    });
  });

  describe('loadConversation', () => {
    it('returns empty array when projectId is not provided', async () => {
      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-1');

      expect(messages).toEqual([]);
    });

    it('parses user and gemini messages', async () => {
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'user', content: 'Hello' },
          { id: '2', timestamp: '2026-01-15T10:01:00Z', type: 'gemini', content: 'Hi there!' },
        ],
      });
      await createProjectWithSession('proj', 'session-basic', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-basic', 'proj');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello', timestamp: expect.any(Number) });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!', timestamp: expect.any(Number) });
    });

    it('emits thinking messages from gemini thoughts', async () => {
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'user', content: 'Explain X' },
          {
            id: '2',
            timestamp: '2026-01-15T10:01:00Z',
            type: 'gemini',
            content: 'Here is the explanation.',
            thoughts: [
              { subject: 'Analysis', description: 'Let me think about X carefully.', timestamp: '2026-01-15T10:00:30Z' },
              { subject: 'Approach', description: 'I will explain step by step.', timestamp: '2026-01-15T10:00:45Z' },
            ],
          },
        ],
      });
      await createProjectWithSession('proj', 'session-thoughts', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-thoughts', 'proj');

      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe('user');
      expect(messages[1]).toEqual({ role: 'thinking', content: 'Let me think about X carefully.', timestamp: expect.any(Number) });
      expect(messages[2]).toEqual({ role: 'thinking', content: 'I will explain step by step.', timestamp: expect.any(Number) });
      expect(messages[3]).toEqual({ role: 'assistant', content: 'Here is the explanation.', timestamp: expect.any(Number) });
    });

    it('skips error messages', async () => {
      const session = makeSession({
        messages: [
          { id: '1', timestamp: '2026-01-15T10:00:00Z', type: 'error', content: 'MCP connection failed' },
          { id: '2', timestamp: '2026-01-15T10:01:00Z', type: 'user', content: 'Hello' },
          { id: '3', timestamp: '2026-01-15T10:02:00Z', type: 'gemini', content: 'Hi!' },
        ],
      });
      await createProjectWithSession('proj', 'session-errors', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-errors', 'proj');

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('parses tool_use messages', async () => {
      const session = makeSession({
        messages: [
          {
            id: '1',
            timestamp: '2026-01-15T10:00:00Z',
            type: 'tool_use',
            content: 'read_file',
            toolName: 'read_file',
            args: { path: '/src/main.ts' },
          },
        ],
      });
      await createProjectWithSession('proj', 'session-tools', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-tools', 'proj');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'tool_call',
        content: 'read_file',
        toolCall: { name: 'read_file', args: { path: '/src/main.ts' } },
        timestamp: expect.any(Number),
      });
    });

    it('parses tool_result messages', async () => {
      const session = makeSession({
        messages: [
          {
            id: '1',
            timestamp: '2026-01-15T10:00:00Z',
            type: 'tool_result',
            content: 'File contents here',
            toolName: 'read_file',
            output: 'File contents here',
          },
        ],
      });
      await createProjectWithSession('proj', 'session-results', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-results', 'proj');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'tool_result',
        content: 'File contents here',
        toolResult: { name: 'read_file', output: 'File contents here' },
        timestamp: expect.any(Number),
      });
    });

    it('returns empty array for non-existent session file', async () => {
      await mkdir(join(geminiDir, 'proj', 'chats'), { recursive: true });

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('nonexistent', 'proj');

      expect(messages).toEqual([]);
    });

    it('returns empty array for corrupt JSON', async () => {
      const chatsDir = join(geminiDir, 'proj', 'chats');
      await mkdir(chatsDir, { recursive: true });
      await writeFile(join(chatsDir, 'bad-session.json'), '{ not valid json !!!');

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('bad-session', 'proj');

      expect(messages).toEqual([]);
    });

    it('handles session with empty messages array', async () => {
      const session = makeSession({ messages: [] });
      await createProjectWithSession('proj', 'session-empty', session);

      const adapter = new GeminiAdapter();
      const messages = await adapter.loadConversation('session-empty', 'proj');

      expect(messages).toEqual([]);
    });
  });
});
