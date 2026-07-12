/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

import { initializePrismaDb, DbService } from './src/server/db.js';
import { createApp } from './src/server/app.js';

const PORT = 3000;

async function startServer() {
  // Initialise DB connection + resolve default tenant ID
  await initializePrismaDb();

  // Create Express app using the shared factory (which includes CORS, requireRole, etc.)
  const app = createApp();

  // ─────────────────────────────────────────────
  // VITE / STATIC MIDDLEWARE
  // ─────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Seed endpoint for convenience
  app.post('/api/db/reset', async (req: Request, res: Response) => {
    try {
      await DbService.generateSeedData();
      res.json({ success: true, message: 'Re-run `npm run seed` to reset data.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SeatAllocationApp] Running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
