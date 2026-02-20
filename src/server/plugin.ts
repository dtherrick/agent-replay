import type { Plugin } from 'vite';
import { AdapterRegistry } from './adapters/registry';

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
            if (!adapter) return send404(res);
            return sendJson(res, await adapter.listProjects());
          }

          const convsMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/conversations$/);
          if (convsMatch) {
            const adapter = registry.getAdapter(convsMatch[1]);
            if (!adapter) return send404(res);
            const projectId = url.searchParams.get('projectId') || undefined;
            return sendJson(res, await adapter.listConversations(projectId));
          }

          const convMatch = url.pathname.match(
            /^\/api\/sources\/([^/]+)\/conversations\/([^/]+)$/
          );
          if (convMatch) {
            const adapter = registry.getAdapter(convMatch[1]);
            if (!adapter) return send404(res);
            const projectId = url.searchParams.get('projectId') || undefined;
            return sendJson(
              res,
              await adapter.loadConversation(decodeURIComponent(convMatch[2]), projectId)
            );
          }

          next();
        } catch (err) {
          console.error('Chat playback API error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    },
  };
}

function sendJson(res: { setHeader: Function; end: Function }, data: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function send404(res: { statusCode: number; setHeader: Function; end: Function }): void {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}
