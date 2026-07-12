/**
 * Seed script for Seat Allot AI.
 * Creates: 1 Tenant · 10 Projects · 5,600 Seats · 5,000 Users · ~4,700 SeatAssignments · 1 Admin user
 *
 * Run with:  npm run seed
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! });
// @ts-ignore
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Static Data ─────────────────────────────────────────────────────────────

const PROJECT_TEMPLATES = [
  { code: 'PROJ-APOLLO',   name: 'Project Apollo',   lead: 'David Vance',    color: '#3b82f6', targetZone: 'F1-ZA' },
  { code: 'PROJ-GEMINI',   name: 'Project Gemini',   lead: 'Sarah Lin',      color: '#10b981', targetZone: 'F1-ZB' },
  { code: 'PROJ-TITAN',    name: 'Project Titan',    lead: 'Robert Chen',    color: '#f59e0b', targetZone: 'F2-ZA' },
  { code: 'PROJ-HELIOS',   name: 'Project Helios',   lead: 'Elena Rostova',  color: '#8b5cf6', targetZone: 'F2-ZB' },
  { code: 'PROJ-VALKYRIE', name: 'Project Valkyrie', lead: 'Marcus Aureli',  color: '#ec4899', targetZone: 'F3-ZA' },
  { code: 'PROJ-SENTINEL', name: 'Project Sentinel', lead: 'Deepa Naidu',    color: '#14b8a6', targetZone: 'F3-ZB' },
  { code: 'PROJ-GENESIS',  name: 'Project Genesis',  lead: 'John Sterling',  color: '#6366f1', targetZone: 'F4-ZA' },
  { code: 'PROJ-NEBULA',   name: 'Project Nebula',   lead: 'Sonia Croft',    color: '#ef4444', targetZone: 'F4-ZB' },
  { code: 'PROJ-AURORA',   name: 'Project Aurora',   lead: 'Yuki Tanaka',    color: '#a855f7', targetZone: 'F3-ZC' },
  { code: 'PROJ-PHOENIX',  name: 'Project Phoenix',  lead: "Liam O'Connor",  color: '#f97316', targetZone: 'F4-ZC' },
];

const DEPARTMENTS = ['Engineering','Product Management','Design','Quality Assurance','Operations','Sales & Marketing','Human Resources','Finance'];

const ROLES_BY_DEPT: Record<string, string[]> = {
  'Engineering':        ['Software Engineer','Senior Software Engineer','Tech Lead','Staff Engineer','DevOps Engineer','Security Engineer','Cloud Architect'],
  'Product Management': ['Product Manager','Senior Product Manager','Product Owner','Director of Product'],
  'Design':             ['UX Designer','UI Designer','Senior UX Researcher','Product Designer'],
  'Quality Assurance':  ['QA Engineer','Senior Automation QA','QA Lead','SDET'],
  'Operations':         ['System Administrator','Operations Analyst','IT Support Specialist','Site Reliability Engineer'],
  'Sales & Marketing':  ['Account Executive','Marketing Specialist','Growth Lead','Customer Success Manager'],
  'Human Resources':    ['HR Specialist','Talent Acquisition Partner','HR Business Partner','Office Manager'],
  'Finance':            ['Financial Analyst','Senior Accountant','Compliance Specialist'],
};

const FIRST_NAMES = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle','Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah','Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathleen','Gary','Amy','Nicholas','Angela','Eric','Shirley','Jonathan','Anna','Stephen','Brenda','Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen','Benjamin','Samantha','Samuel','Katherine','Gregory','Christine','Alexander','Debra','Frank','Rachel','Patrick','Carolyn','Raymond','Janet','Jack','Maria','Dennis','Heather'];

const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const BATCH = 1000;

async function seed() {
  console.log('🌱 Starting seed…');

  // ── 1. Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'enterprise' },
    update: { name: 'Enterprise Corp' },
    create: { name: 'Enterprise Corp', slug: 'enterprise' },
  });
  console.log(`✔ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. Projects ────────────────────────────────────────────────────────────
  const projectMap = new Map<string, string>(); // code → db id
  for (const p of PROJECT_TEMPLATES) {
    const proj = await prisma.project.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: { name: p.name, lead: p.lead, color: p.color, targetZone: p.targetZone },
      create: { tenantId: tenant.id, ...p },
    });
    projectMap.set(p.code, proj.id);
  }
  console.log(`✔ Projects: ${projectMap.size}`);

  // ── 3. Admin user ──────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL    || 'admin@enterprise.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const adminHash  = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: { passwordHash: adminHash },
    create: {
      tenantId:     tenant.id,
      employeeCode: 'ADMIN-001',
      name:         'Admin User',
      email:        adminEmail,
      role:         'ADMIN',
      jobTitle:     'System Administrator',
      department:   'Operations',
      status:       'Active',
      joinDate:     '2020-01-01',
      passwordHash: adminHash,
    },
  });
  console.log(`✔ Admin user: ${adminEmail} / ${adminPass}`);

  // ── 4. Seats (4 floors × 4 zones × 350 = 5,600) ─────────────────────────
  // Delete existing to allow re-seeding
  await prisma.seatAssignment.deleteMany({ where: { seat: { tenantId: tenant.id } } });
  await prisma.seat.deleteMany({ where: { tenantId: tenant.id } });

  const seatRows: any[] = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A', 'B', 'C', 'D']) {
      for (let num = 1; num <= 350; num++) {
        seatRows.push({
          tenantId: tenant.id,
          label:    `F${floor}-Z${zone}-${String(num).padStart(3, '0')}`,
          floor, zone, number: num,
        });
      }
    }
  }

  for (let i = 0; i < seatRows.length; i += BATCH) {
    await prisma.seat.createMany({ data: seatRows.slice(i, i + BATCH), skipDuplicates: true });
  }
  console.log(`✔ Seats: ${seatRows.length}`);

  // Fetch seat label → id map
  const allSeats = await prisma.seat.findMany({
    where:  { tenantId: tenant.id },
    select: { id: true, label: true },
  });
  const seatLabelToId = new Map(allSeats.map(s => [s.label, s.id]));

  // ── 5. Users (5,000) ──────────────────────────────────────────────────────
  // Delete all non-admin employees to allow re-seeding
  await prisma.user.deleteMany({
    where: { tenantId: tenant.id, role: { not: 'ADMIN' } },
  });

  const PROJECT_WEIGHTS = [0.12,0.12,0.10,0.10,0.10,0.10,0.08,0.08,0.10,0.05];

  // Build seat queues per zone
  const seatQueues: Record<string, string[]> = {};
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A','B','C','D']) {
      const key = `F${floor}-Z${zone}`;
      seatQueues[key] = [];
      for (let num = 1; num <= 350; num++) {
        seatQueues[key].push(`F${floor}-Z${zone}-${String(num).padStart(3, '0')}`);
      }
    }
  }

  type SeedEmployee = {
    employeeCode: string;
    assignedSeatLabel: string | null;
    projectCode: string | null;
  };

  const userRows: any[]       = [];
  const seedExtras: SeedEmployee[] = [];

  for (let i = 1; i <= 5000; i++) {
    const employeeCode = `EMP-${String(i).padStart(4, '0')}`;
    const firstName    = pick(FIRST_NAMES);
    const lastName     = pick(LAST_NAMES);
    const name         = `${firstName} ${lastName}`;
    const email        = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random()*99)}@enterprise.com`;
    const department   = pick(DEPARTMENTS);
    const jobTitle     = pick(ROLES_BY_DEPT[department]);

    // Status: 93% Active, 5% New Joiner, 2% Resigned
    const r = Math.random();
    const status = r > 0.98 ? 'Resigned' : r > 0.93 ? 'New Joiner' : 'Active';

    // Project assignment
    let projectCode: string | null = null;
    let cumulative = 0;
    const pRand = Math.random();
    for (let p = 0; p < PROJECT_TEMPLATES.length; p++) {
      cumulative += PROJECT_WEIGHTS[p];
      if (pRand <= cumulative) { projectCode = PROJECT_TEMPLATES[p].code; break; }
    }
    const projectId = projectCode ? projectMap.get(projectCode) ?? null : null;

    // Join date
    let joinDate = '2024-03-12';
    if (status === 'New Joiner') {
      const d = new Date(); d.setDate(d.getDate() + Math.floor(Math.random() * 60) + 1);
      joinDate = d.toISOString().split('T')[0];
    } else {
      const d = new Date(); d.setDate(d.getDate() - (Math.floor(Math.random() * 700) + 30));
      joinDate = d.toISOString().split('T')[0];
    }

    // Seat assignment
    let assignedSeatLabel: string | null = null;
    if (status !== 'Resigned') {
      const needsSeat = status === 'New Joiner' ? Math.random() > 0.8 : Math.random() > 0.05;
      if (needsSeat) {
        const proj = PROJECT_TEMPLATES.find(p => p.code === projectCode);
        let zoneCode = proj ? proj.targetZone : null;
        if (!zoneCode || !seatQueues[zoneCode] || seatQueues[zoneCode].length === 0) {
          const avail = Object.keys(seatQueues).filter(k => seatQueues[k].length > 0);
          if (avail.length) zoneCode = pick(avail);
        }
        if (zoneCode && seatQueues[zoneCode]?.length > 0) {
          assignedSeatLabel = seatQueues[zoneCode].shift()!;
        }
      }
    }

    userRows.push({ tenantId: tenant.id, employeeCode, name, email, role: 'EMPLOYEE', jobTitle, department, status, joinDate, projectId });
    seedExtras.push({ employeeCode, assignedSeatLabel, projectCode });
  }

  for (let i = 0; i < userRows.length; i += BATCH) {
    await prisma.user.createMany({ data: userRows.slice(i, i + BATCH), skipDuplicates: true });
  }
  console.log(`✔ Users: ${userRows.length}`);

  // Fetch user employeeCode → id map
  const allUsers = await prisma.user.findMany({
    where:  { tenantId: tenant.id, role: { not: 'ADMIN' } },
    select: { id: true, employeeCode: true },
  });
  const empCodeToId = new Map(allUsers.map(u => [u.employeeCode, u.id]));

  // ── 6. Seat Assignments ────────────────────────────────────────────────────
  const assignmentRows: any[] = [];
  const occupiedSeatIds: string[] = [];

  for (const extra of seedExtras) {
    if (!extra.assignedSeatLabel) continue;
    const userId = empCodeToId.get(extra.employeeCode);
    const seatId = seatLabelToId.get(extra.assignedSeatLabel);
    if (userId && seatId) {
      assignmentRows.push({ userId, seatId });
      occupiedSeatIds.push(seatId);
    }
  }

  for (let i = 0; i < assignmentRows.length; i += BATCH) {
    await prisma.seatAssignment.createMany({ data: assignmentRows.slice(i, i + BATCH), skipDuplicates: true });
  }

  // Mark occupied seats
  for (let i = 0; i < occupiedSeatIds.length; i += BATCH) {
    await prisma.seat.updateMany({
      where: { id: { in: occupiedSeatIds.slice(i, i + BATCH) } },
      data:  { status: 'OCCUPIED' },
    });
  }

  console.log(`✔ Seat assignments: ${assignmentRows.length}`);
  console.log(`\n🎉 Seed complete!`);
  console.log(`   Employees : 5,000`);
  console.log(`   Seats     : ${seatRows.length}`);
  console.log(`   Assigned  : ${assignmentRows.length}`);
  console.log(`   Admin     : ${adminEmail} / ${adminPass}`);
}

seed()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
