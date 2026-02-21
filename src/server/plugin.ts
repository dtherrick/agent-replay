import type { Plugin } from 'vite';
import { AdapterRegistry } from './adapters/registry';

type ApiResponse = { setHeader: (k: string, v: string) => void; end: (body: string) => void; statusCode: number };

export function chatPlaybackPlugin(): Plugin {
  let registry: AdapterRegistry;

  return {
    name: 'chat-playback',
    configureServer(server) {
      registry = new AdapterRegistry(server.config.root);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

          if (url.pathname === '/api/sources') {
            return sendJson(res, registry.getSources());
          }

          const projectsMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/projects$/);
          if (projectsMatch) {
            const adapter = registry.getAdapter(projectsMatch[1]);
            if (!adapter) return sendError(res, 404, `Source '${projectsMatch[1]}' not found`);
            return sendJson(res, await adapter.listProjects());
          }

          const convsMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/conversations$/);
          if (convsMatch) {
            const adapter = registry.getAdapter(convsMatch[1]);
            if (!adapter) return sendError(res, 404, `Source '${convsMatch[1]}' not found`);
            const projectId = url.searchParams.get('projectId') || undefined;
            return sendJson(res, await adapter.listConversations(projectId));
          }

          const convMatch = url.pathname.match(
            /^\/api\/sources\/([^/]+)\/conversations\/([^/]+)$/
          );
          if (convMatch) {
            const adapter = registry.getAdapter(convMatch[1]);
            if (!adapter) return sendError(res, 404, `Source '${convMatch[1]}' not found`);
            const projectId = url.searchParams.get('projectId') || undefined;
            const conversationId = decodeURIComponent(convMatch[2]);
            const messages = await adapter.loadConversation(conversationId, projectId);
            if (messages.length === 0) {
              return sendJson(res, [], 200);
            }
            return sendJson(res, messages);
          }

          next();
        } catch (err) {
          console.error('[API] Unhandled error:', err);
          const message = err instanceof Error ? err.message : 'Internal server error';
          sendError(res as ApiResponse, 500, message);
        }
      });
    },
  };
}

function sendJson(res: ApiResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ApiResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}
