import fs from 'fs';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import storageHandler from './api/storage';

function getAncestorPids(): Set<number> {
  const ancestors = new Set<number>();
  let current = process.pid;
  while (current > 1 && !ancestors.has(current)) {
    ancestors.add(current);
    try {
      const stat = fs.readFileSync(`/proc/${current}/stat`, 'utf-8');
      const afterComm = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      const ppid = Number(afterComm[1]);
      if (!Number.isInteger(ppid) || ppid <= 1) break;
      current = ppid;
    } catch {
      break;
    }
  }
  return ancestors;
}

function killOrphanedServerProcesses() {
  try {
    const protectedPids = getAncestorPids();
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      const pid = Number(entry);
      if (!Number.isInteger(pid) || pid <= 1 || protectedPids.has(pid)) {
        continue;
      }
      try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
        if (cmdline.includes('server.ts')) {
          process.kill(pid, 'SIGKILL');
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Vercel-compatible Serverless Storage API route
  app.all('/api/storage', async (req, res) => {
    await storageHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  let retries = 0;
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retries < 3) {
      retries += 1;
      killOrphanedServerProcesses();
      setTimeout(() => {
        server.close();
        server.listen(PORT, '0.0.0.0');
      }, 300);
      return;
    }
    console.error('Server error:', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 500).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
