import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatPlaybackPlugin } from './plugin';
import type { Plugin, ViteDevServer } from 'vite';

vi.mock('./adapters/registry', () => {
  return {
    AdapterRegistry: function () {
      return {
        getSources: () => [
          { id: 'test-source', name: 'Test Source' },
        ],
        getAdapter: (id: string) => {
          if (id === 'test-source') return mockAdapter;
          return undefined;
        },
      };
    },
  };
});

const mockAdapter = {
  id: 'test-source',
  name: 'Test Source',
  listProjects: vi.fn().mockResolvedValue([
    { id: 'proj-1', name: 'Project One' },
  ]),
  listConversations: vi.fn().mockResolvedValue([
    { id: 'conv-1', title: 'Test Conversation', sourceId: 'test-source' },
  ]),
  loadConversation: vi.fn().mockResolvedValue([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ]),
};

type Middleware = (
  req: { url?: string; headers: Record<string, string> },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body: string) => void },
  next: () => void,
) => Promise<void>;

let middleware: Middleware;
let plugin: Plugin;

beforeEach(() => {
  vi.clearAllMocks();
  plugin = chatPlaybackPlugin();

  let capturedMiddleware: Middleware | null = null;
  const mockServer = {
    config: { root: '/fake/root' },
    middlewares: {
      use: (mw: Middleware) => { capturedMiddleware = mw; },
    },
  };

  (plugin as { configureServer: (s: unknown) => void }).configureServer(mockServer as unknown as ViteDevServer);
  middleware = capturedMiddleware!;
});

function createMockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(k: string, v: string) { this.headers[k] = v; },
    end(body: string) { this.body = body; },
  };
}

describe('chatPlaybackPlugin middleware', () => {
  it('passes non-API requests to next()', async () => {
    const next = vi.fn();
    const res = createMockRes();

    await middleware({ url: '/index.html', headers: {} }, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.body).toBe('');
  });

  it('GET /api/sources returns list of sources', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware({ url: '/api/sources', headers: { host: 'localhost:5173' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('application/json');
    const data = JSON.parse(res.body);
    expect(data).toEqual([{ id: 'test-source', name: 'Test Source' }]);
  });

  it('GET /api/sources/:id/projects returns projects', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/projects', headers: { host: 'localhost' } },
      res, next,
    );

    expect(mockAdapter.listProjects).toHaveBeenCalled();
    const data = JSON.parse(res.body);
    expect(data).toEqual([{ id: 'proj-1', name: 'Project One' }]);
  });

  it('GET /api/sources/:id/conversations returns conversations', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/conversations?projectId=proj-1', headers: { host: 'localhost' } },
      res, next,
    );

    expect(mockAdapter.listConversations).toHaveBeenCalledWith('proj-1');
    const data = JSON.parse(res.body);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Test Conversation');
  });

  it('GET /api/sources/:id/conversations/:convId loads a conversation', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/conversations/conv-1?projectId=proj-1', headers: { host: 'localhost' } },
      res, next,
    );

    expect(mockAdapter.loadConversation).toHaveBeenCalledWith('conv-1', 'proj-1');
    const data = JSON.parse(res.body);
    expect(data).toHaveLength(2);
    expect(data[0].role).toBe('user');
  });

  it('returns 404 with message for unknown source on projects route', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/unknown-source/projects', headers: { host: 'localhost' } },
      res, next,
    );

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res.body);
    expect(data.error).toContain('unknown-source');
  });

  it('returns 404 with message for unknown source on conversations route', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/unknown-source/conversations', headers: { host: 'localhost' } },
      res, next,
    );

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res.body);
    expect(data.error).toContain('unknown-source');
  });

  it('returns 404 with message for unknown source on single conversation route', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/unknown-source/conversations/conv-1', headers: { host: 'localhost' } },
      res, next,
    );

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res.body);
    expect(data.error).toContain('unknown-source');
  });

  it('returns 500 with error message when adapter throws', async () => {
    mockAdapter.listProjects.mockRejectedValueOnce(new Error('Disk read failed'));
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/projects', headers: { host: 'localhost' } },
      res, next,
    );

    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Disk read failed');
  });

  it('decodes URL-encoded conversation IDs', async () => {
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/conversations/conv%20with%20spaces?projectId=proj-1', headers: { host: 'localhost' } },
      res, next,
    );

    expect(mockAdapter.loadConversation).toHaveBeenCalledWith('conv with spaces', 'proj-1');
  });

  it('returns empty array (200) when conversation has no messages', async () => {
    mockAdapter.loadConversation.mockResolvedValueOnce([]);
    const res = createMockRes();
    const next = vi.fn();

    await middleware(
      { url: '/api/sources/test-source/conversations/empty?projectId=proj-1', headers: { host: 'localhost' } },
      res, next,
    );

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toEqual([]);
  });
});
