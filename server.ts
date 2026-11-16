import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { applySyncOperations, pullUserSnapshot, SyncOperationPayload } from './src/db/sync.ts';
import { deleteUserRecord } from './src/db/users.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'savern-api' });
  });

  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({
      uid: req.user?.uid,
      email: req.user?.email,
      name: req.user?.name || null,
      picture: req.user?.picture || null,
    });
  });

  app.get('/api/sync/pull', requireAuth, async (req: AuthRequest, res) => {
    try {
      const snapshot = await pullUserSnapshot(req.user!.uid);
      res.json({
        syncedAt: new Date().toISOString(),
        snapshot,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to pull cloud records';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/sync/push', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ops = Array.isArray(req.body?.operations) ? (req.body.operations as SyncOperationPayload[]) : [];
      if (ops.length > 200) {
        return res.status(400).json({ error: 'Batch size exceeds limit of 200 operations.' });
      }
      const results = await applySyncOperations(req.user!.uid, ops);
      res.json({
        syncedAt: new Date().toISOString(),
        results,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to push sync operations';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/account', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteUserRecord(req.user!.uid);
      res.json({ deleted: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SAVERN server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
