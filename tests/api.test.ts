/**
 * Integration tests for the Seat Allot AI REST API.
 *
 * Uses supertest against the real Neon database (read-mostly).
 * Mutating tests create and immediately clean up their own data so the
 * seed data is never permanently modified.
 *
 * Run with:  npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as dotenv from 'dotenv';
dotenv.config();

import { initializePrismaDb } from '../src/server/db.js';
import { createApp } from '../src/server/app.js';
import { prisma } from '../src/lib/prisma.js';

// ── Shared state ────────────────────────────────────────────────────────────
let app: ReturnType<typeof createApp>;
let token: string;  // admin JWT
const TEST_EMP_CODE   = 'TEST-EMP-CRUD';
const TEST_EMP_EMAIL  = 'test.crud.user@enterprise-test.com';
const TEST_PROJ_CODE  = 'TEST-PROJ-CRUD';
const TEST_SEAT_FLOOR = 1;
const TEST_SEAT_ZONE  = 'A';
const TEST_SEAT_NUM   = 999;  // unlikely to collide with seed data

// ── Setup / Teardown ────────────────────────────────────────────────────────
beforeAll(async () => {
  await initializePrismaDb();
  app = createApp();

  // Obtain admin JWT
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL ?? 'admin@enterprise.com', password: process.env.ADMIN_PASSWORD ?? 'Admin@1234' });
  expect(res.status).toBe(200);
  token = res.body.token;
}, 20_000);

afterAll(async () => {
  // Clean up any leftover test data (belt-and-suspenders)
  await prisma.user.deleteMany({ where: { OR: [{ employeeCode: TEST_EMP_CODE }, { email: TEST_EMP_EMAIL }] } });
  await prisma.project.deleteMany({ where: { code: TEST_PROJ_CODE } });
  await prisma.seat.deleteMany({ where: { floor: TEST_SEAT_FLOOR, zone: TEST_SEAT_ZONE, number: TEST_SEAT_NUM } });
  await prisma.$disconnect();
}, 10_000);

const auth = () => ({ Authorization: `Bearer ${token}` });

// ── Helpers ──────────────────────────────────────────────────────────────────
async function cleanupTestEmployee() {
  await prisma.user.deleteMany({ where: { OR: [{ employeeCode: TEST_EMP_CODE }, { email: TEST_EMP_EMAIL }] } });
}
async function cleanupTestProject() {
  await prisma.project.deleteMany({ where: { code: TEST_PROJ_CODE } });
}
async function cleanupTestSeat() {
  await prisma.seat.deleteMany({ where: { floor: TEST_SEAT_FLOOR, zone: TEST_SEAT_ZONE, number: TEST_SEAT_NUM } });
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  it('returns 200 + JWT for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: process.env.ADMIN_EMAIL ?? 'admin@enterprise.com', password: process.env.ADMIN_PASSWORD ?? 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'admin@enterprise.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for protected route without token', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for invalid token', async () => {
    const res = await request(app).get('/api/stats')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/stats', () => {
  it('returns aggregate counts', async () => {
    const res = await request(app).get('/api/stats').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalEmployees:   expect.any(Number),
      totalSeats:       expect.any(Number),
      occupiedSeats:    expect.any(Number),
      utilizationRate:  expect.any(Number),
    });
    expect(res.body.totalSeats).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PROJECTS – full CRUD
// ════════════════════════════════════════════════════════════════════════════
describe('Projects CRUD', () => {
  afterAll(cleanupTestProject);

  it('GET /api/projects — returns array of projects', async () => {
    const res = await request(app).get('/api/projects').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('code');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('POST /api/projects — creates a project', async () => {
    const res = await request(app).post('/api/projects').set(auth()).send({
      code: TEST_PROJ_CODE, name: 'Test CRUD Project', lead: 'Test Lead', targetZone: 'F1-ZA',
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe(TEST_PROJ_CODE);
    expect(res.body).toHaveProperty('color');
  });

  it('POST /api/projects — 400 on missing fields', async () => {
    const res = await request(app).post('/api/projects').set(auth()).send({ code: 'X' });
    expect(res.status).toBe(400);
  });

  it('GET /api/projects/:code — returns the project', async () => {
    const res = await request(app).get(`/api/projects/${TEST_PROJ_CODE}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(TEST_PROJ_CODE);
  });

  it('GET /api/projects/:code — 404 for unknown code', async () => {
    const res = await request(app).get('/api/projects/NO-SUCH-PROJ').set(auth());
    expect(res.status).toBe(404);
  });

  it('PATCH /api/projects/:code — updates lead and color', async () => {
    const res = await request(app).patch(`/api/projects/${TEST_PROJ_CODE}`).set(auth())
      .send({ lead: 'Updated Lead', color: '#aabbcc' });
    expect(res.status).toBe(200);
    expect(res.body.project.lead).toBe('Updated Lead');
    expect(res.body.project.color).toBe('#aabbcc');
  });

  it('PATCH /api/projects/:code — 404 for unknown code', async () => {
    const res = await request(app).patch('/api/projects/GHOST').set(auth()).send({ lead: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/projects/:code — deletes a project with no members', async () => {
    const res = await request(app).delete(`/api/projects/${TEST_PROJ_CODE}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Confirm it's gone
    const check = await request(app).get(`/api/projects/${TEST_PROJ_CODE}`).set(auth());
    expect(check.status).toBe(404);
  });

  it('DELETE /api/projects/:code — 404 for unknown code', async () => {
    const res = await request(app).delete('/api/projects/GHOST').set(auth());
    expect(res.status).toBe(404);
  });

  it('DELETE /api/projects/:code — 409 when project has members', async () => {
    // PROJ-APOLLO was seeded with employees
    const res = await request(app).delete('/api/projects/PROJ-APOLLO').set(auth());
    expect(res.status).toBe(409);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYEES – full CRUD
// ════════════════════════════════════════════════════════════════════════════
describe('Employees CRUD', () => {
  afterAll(cleanupTestEmployee);

  it('GET /api/employees — returns paginated list', async () => {
    const res = await request(app).get('/api/employees?limit=5').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/employees — textSearch filter works', async () => {
    const res = await request(app).get('/api/employees?limit=5&textSearch=Admin').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.some((e: any) => e.name.toLowerCase().includes('admin'))).toBe(true);
  });

  it('GET /api/employees/:id — returns existing employee', async () => {
    const res = await request(app).get('/api/employees/EMP-0001').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('EMP-0001');
  });

  it('GET /api/employees/:id — 404 for unknown id', async () => {
    const res = await request(app).get('/api/employees/EMP-9999').set(auth());
    expect(res.status).toBe(404);
  });

  it('POST /api/employees — creates employee', async () => {
    const res = await request(app).post('/api/employees').set(auth()).send({
      name:         'Test CRUD User',
      email:        TEST_EMP_EMAIL,
      role:         'QA Engineer',
      department:   'Quality Assurance',
      status:       'Active',
      joinDate:     '2025-01-15',
      employeeCode: TEST_EMP_CODE,
    });
    expect(res.status).toBe(201);
    expect(res.body.employee.id).toBe(TEST_EMP_CODE);
    expect(res.body.employee.name).toBe('Test CRUD User');
    expect(res.body.employee.seatId).toBeNull();
  });

  it('POST /api/employees — 400 on missing required fields', async () => {
    const res = await request(app).post('/api/employees').set(auth()).send({ name: 'No email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/employees — 400 on invalid status', async () => {
    const res = await request(app).post('/api/employees').set(auth()).send({
      name: 'x', email: 'x@x.com', role: 'r', department: 'd', joinDate: '2025-01-01', status: 'INVALID',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/employees — 409 on duplicate email', async () => {
    const res = await request(app).post('/api/employees').set(auth()).send({
      name: 'Dup', email: TEST_EMP_EMAIL, role: 'r', department: 'd', joinDate: '2025-01-01',
    });
    expect(res.status).toBe(409);
  });

  it('PATCH /api/employees/:id — updates department', async () => {
    const res = await request(app).patch(`/api/employees/${TEST_EMP_CODE}`).set(auth())
      .send({ department: 'Engineering' });
    expect(res.status).toBe(200);
    expect(res.body.employee.department).toBe('Engineering');
  });

  it('PATCH /api/employees/:id — 400 for unknown employee', async () => {
    const res = await request(app).patch('/api/employees/EMP-GHOST').set(auth()).send({ department: 'X' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/employees/:id — deletes the test employee', async () => {
    const res = await request(app).delete(`/api/employees/${TEST_EMP_CODE}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Confirm gone
    const check = await request(app).get(`/api/employees/${TEST_EMP_CODE}`).set(auth());
    expect(check.status).toBe(404);
  });

  it('DELETE /api/employees/:id — 404 for unknown id', async () => {
    const res = await request(app).delete('/api/employees/EMP-GHOST').set(auth());
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SEATS – full CRUD
// ════════════════════════════════════════════════════════════════════════════
describe('Seats CRUD', () => {
  const seatLabel = `F${TEST_SEAT_FLOOR}-Z${TEST_SEAT_ZONE}-${String(TEST_SEAT_NUM).padStart(3, '0')}`;
  afterAll(cleanupTestSeat);

  it('GET /api/seats — returns seats for floor+zone', async () => {
    const res = await request(app).get('/api/seats?floor=1&zone=A').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('floor');
  });

  it('GET /api/seats — 400 for invalid floor', async () => {
    const res = await request(app).get('/api/seats?floor=99').set(auth());
    expect(res.status).toBe(400);
  });

  it('GET /api/seats/utilization — returns per-zone map', async () => {
    const res = await request(app).get('/api/seats/utilization').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('F1-ZA');
    expect(res.body['F1-ZA']).toHaveProperty('total');
    expect(res.body['F1-ZA']).toHaveProperty('occupied');
    expect(res.body['F1-ZA']).toHaveProperty('rate');
  });

  it('POST /api/seats — creates a new seat', async () => {
    const res = await request(app).post('/api/seats').set(auth()).send({
      floor: TEST_SEAT_FLOOR, zone: TEST_SEAT_ZONE, number: TEST_SEAT_NUM, type: 'HOT_DESK',
    });
    expect(res.status).toBe(201);
    expect(res.body.seat.id).toBe(seatLabel);
  });

  it('POST /api/seats — 409 on duplicate seat', async () => {
    const res = await request(app).post('/api/seats').set(auth()).send({
      floor: TEST_SEAT_FLOOR, zone: TEST_SEAT_ZONE, number: TEST_SEAT_NUM,
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/seats — 400 on missing fields', async () => {
    const res = await request(app).post('/api/seats').set(auth()).send({ floor: 1 });
    expect(res.status).toBe(400);
  });

  it('GET /api/seats/:id — returns existing seat', async () => {
    const res = await request(app).get(`/api/seats/${seatLabel}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(seatLabel);
    expect(res.body.employeeId).toBeNull();
  });

  it('GET /api/seats/:id — 404 for unknown seat', async () => {
    const res = await request(app).get('/api/seats/F1-ZA-000').set(auth());
    expect(res.status).toBe(404);
  });

  it('PATCH /api/seats/:id — updates seat type', async () => {
    const res = await request(app).patch(`/api/seats/${seatLabel}`).set(auth())
      .send({ type: 'ACCESSIBLE' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/seats/:id — 400 when trying to set OCCUPIED directly', async () => {
    const res = await request(app).patch(`/api/seats/${seatLabel}`).set(auth())
      .send({ status: 'OCCUPIED' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/seats/:id — 404 for unknown seat', async () => {
    const res = await request(app).patch('/api/seats/F9-ZZ-999').set(auth())
      .send({ type: 'HOT_DESK' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/seats/:id — deletes a vacant seat', async () => {
    const res = await request(app).delete(`/api/seats/${seatLabel}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Confirm gone
    const check = await request(app).get(`/api/seats/${seatLabel}`).set(auth());
    expect(check.status).toBe(404);
  });

  it('DELETE /api/seats/:id — 404 for unknown seat', async () => {
    const res = await request(app).delete('/api/seats/F9-ZZ-000').set(auth());
    expect(res.status).toBe(404);
  });

  it('DELETE /api/seats/:id — 409 for occupied seat', async () => {
    // F1-ZA-001 is seeded as occupied
    const res = await request(app).delete('/api/seats/F1-ZA-001').set(auth());
    expect(res.status).toBe(409);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SEAT ASSIGNMENTS
// ════════════════════════════════════════════════════════════════════════════
describe('Seat Assignment actions', () => {
  const vacantSeat = 'F1-ZA-350'; // last seat in zone, likely still available after seeding
  let assignedEmpCode = '';

  it('POST /api/seats/auto-allocate — runs without error', async () => {
    const res = await request(app).post('/api/seats/auto-allocate').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('allocatedCount');
    expect(typeof res.body.allocatedCount).toBe('number');
  });

  it('POST /api/seats/release — 400 on missing employeeId', async () => {
    const res = await request(app).post('/api/seats/release').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/seats/allocate — 400 on missing body fields', async () => {
    const res = await request(app).post('/api/seats/allocate').set(auth()).send({ seatId: 'F1-ZA-001' });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/logs', () => {
  it('returns recent allocation logs', async () => {
    const res = await request(app).get('/api/logs?limit=5').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('action');
      expect(res.body[0]).toHaveProperty('timestamp');
    }
  });
});
