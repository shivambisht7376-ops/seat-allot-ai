/**
 * Express app factory – used by both server.ts (production) and tests.
 * Does NOT call app.listen() so tests can bind their own port via supertest.
 */

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { DbService } from './db.js';
import { processAssistantQuery } from './gemini.js';
import { loginHandler, authenticateToken, requireRole, meHandler } from './auth.js';
import { prisma } from '../lib/prisma.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // ── CORS (allow Vercel frontend or any origin in dev) ─────────────────────
  app.use(cors({
    origin: true, // Allow any origin to prevent CORS network errors
    credentials: true,
  }));

  // ── PUBLIC ──────────────────────────────────────────────────────────────
  app.post('/api/auth/login', loginHandler);

  // ── PROTECTED ───────────────────────────────────────────────────────────
  app.use('/api', authenticateToken);

  // Current user profile
  app.get('/api/auth/me', meHandler);

  // Stats
  app.get('/api/stats', async (_req: Request, res: Response) => {
    try { res.json(await DbService.getStats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Projects ──────────────────────────────────────────────────────────
  app.get('/api/projects', async (_req: Request, res: Response) => {
    try { res.json(await DbService.getProjects()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/projects', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { code, name, lead, targetZone } = req.body;
      if (!code || !name || !lead || !targetZone) {
        res.status(400).json({ error: 'Missing required fields: code, name, lead, targetZone' }); return;
      }
      res.status(201).json(await DbService.createProject({ code, name, lead, targetZone }));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/projects/:code', async (req: Request, res: Response) => {
    try {
      const proj = await DbService.getProjectByCode(req.params.code);
      if (!proj) { res.status(404).json({ error: `Project ${req.params.code} not found.` }); return; }
      res.json(proj);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/projects/:code', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.updateProject(req.params.code, req.body);
      if (!result.success) { res.status(404).json({ error: result.message }); return; }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/projects/:code', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.deleteProject(req.params.code);
      if (!result.success) {
        res.status(result.message.includes('not found') ? 404 : 409).json({ error: result.message }); return;
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Employees ─────────────────────────────────────────────────────────
  app.get('/api/employees', async (req: Request, res: Response) => {
    try {
      const limit        = parseInt(req.query.limit      as string || '100', 10);
      const offset       = parseInt(req.query.offset     as string || '0',   10);
      const textSearch   = (req.query.textSearch  as string || '');
      const projectCode  = (req.query.projectCode as string || '');
      const floor        = req.query.floor ? parseInt(req.query.floor as string, 10) : null;
      const zone         = (req.query.zone as string || '');
      const isUnassigned = req.query.isUnassigned === 'true';
      const status       = (req.query.status as string || '');
      res.json(await DbService.getEmployees(limit, offset, textSearch, projectCode, floor, zone, isUnassigned, status));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const emp = await DbService.getEmployeeById(req.params.id);
      if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
      res.json(emp);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/employees', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { name, email, role, department, status, joinDate, projectCode, employeeCode } = req.body;
      if (!name || !email || !role || !department || !joinDate) {
        res.status(400).json({ error: 'Missing required fields: name, email, role, department, joinDate' }); return;
      }
      const validStatuses = ['Active', 'New Joiner', 'Resigned'];
      if (status && !validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` }); return;
      }
      const result = await DbService.createEmployee({
        name, email, role, department,
        status: status ?? 'Active',
        joinDate, projectCode, employeeCode,
      });
      if (!result.success) { res.status(409).json({ error: result.message }); return; }
      res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/employees/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.updateEmployee(req.params.id, req.body);
      if (!result.success) { res.status(400).json({ error: result.message }); return; }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/employees/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.deleteEmployee(req.params.id);
      if (!result.success) { res.status(404).json({ error: result.message }); return; }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Terminate employee (set Resigned + release seat)
  app.post('/api/employees/:id/terminate', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const emp = await DbService.getEmployeeById(req.params.id);
      if (!emp) { res.status(404).json({ error: 'Employee not found.' }); return; }
      // Release seat first
      if (emp.seatId) await DbService.releaseSeat(req.params.id);
      // Mark resigned
      const result = await DbService.updateEmployee(req.params.id, { status: 'Resigned' });
      if (!result.success) { res.status(400).json({ error: result.message }); return; }
      res.json({ success: true, message: `Employee ${req.params.id} has been terminated.` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Assign employee to project
  app.post('/api/employees/:id/assign-project', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { projectCode } = req.body;
      if (!projectCode) { res.status(400).json({ error: 'projectCode is required.' }); return; }
      const result = await DbService.updateEmployee(req.params.id, { projectCode });
      if (!result.success) { res.status(400).json({ error: result.message }); return; }
      res.json({ success: true, message: `Employee ${req.params.id} assigned to ${projectCode}.` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Seats ─────────────────────────────────────────────────────────────
  app.get('/api/seats', async (req: Request, res: Response) => {
    try {
      const floor = parseInt(req.query.floor as string || '1', 10);
      const zone  = (req.query.zone as string || 'A').toUpperCase();
      if (isNaN(floor) || floor < 1 || floor > 4) {
        res.status(400).json({ error: 'floor must be an integer between 1 and 4' }); return;
      }
      res.json(await DbService.getSeats(floor, zone));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/seats/utilization', async (_req: Request, res: Response) => {
    try { res.json(await DbService.getSeatMapUtilization()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/seats/vacant', async (_req: Request, res: Response) => {
    try { res.json(await DbService.getVacantSeats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/seats', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { floor, zone, number, type } = req.body;
      if (floor === undefined || !zone || number === undefined) {
        res.status(400).json({ error: 'Missing required fields: floor, zone, number' }); return;
      }
      const f = parseInt(floor), n = parseInt(number);
      if (isNaN(f) || isNaN(n)) {
        res.status(400).json({ error: 'floor and number must be integers' }); return;
      }
      const result = await DbService.createSeat({ floor: f, zone, number: n, type });
      if (!result.success) { res.status(409).json({ error: result.message }); return; }
      res.status(201).json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // NOTE: /api/seats/utilization must appear BEFORE /api/seats/:id
  app.get('/api/seats/:id', async (req: Request, res: Response) => {
    try {
      const seat = await DbService.getSeatByLabel(req.params.id);
      if (!seat) { res.status(404).json({ error: `Seat ${req.params.id} not found.` }); return; }
      res.json(seat);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/seats/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.updateSeat(req.params.id, req.body);
      if (!result.success) {
        res.status(result.message.includes('not found') ? 404 : 400).json({ error: result.message }); return;
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/seats/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
      const result = await DbService.deleteSeat(req.params.id);
      if (!result.success) {
        res.status(result.message.includes('not found') ? 404 : 409).json({ error: result.message }); return;
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Seat actions
  app.post('/api/seats/allocate', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { employeeId, seatId } = req.body;
      if (!employeeId || !seatId) { res.status(400).json({ error: 'Missing employeeId or seatId' }); return; }
      const result = await DbService.allocateSeat(employeeId, seatId);
      if (!result.success) { res.status(400).json(result); return; }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/seats/release', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.body;
      if (!employeeId) { res.status(400).json({ error: 'Missing employeeId' }); return; }
      const result = await DbService.releaseSeat(employeeId);
      if (!result.success) { res.status(400).json(result); return; }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/seats/auto-allocate', requireRole('ADMIN', 'MANAGER'), async (_req: Request, res: Response) => {
    try { res.json(await DbService.autoAllocateJoiners()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Logs ──────────────────────────────────────────────────────────────
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      res.json(await DbService.getLogs(limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Assistant ──────────────────────────────────────────────────────
  app.post('/api/assistant', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) { res.status(400).json({ error: 'Missing query in body' }); return; }
      const userRole = req.user?.role ?? 'EMPLOYEE';
      res.json(await processAssistantQuery(query, userRole));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Project headcount for charts ──────────────────────────────────────
  app.get('/api/projects/headcount', async (_req: Request, res: Response) => {
    try {
      const projects = await DbService.getProjects();
      const headcounts = await Promise.all(projects.map(async (p) => {
        const count = await prisma.user.count({
          where: { project: { code: p.code }, status: { not: 'Resigned' } }
        });
        return { code: p.code, name: p.name, color: p.color, count };
      }));
      res.json(headcounts);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return app;
}
