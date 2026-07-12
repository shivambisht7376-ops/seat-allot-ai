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
import { processAssistantQuery } from './src/server/gemini.js';
import { loginHandler, authenticateToken } from './src/server/auth.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ─────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ─────────────────────────────────────────────

// Auth: login
app.post('/api/auth/login', loginHandler);

// ─────────────────────────────────────────────
// PROTECTED ROUTES (Bearer JWT required)
// ─────────────────────────────────────────────
app.use('/api', authenticateToken);

// 1. Stats
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = await DbService.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Projects
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await DbService.getProjects();
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req: Request, res: Response) => {
  try {
    const { code, name, lead, targetZone } = req.body;
    if (!code || !name || !lead || !targetZone) {
      res.status(400).json({ error: 'Missing required project parameters: code, name, lead, targetZone' });
      return;
    }
    const newProj = await DbService.createProject({ code, name, lead, targetZone });
    res.status(201).json(newProj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:code — single project
app.get('/api/projects/:code', async (req: Request, res: Response) => {
  try {
    const proj = await DbService.getProjectByCode(req.params.code);
    if (!proj) {
      res.status(404).json({ error: `Project ${req.params.code} not found.` });
      return;
    }
    res.json(proj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/projects/:code — update a project
app.patch('/api/projects/:code', async (req: Request, res: Response) => {
  try {
    const result = await DbService.updateProject(req.params.code, req.body);
    if (!result.success) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:code — delete a project (only if no members)
app.delete('/api/projects/:code', async (req: Request, res: Response) => {
  try {
    const result = await DbService.deleteProject(req.params.code);
    if (!result.success) {
      res.status(result.message.includes('not found') ? 404 : 409).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Employees
app.get('/api/employees', async (req: Request, res: Response) => {
  try {
    const limit       = parseInt(req.query.limit      as string || '100', 10);
    const offset      = parseInt(req.query.offset     as string || '0',   10);
    const textSearch  = (req.query.textSearch  as string || '');
    const projectCode = (req.query.projectCode as string || '');
    const floor       = req.query.floor ? parseInt(req.query.floor as string, 10) : null;
    const zone        = (req.query.zone as string || '');
    const isUnassigned = req.query.isUnassigned === 'true';

    const result = await DbService.getEmployees(limit, offset, textSearch, projectCode, floor, zone, isUnassigned);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', async (req: Request, res: Response) => {
  try {
    const emp = await DbService.getEmployeeById(req.params.id);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.json(emp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/employees/:id', async (req: Request, res: Response) => {
  try {
    const result = await DbService.updateEmployee(req.params.id, req.body);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/employees — create a new employee
app.post('/api/employees', async (req: Request, res: Response) => {
  try {
    const { name, email, role, department, status, joinDate, projectCode, employeeCode } = req.body;
    if (!name || !email || !role || !department || !joinDate) {
      res.status(400).json({ error: 'Missing required fields: name, email, role, department, joinDate' });
      return;
    }
    const validStatuses = ['Active', 'New Joiner', 'Resigned'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      return;
    }
    const result = await DbService.createEmployee({
      name, email, role, department,
      status: status ?? 'Active',
      joinDate, projectCode, employeeCode,
    });
    if (!result.success) {
      res.status(409).json({ error: result.message });
      return;
    }
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/employees/:id — permanently delete an employee
app.delete('/api/employees/:id', async (req: Request, res: Response) => {
  try {
    const result = await DbService.deleteEmployee(req.params.id);
    if (!result.success) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/seats — all seats for a floor+zone
app.get('/api/seats', async (req: Request, res: Response) => {
  try {
    const floor = parseInt(req.query.floor as string || '1', 10);
    const zone  = (req.query.zone as string || 'A').toUpperCase();
    if (isNaN(floor) || floor < 1 || floor > 4) {
      res.status(400).json({ error: 'floor must be an integer between 1 and 4' });
      return;
    }
    const seats = await DbService.getSeats(floor, zone);
    res.json(seats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/seats — create a new physical seat
app.post('/api/seats', async (req: Request, res: Response) => {
  try {
    const { floor, zone, number, type } = req.body;
    if (!floor || !zone || !number) {
      res.status(400).json({ error: 'Missing required fields: floor, zone, number' });
      return;
    }
    if (isNaN(parseInt(floor)) || isNaN(parseInt(number))) {
      res.status(400).json({ error: 'floor and number must be integers' });
      return;
    }
    const result = await DbService.createSeat({ floor: parseInt(floor), zone, number: parseInt(number), type });
    if (!result.success) {
      res.status(409).json({ error: result.message });
      return;
    }
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/seats/:id — single seat by label (e.g. F1-ZA-001)
app.get('/api/seats/:id', async (req: Request, res: Response) => {
  try {
    const seat = await DbService.getSeatByLabel(req.params.id);
    if (!seat) {
      res.status(404).json({ error: `Seat ${req.params.id} not found.` });
      return;
    }
    res.json(seat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/seats/:id — update seat type or status
app.patch('/api/seats/:id', async (req: Request, res: Response) => {
  try {
    const result = await DbService.updateSeat(req.params.id, req.body);
    if (!result.success) {
      res.status(result.message.includes('not found') ? 404 : 400).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/seats/:id — delete a vacant seat
app.delete('/api/seats/:id', async (req: Request, res: Response) => {
  try {
    const result = await DbService.deleteSeat(req.params.id);
    if (!result.success) {
      res.status(result.message.includes('not found') ? 404 : 409).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seats/utilization', async (req: Request, res: Response) => {
  try {
    const util = await DbService.getSeatMapUtilization();
    res.json(util);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/allocate', async (req: Request, res: Response) => {
  try {
    const { employeeId, seatId } = req.body;
    if (!employeeId || !seatId) {
      res.status(400).json({ error: 'Missing employeeId or seatId' });
      return;
    }
    const result = await DbService.allocateSeat(employeeId, seatId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/release', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      res.status(400).json({ error: 'Missing employeeId' });
      return;
    }
    const result = await DbService.releaseSeat(employeeId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seats/auto-allocate', async (req: Request, res: Response) => {
  try {
    const result = await DbService.autoAllocateJoiners();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Logs
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const logs  = await DbService.getLogs(limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. DB reset (admin only – checks for ADMIN role in JWT)
app.post('/api/db/reset', async (req: Request, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin role required.' });
    return;
  }
  try {
    await DbService.generateSeedData();
    res.json({ success: true, message: 'Re-run `npm run seed` to reset data.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. AI Assistant
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

// ─────────────────────────────────────────────
// VITE / STATIC MIDDLEWARE
// ─────────────────────────────────────────────
async function startServer() {
  // Initialise DB connection + resolve default tenant ID
  await initializePrismaDb();

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
