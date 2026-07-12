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

import { DbService, generateSeedData } from './src/server/db.js';
import { processAssistantQuery } from './src/server/gemini.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// --- REST API ENDPOINTS ---

// 1. Get Seating & Employee Stats
app.get('/api/stats', (req: Request, res: Response) => {
  try {
    const stats = DbService.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Projects Endpoints
app.get('/api/projects', (req: Request, res: Response) => {
  try {
    const projects = DbService.getProjects();
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', (req: Request, res: Response) => {
  try {
    const { code, name, lead, targetZone } = req.body;
    if (!code || !name || !lead || !targetZone) {
      res.status(400).json({ error: 'Missing required project parameters: code, name, lead, targetZone' });
      return;
    }
    const newProj = DbService.createProject({ code, name, lead, targetZone });
    res.json(newProj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Employees Endpoints (supports massive scale searching and pagination)
app.get('/api/employees', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const textSearch = (req.query.textSearch as string || '');
    const projectCode = (req.query.projectCode as string || '');
    const floor = req.query.floor ? parseInt(req.query.floor as string, 10) : null;
    const zone = (req.query.zone as string || '');
    const isUnassigned = req.query.isUnassigned === 'true';

    const result = DbService.getEmployees(limit, offset, textSearch, projectCode, floor, zone, isUnassigned);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', (req: Request, res: Response) => {
  try {
    const emp = DbService.getEmployeeById(req.params.id);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.json(emp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/employees/:id', (req: Request, res: Response) => {
  try {
    const result = DbService.updateEmployee(req.params.id, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Seats Endpoints
app.get('/api/seats', (req: Request, res: Response) => {
  try {
    const floor = parseInt(req.query.floor as string || '1', 10);
    const zone = (req.query.zone as string || 'A').toUpperCase();
    const seats = DbService.getSeats(floor, zone);
    res.json(seats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seats/utilization', (req: Request, res: Response) => {
  try {
    const util = DbService.getSeatMapUtilization();
    res.json(util);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/allocate', (req: Request, res: Response) => {
  try {
    const { employeeId, seatId } = req.body;
    if (!employeeId || !seatId) {
      res.status(400).json({ error: 'Missing employeeId or seatId' });
      return;
    }
    const result = DbService.allocateSeat(employeeId, seatId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/release', (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      res.status(400).json({ error: 'Missing employeeId' });
      return;
    }
    const result = DbService.releaseSeat(employeeId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/auto-allocate', (req: Request, res: Response) => {
  try {
    const result = DbService.autoAllocateJoiners();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Recent Logs
app.get('/api/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const logs = DbService.getLogs(limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Regenerate database seeds (useful for Admin / Demo)
app.post('/api/db/reset', (req: Request, res: Response) => {
  try {
    generateSeedData();
    res.json({ success: true, message: 'Database reset and fully seeded with 5,000 employees.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Server-side Gemini AI workspace query assistant
app.post('/api/assistant', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Missing query in body' });
      return;
    }
    const response = await processAssistantQuery(query);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SeatAllocationApp] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
