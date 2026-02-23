import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SamplesAdapter } from './samples';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, '..', '..', '..', 'node_modules', '.tmp', 'test-fixtures-samples');

let projectRoot: string;
let samplesDir: string;
let testId = 0;

beforeEach(async () => {
  testId++;
  projectRoot = join(fixturesRoot, `run-${testId}-${Date.now()}`);
  samplesDir = join(projectRoot, 'samples');
  await mkdir(samplesDir, { recursive: true });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('SamplesAdapter', () => {
  describe('listProjects', () => {
    it('returns a single Samples project when directory exists', async () => {
      const adapter = new SamplesAdapter(projectRoot);
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual({ id: 'samples', name: 'Samples' });
    });

    it('returns empty array when samples directory does not exist', async () => {
      await rm(samplesDir, { recursive: true });
      const adapter = new SamplesAdapter(projectRoot);
      const projects = await adapter.listProjects();

      expect(projects).toEqual([]);
    });
  });

  describe('listConversations', () => {
    it('discovers JSON files as conversations', async () => {
      await writeFile(join(samplesDir, 'demo-chat.json'), '[]');
      await writeFile(join(samplesDir, 'another-test.json'), '[]');

      const adapter = new SamplesAdapter(projectRoot);
      const convs = await adapter.listConversations('samples');

      expect(convs).toHaveLength(2);
      expect(convs.map(c => c.id).sort()).toEqual(['another-test', 'demo-chat']);
    });

    it('formats titles from filenames', async () => {
      await writeFile(join(samplesDir, 'stocksavvy-investigation.json'), '[]');

      const adapter = new SamplesAdapter(projectRoot);
      const convs = await adapter.listConversations('samples');

      expect(convs[0].title).toBe('Stocksavvy Investigation');
    });

    it('ignores non-JSON files', async () => {
      await writeFile(join(samplesDir, 'readme.md'), '# Samples');
      await writeFile(join(samplesDir, 'valid.json'), '[]');

      const adapter = new SamplesAdapter(projectRoot);
      const convs = await adapter.listConversations('samples');

      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('valid');
    });

    it('returns empty array when no JSON files exist', async () => {
      const adapter = new SamplesAdapter(projectRoot);
      const convs = await adapter.listConversations('samples');

      expect(convs).toEqual([]);
    });
  });

  describe('loadConversation - old Gemini API format', () => {
    it('parses user/model text messages', async () => {
      const data = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] },
      ];
      await writeFile(join(samplesDir, 'chat.json'), JSON.stringify(data));

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('chat');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('parses functionCall parts as tool_call', async () => {
      const data = [
        {
          role: 'model',
          parts: [{ functionCall: { name: 'searchDocs', args: { query: 'runbook' } } }],
        },
      ];
      await writeFile(join(samplesDir, 'chat.json'), JSON.stringify(data));

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('chat');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'tool_call',
        content: 'searchDocs',
        toolCall: { name: 'searchDocs', args: { query: 'runbook' } },
      });
    });

    it('parses functionResponse parts as tool_result', async () => {
      const data = [
        {
          role: 'user',
          parts: [{
            functionResponse: {
              id: 'call-1',
              name: 'searchDocs',
              response: { output: 'Found 3 results' },
            },
          }],
        },
      ];
      await writeFile(join(samplesDir, 'chat.json'), JSON.stringify(data));

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('chat');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'tool_result',
        content: 'Found 3 results',
        toolResult: { name: 'searchDocs', output: 'Found 3 results' },
      });
    });
  });

  describe('loadConversation - UnifiedMessage format', () => {
    it('passes through UnifiedMessage arrays directly', async () => {
      const data = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'thinking', content: 'Let me think...' },
      ];
      await writeFile(join(samplesDir, 'chat.json'), JSON.stringify(data));

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('chat');

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[2]).toEqual({ role: 'thinking', content: 'Let me think...' });
    });
  });

  describe('loadConversation - error handling', () => {
    it('returns empty array for non-existent file', async () => {
      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('nonexistent');

      expect(messages).toEqual([]);
    });

    it('returns empty array for corrupt JSON', async () => {
      await writeFile(join(samplesDir, 'bad.json'), '{{invalid');

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('bad');

      expect(messages).toEqual([]);
    });

    it('returns empty array for empty JSON array', async () => {
      await writeFile(join(samplesDir, 'empty.json'), '[]');

      const adapter = new SamplesAdapter(projectRoot);
      const messages = await adapter.loadConversation('empty');

      expect(messages).toEqual([]);
    });
  });
});
