import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AdapterRegistry } from './adapters/registry';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ServerOptions {
  port?: number;
  open?: boolean;
}

export async function startServer(opts: ServerOptions = {}): Promise<void> {
  const port = opts.port ?? 3000;
  const app = express();
  const distDir = join(__dirname, '..', 'client');
  const registry = new AdapterRegistry(join(__dirname, '..', '..'));

  app.get('/api/sources', (_req, res) => {
    res.json(registry.getSources());
  });

  app.get('/api/sources/:sourceId/projects', async (req, res) => {
    const adapter = registry.getAdapter(req.params.sourceId);
    if (!adapter) return res.status(404).json({ error: `Source '${req.params.sourceId}' not found` });
    res.json(await adapter.listProjects());
  });

  app.get('/api/sources/:sourceId/conversations', async (req, res) => {
    const adapter = registry.getAdapter(req.params.sourceId);
    if (!adapter) return res.status(404).json({ error: `Source '${req.params.sourceId}' not found` });
    const projectId = (req.query.projectId as string) || undefined;
    res.json(await adapter.listConversations(projectId));
  });

  app.get('/api/sources/:sourceId/conversations/:conversationId', async (req, res) => {
    const adapter = registry.getAdapter(req.params.sourceId);
    if (!adapter) return res.status(404).json({ error: `Source '${req.params.sourceId}' not found` });
    const projectId = (req.query.projectId as string) || undefined;
    const conversationId = decodeURIComponent(req.params.conversationId);
    try {
      const messages = await adapter.loadConversation(conversationId, projectId);
      res.json(messages);
    } catch (err) {
      console.error('[API] Error loading conversation:', err);
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: message });
    }
  });

  app.use(express.static(distDir));

  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Agent Replay running at ${url}`);

    if (opts.open) {
      import('child_process').then(({ exec }) => {
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${url}`);
      });
    }
  });
}
