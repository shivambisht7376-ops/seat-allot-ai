/**
 * Seed script for Seat Allot AI.
 * Creates: 1 Tenant · 15 Projects · 5,600 Seats · 3,000 Users · ~2,800 SeatAssignments
 *          3 demo accounts: Admin · HR Manager · Employee
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
  { code: 'PROJ-APOLLO',   name: 'Project Apollo',     lead: 'David Vance',      color: '#3b82f6', targetZone: 'F1-ZA' },
  { code: 'PROJ-GEMINI',   name: 'Project Gemini',     lead: 'Sarah Lin',        color: '#10b981', targetZone: 'F1-ZB' },
  { code: 'PROJ-TITAN',    name: 'Project Titan',      lead: 'Robert Chen',      color: '#f59e0b', targetZone: 'F2-ZA' },
  { code: 'PROJ-HELIOS',   name: 'Project Helios',     lead: 'Elena Rostova',    color: '#8b5cf6', targetZone: 'F2-ZB' },
  { code: 'PROJ-VALKYRIE', name: 'Project Valkyrie',   lead: 'Marcus Aurelius',  color: '#ec4899', targetZone: 'F3-ZA' },
  { code: 'PROJ-SENTINEL', name: 'Project Sentinel',   lead: 'Deepa Naidu',      color: '#14b8a6', targetZone: 'F3-ZB' },
  { code: 'PROJ-GENESIS',  name: 'Project Genesis',    lead: 'John Sterling',    color: '#6366f1', targetZone: 'F4-ZA' },
  { code: 'PROJ-NEBULA',   name: 'Project Nebula',     lead: 'Sonia Croft',      color: '#ef4444', targetZone: 'F4-ZB' },
  { code: 'PROJ-AURORA',   name: 'Project Aurora',     lead: 'Yuki Tanaka',      color: '#a855f7', targetZone: 'F3-ZC' },
  { code: 'PROJ-PHOENIX',  name: "Project Phoenix",    lead: "Liam O'Connor",    color: '#f97316', targetZone: 'F4-ZC' },
  { code: 'PROJ-ATLAS',    name: 'Project Atlas',      lead: 'Priya Kapoor',     color: '#0ea5e9', targetZone: 'F1-ZC' },
  { code: 'PROJ-ORION',    name: 'Project Orion',      lead: 'Carlos Mendez',    color: '#84cc16', targetZone: 'F1-ZD' },
  { code: 'PROJ-NEXUS',    name: 'Project Nexus',      lead: 'Amara Osei',       color: '#06b6d4', targetZone: 'F2-ZC' },
  { code: 'PROJ-HORIZON',  name: 'Project Horizon',    lead: 'Finn Larsen',      color: '#f43f5e', targetZone: 'F2-ZD' },
  { code: 'PROJ-QUANTUM',  name: 'Project Quantum',    lead: 'Mei-Ling Zhou',    color: '#d946ef', targetZone: 'F4-ZD' },
];

const PROJECT_WEIGHTS = [0.09,0.08,0.08,0.08,0.07,0.07,0.07,0.07,0.07,0.06,0.06,0.06,0.06,0.06,0.05];

const DEPARTMENTS = [
  'Engineering', 'Product Management', 'Design', 'Quality Assurance',
  'Operations', 'Sales & Marketing', 'Human Resources', 'Finance',
  'Data Science', 'Legal & Compliance',
];

const ROLES_BY_DEPT: Record<string, string[]> = {
  'Engineering':          ['Software Engineer','Senior Software Engineer','Tech Lead','Staff Engineer','DevOps Engineer','Security Engineer','Cloud Architect','Backend Engineer','Frontend Engineer','Full Stack Engineer'],
  'Product Management':   ['Product Manager','Senior Product Manager','Product Owner','Director of Product','Associate PM'],
  'Design':               ['UX Designer','UI Designer','Senior UX Researcher','Product Designer','Brand Designer'],
  'Quality Assurance':    ['QA Engineer','Senior Automation QA','QA Lead','SDET','Quality Analyst'],
  'Operations':           ['System Administrator','Operations Analyst','IT Support Specialist','Site Reliability Engineer','Network Engineer'],
  'Sales & Marketing':    ['Account Executive','Marketing Specialist','Growth Lead','Customer Success Manager','Sales Director'],
  'Human Resources':      ['HR Specialist','Talent Acquisition Partner','HR Business Partner','Office Manager','HR Director'],
  'Finance':              ['Financial Analyst','Senior Accountant','Compliance Specialist','CFO Assistant','Audit Manager'],
  'Data Science':         ['Data Scientist','ML Engineer','Data Analyst','Research Scientist','AI Engineer'],
  'Legal & Compliance':   ['Legal Counsel','Compliance Officer','Contract Specialist','IP Attorney'],
};

const FIRST_NAMES = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle','Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah','Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathleen','Gary','Amy','Nicholas','Angela','Eric','Shirley','Jonathan','Anna','Stephen','Brenda','Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen','Benjamin','Samantha','Samuel','Katherine','Gregory','Christine','Alexander','Debra','Frank','Rachel','Patrick','Carolyn','Raymond','Janet','Jack','Maria','Dennis','Heather','Priya','Arjun','Mei','Carlos','Sofia','Amara','Finn','Yuki','Elena','Marcus'];

const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Kapoor','Osei','Larsen','Zhou','Rostova','Aurelius','Sterling','Croft','Tanaka','Vance','Chen','Lin','Naidu'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const BATCH = 500;

async function seed() {
  console.log('🌱 Starting seed…');

  // ── 1. Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'enterprise' },
    update: { name: 'Enterprise Corp' },
    create: { name: 'Enterprise Corp', slug: 'enterprise' },
  });
  console.log(`✔ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. Projects (15) ───────────────────────────────────────────────────────
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

  // ── 3. Demo Accounts ───────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL    || 'admin@enterprise.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const adminHash  = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: {
      tenantId: tenant.id, employeeCode: 'ADMIN-001', name: 'Alex Admin',
      email: adminEmail, role: 'ADMIN', jobTitle: 'System Administrator',
      department: 'Operations', status: 'Active', joinDate: '2020-01-01', passwordHash: adminHash,
    },
  });
  console.log(`✔ Admin: ${adminEmail} / ${adminPass}`);

  const hrHash = await bcrypt.hash('Hr@1234', 12);
  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: 'hr@enterprise.com' } },
    update: { passwordHash: hrHash, role: 'MANAGER' },
    create: {
      tenantId: tenant.id, employeeCode: 'HR-001', name: 'Hannah HR',
      email: 'hr@enterprise.com', role: 'MANAGER', jobTitle: 'HR Director',
      department: 'Human Resources', status: 'Active', joinDate: '2021-03-15', passwordHash: hrHash,
    },
  });
  console.log(`✔ HR Manager: hr@enterprise.com / Hr@1234`);

  const empHash = await bcrypt.hash('Emp@1234', 12);
  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: 'emp@enterprise.com' } },
    update: { passwordHash: empHash, role: 'EMPLOYEE' },
    create: {
      tenantId: tenant.id, employeeCode: 'EMP-DEMO', name: 'Eve Employee',
      email: 'emp@enterprise.com', role: 'EMPLOYEE', jobTitle: 'Software Engineer',
      department: 'Engineering', status: 'Active', joinDate: '2022-06-01', passwordHash: empHash,
    },
  });
  console.log(`✔ Employee: emp@enterprise.com / Emp@1234`);

  // ── 4. Seats (4 floors × 4 zones × 350 = 5,600) ─────────────────────────
  await prisma.seatAssignment.deleteMany({ where: { seat: { tenantId: tenant.id } } });
  await prisma.seat.deleteMany({ where: { tenantId: tenant.id } });

  const seatRows: any[] = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A', 'B', 'C', 'D']) {
      for (let num = 1; num <= 350; num++) {
        seatRows.push({
          tenantId: tenant.id,
          label: `F${floor}-Z${zone}-${String(num).padStart(3, '0')}`,
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

  // ── 5. Delete old employees (keep demo accounts) ───────────────────────────
  await prisma.user.deleteMany({
    where: {
      tenantId: tenant.id,
      role: 'EMPLOYEE',
      employeeCode: { notIn: ['EMP-DEMO'] },
    },
  });

  // Build seat queues per zone
  const seatQueues: Record<string, string[]> = {};
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A', 'B', 'C', 'D']) {
      const key = `F${floor}-Z${zone}`;
      seatQueues[key] = [];
      for (let num = 1; num <= 350; num++) {
        seatQueues[key].push(`F${floor}-Z${zone}-${String(num).padStart(3, '0')}`);
      }
    }
  }

  // ── 6. Users (3,000) ──────────────────────────────────────────────────────
  type SeedEmployee = { employeeCode: string; assignedSeatLabel: string | null };

  const userRows: any[]          = [];
  const seedExtras: SeedEmployee[] = [];
  const usedEmails = new Set<string>(['admin@enterprise.com','hr@enterprise.com','emp@enterprise.com']);

  for (let i = 1; i <= 3000; i++) {
    const employeeCode = `EMP-${String(i).padStart(4, '0')}`;
    const firstName    = pick(FIRST_NAMES);
    const lastName     = pick(LAST_NAMES);
    const name         = `${firstName} ${lastName}`;

    // Unique email
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@enterprise.com`;
    if (usedEmails.has(email)) email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}x@enterprise.com`;
    usedEmails.add(email);

    const department = pick(DEPARTMENTS);
    const jobTitle   = pick(ROLES_BY_DEPT[department]);

    // Status: 90% Active, 7% New Joiner, 3% Resigned
    const r = Math.random();
    const status = r > 0.97 ? 'Resigned' : r > 0.90 ? 'New Joiner' : 'Active';

    // Project assignment (weighted)
    let projectCode: string | null = null;
    let cumulative = 0;
    const pRand = Math.random();
    for (let p = 0; p < PROJECT_TEMPLATES.length; p++) {
      cumulative += PROJECT_WEIGHTS[p];
      if (pRand <= cumulative) { projectCode = PROJECT_TEMPLATES[p].code; break; }
    }
    const projectId = projectCode ? projectMap.get(projectCode) ?? null : null;

    // Join date
    let joinDate: string;
    if (status === 'New Joiner') {
      const d = new Date(); d.setDate(d.getDate() + Math.floor(Math.random() * 60) + 1);
      joinDate = d.toISOString().split('T')[0];
    } else {
      const d = new Date(); d.setDate(d.getDate() - (Math.floor(Math.random() * 1200) + 30));
      joinDate = d.toISOString().split('T')[0];
    }

    // Seat assignment
    let assignedSeatLabel: string | null = null;
    if (status !== 'Resigned') {
      const needsSeat = status === 'New Joiner' ? Math.random() > 0.75 : Math.random() > 0.05;
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
    seedExtras.push({ employeeCode, assignedSeatLabel });
  }

  for (let i = 0; i < userRows.length; i += BATCH) {
    await prisma.user.createMany({ data: userRows.slice(i, i + BATCH), skipDuplicates: true });
  }
  console.log(`✔ Employees: ${userRows.length}`);

  // Fetch user employeeCode → id map (exclude demo/admin)
  const allUsers = await prisma.user.findMany({
    where:  { tenantId: tenant.id, role: 'EMPLOYEE', employeeCode: { not: 'EMP-DEMO' } },
    select: { id: true, employeeCode: true },
  });
  const empCodeToId = new Map(allUsers.map(u => [u.employeeCode, u.id]));

  // ── 7. Seat Assignments ────────────────────────────────────────────────────
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
  for (let i = 0; i < occupiedSeatIds.length; i += BATCH) {
    await prisma.seat.updateMany({
      where: { id: { in: occupiedSeatIds.slice(i, i + BATCH) } },
      data:  { status: 'OCCUPIED' },
    });
  }

  // Assign demo employee a seat and project
  const demoUser = await prisma.user.findFirst({ where: { tenantId: tenant.id, employeeCode: 'EMP-DEMO' } });
  if (demoUser) {
    const demoSeat = await prisma.seat.findFirst({ where: { tenantId: tenant.id, status: 'AVAILABLE' } });
    const demoProjId = projectMap.get('PROJ-APOLLO');
    if (demoSeat && demoProjId) {
      await prisma.user.update({ where: { id: demoUser.id }, data: { projectId: demoProjId } });
      await prisma.seatAssignment.upsert({
        where:  { userId: demoUser.id },
        update: { seatId: demoSeat.id },
        create: { userId: demoUser.id, seatId: demoSeat.id },
      });
      await prisma.seat.update({ where: { id: demoSeat.id }, data: { status: 'OCCUPIED' } });
    }
  }

  console.log(`✔ Seat assignments: ${assignmentRows.length}`);
  console.log(`\n🎉 Seed complete!`);
  console.log(`   Projects  : 15`);
  console.log(`   Employees : 3,000 + 3 demo accounts`);
  console.log(`   Seats     : ${seatRows.length}`);
  console.log(`   Assigned  : ${assignmentRows.length}`);
  console.log(`\n📋 Demo Accounts:`);
  console.log(`   Admin    : admin@enterprise.com / Admin@1234`);
  console.log(`   HR Mgr   : hr@enterprise.com   / Hr@1234`);
  console.log(`   Employee : emp@enterprise.com   / Emp@1234`);
}

seed()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
