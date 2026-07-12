/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prisma-backed database service.
 * Public API (DbService) is intentionally identical to the original in-memory
 * version so that server.ts and gemini.ts require minimal changes.
 * All methods are now async and scoped to DEFAULT_TENANT_ID.
 */

import { prisma } from '../lib/prisma.js';
import { Employee, Project, Seat, DbStats, AllocationLog } from '../types.js';

// ── Tenant ID is resolved once at startup via initializePrismaDb() ──
let TENANT_ID = '';

/**
 * Called once at server startup.
 * Upserts the default tenant so TENANT_ID is always available.
 */
export async function initializePrismaDb(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: { name: 'Enterprise Corp', slug: 'enterprise' },
  });
  TENANT_ID = tenant.id;
  console.log(`[DB] Connected to tenant: "${tenant.name}" (${TENANT_ID})`);
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

type UserWithRelations = {
  employeeCode: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  status: string;
  joinDate: string;
  project: { code: string } | null;
  seatAssignment: { seat: { label: string } } | null;
};

function toEmployee(u: UserWithRelations): Employee {
  return {
    id: u.employeeCode,
    name: u.name,
    email: u.email,
    role: u.jobTitle,
    department: u.department,
    projectCode: u.project?.code ?? null,
    seatId: u.seatAssignment?.seat.label ?? null,
    status: u.status as 'Active' | 'New Joiner' | 'Resigned',
    joinDate: u.joinDate,
  };
}

type SeatWithAssignment = {
  label: string;
  floor: number;
  zone: string;
  number: number;
  assignment: { user: { employeeCode: string } } | null;
};

function toSeat(s: SeatWithAssignment): Seat {
  return {
    id: s.label,
    floor: s.floor,
    zone: s.zone,
    number: s.number,
    employeeId: s.assignment?.user.employeeCode ?? null,
  };
}

const USER_INCLUDE = {
  project: { select: { code: true } },
  seatAssignment: { include: { seat: { select: { label: true } } } },
} as const;

// ── DbService ────────────────────────────────────────────────────────────────

export const DbService = {

  // ── Stats ────────────────────────────────────────────────────────────────
  async getStats(): Promise<DbStats> {
    const [totalEmployees, activeEmployees, newJoiners, unassignedJoiners, totalSeats, occupiedSeats] =
      await Promise.all([
        prisma.user.count({ where: { tenantId: TENANT_ID } }),
        prisma.user.count({ where: { tenantId: TENANT_ID, status: 'Active' } }),
        prisma.user.count({ where: { tenantId: TENANT_ID, status: 'New Joiner' } }),
        prisma.user.count({ where: { tenantId: TENANT_ID, status: 'New Joiner', seatAssignment: null } }),
        prisma.seat.count({ where: { tenantId: TENANT_ID } }),
        prisma.seat.count({ where: { tenantId: TENANT_ID, status: 'OCCUPIED' } }),
      ]);

    const vacantSeats = totalSeats - occupiedSeats;
    const utilizationRate =
      totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 10000) / 100 : 0;

    return { totalEmployees, activeEmployees, newJoiners, unassignedJoiners, totalSeats, occupiedSeats, vacantSeats, utilizationRate };
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  async getProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({ where: { tenantId: TENANT_ID } });
    return rows.map(p => ({
      code: p.code,
      name: p.name,
      lead: p.lead,
      color: p.color,
      targetZone: p.targetZone,
    }));
  },

  async createProject(proj: Omit<Project, 'color'>): Promise<Project> {
    const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    const created = await prisma.project.create({
      data: { tenantId: TENANT_ID, code: proj.code, name: proj.name, lead: proj.lead, targetZone: proj.targetZone, color },
    });
    return { code: created.code, name: created.name, lead: created.lead, color: created.color, targetZone: created.targetZone };
  },

  // ── Employees ─────────────────────────────────────────────────────────────
  async getEmployees(
    limit = 100,
    offset = 0,
    textSearch = '',
    projectCode = '',
    floor: number | null = null,
    zone = '',
    isUnassigned = false,
  ): Promise<{ data: Employee[]; total: number }> {

    const where: any = { tenantId: TENANT_ID };

    if (isUnassigned) {
      where.seatAssignment = null;
      where.status = { not: 'Resigned' };
    }

    if (textSearch) {
      where.OR = [
        { name:         { contains: textSearch, mode: 'insensitive' } },
        { employeeCode: { contains: textSearch, mode: 'insensitive' } },
        { email:        { contains: textSearch, mode: 'insensitive' } },
        { jobTitle:     { contains: textSearch, mode: 'insensitive' } },
        { department:   { contains: textSearch, mode: 'insensitive' } },
        { seatAssignment: { seat: { label: { contains: textSearch, mode: 'insensitive' } } } },
      ];
    }

    if (projectCode) {
      where.project = { code: projectCode };
    }

    if (floor !== null || zone) {
      where.seatAssignment = {
        seat: {
          ...(floor !== null ? { floor } : {}),
          ...(zone ? { zone } : {}),
        },
      };
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, include: USER_INCLUDE, skip: offset, take: limit }),
      prisma.user.count({ where }),
    ]);

    return { data: rows.map(toEmployee), total };
  },

  async getEmployeeById(employeeCode: string): Promise<Employee | undefined> {
    const user = await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, employeeCode },
      include: USER_INCLUDE,
    });
    return user ? toEmployee(user) : undefined;
  },

  async getEmployeeBySeat(seatLabel: string): Promise<Employee | undefined> {
    const assignment = await prisma.seatAssignment.findFirst({
      where: { seat: { tenantId: TENANT_ID, label: seatLabel } },
      include: { user: { include: USER_INCLUDE } },
    });
    return assignment ? toEmployee(assignment.user as any) : undefined;
  },

  // ── Seats ──────────────────────────────────────────────────────────────────
  async getSeats(floor: number, zone: string): Promise<Seat[]> {
    const rows = await prisma.seat.findMany({
      where: { tenantId: TENANT_ID, floor, zone },
      include: { assignment: { include: { user: { select: { employeeCode: true } } } } },
      orderBy: { number: 'asc' },
    });
    return rows.map(toSeat);
  },

  async getVacantSeats(): Promise<Seat[]> {
    const rows = await prisma.seat.findMany({
      where: { tenantId: TENANT_ID, status: 'AVAILABLE' },
      orderBy: [{ floor: 'asc' }, { zone: 'asc' }, { number: 'asc' }],
    });
    return rows.map(toSeat);
  },

  async getSeatMapUtilization(): Promise<Record<string, { total: number; occupied: number; rate: number }>> {
    const map: Record<string, { total: number; occupied: number; rate: number }> = {};
    for (let f = 1; f <= 4; f++) {
      for (const z of ['A', 'B', 'C', 'D']) {
        map[`F${f}-Z${z}`] = { total: 0, occupied: 0, rate: 0 };
      }
    }

    const groups = await prisma.seat.groupBy({
      by: ['floor', 'zone', 'status'],
      where: { tenantId: TENANT_ID },
      _count: { id: true },
    });

    for (const g of groups) {
      const key = `F${g.floor}-Z${g.zone}`;
      if (!map[key]) map[key] = { total: 0, occupied: 0, rate: 0 };
      map[key].total += g._count.id;
      if (g.status === 'OCCUPIED') map[key].occupied += g._count.id;
    }

    for (const key of Object.keys(map)) {
      const e = map[key];
      e.rate = e.total > 0 ? Math.round((e.occupied / e.total) * 100) : 0;
    }

    return map;
  },

  // ── Seat allocation ───────────────────────────────────────────────────────
  async allocateSeat(
    employeeCode: string,
    seatLabel: string,
  ): Promise<{ success: boolean; message: string; employee?: Employee }> {

    const [user, seat] = await Promise.all([
      prisma.user.findFirst({
        where: { tenantId: TENANT_ID, employeeCode },
        include: USER_INCLUDE,
      }),
      prisma.seat.findFirst({
        where: { tenantId: TENANT_ID, label: seatLabel },
        include: { assignment: { include: { user: { select: { employeeCode: true } } } } },
      }),
    ]);

    if (!user) return { success: false, message: `Employee ${employeeCode} not found.` };
    if (user.status === 'Resigned') return { success: false, message: `Cannot allocate seat to resigned employee.` };
    if (!seat) return { success: false, message: `Seat ${seatLabel} does not exist.` };
    if (seat.assignment && seat.assignment.user.employeeCode !== employeeCode) {
      return { success: false, message: `Seat ${seatLabel} is already occupied by ${seat.assignment.user.employeeCode}.` };
    }

    const prevSeatLabel = (user as any).seatAssignment?.seat.label ?? null;
    if (prevSeatLabel === seatLabel) {
      return { success: true, message: `Employee already assigned to seat ${seatLabel}.`, employee: toEmployee(user as any) };
    }

    await prisma.$transaction(async (tx) => {
      // Release old seat
      if (prevSeatLabel) {
        await tx.seatAssignment.delete({ where: { userId: user.id } });
        await tx.seat.update({ where: { id: (user as any).seatAssignment!.seat.id ?? '' }, data: { status: 'AVAILABLE' } });
      }
      // Create new assignment (upsert by userId in case of concurrent calls)
      await tx.seatAssignment.upsert({
        where: { userId: user.id },
        create: { userId: user.id, seatId: seat.id },
        update: { seatId: seat.id, assignedAt: new Date(), releasedAt: null },
      });
      await tx.seat.update({ where: { id: seat.id }, data: { status: 'OCCUPIED' } });

      // Audit log
      await tx.allocationLog.create({
        data: {
          tenantId: TENANT_ID,
          employeeCode,
          employeeName: user.name,
          action: prevSeatLabel ? 'reassign' : 'allocate',
          seatLabel,
          prevSeatLabel,
          details: prevSeatLabel
            ? `Reassigned from ${prevSeatLabel} to ${seatLabel}`
            : `First-time allocation to ${seatLabel}`,
        },
      });
    });

    const updated = await prisma.user.findFirst({
      where: { id: user.id },
      include: USER_INCLUDE,
    });

    return {
      success: true,
      message: `Successfully allocated seat ${seatLabel} to ${user.name}.`,
      employee: toEmployee(updated as any),
    };
  },

  async releaseSeat(
    employeeCode: string,
  ): Promise<{ success: boolean; message: string; employee?: Employee }> {

    const user = await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, employeeCode },
      include: USER_INCLUDE,
    });

    if (!user) return { success: false, message: `Employee ${employeeCode} not found.` };

    const prevSeatLabel = (user as any).seatAssignment?.seat.label ?? null;
    if (!prevSeatLabel) {
      return { success: true, message: `${user.name} already has no seat.`, employee: toEmployee(user as any) };
    }

    const seatDbId = (user as any).seatAssignment!.seat?.id;

    await prisma.$transaction(async (tx) => {
      await tx.seatAssignment.delete({ where: { userId: user.id } });
      if (seatDbId) await tx.seat.update({ where: { id: seatDbId }, data: { status: 'AVAILABLE' } });
      await tx.allocationLog.create({
        data: {
          tenantId: TENANT_ID,
          employeeCode,
          employeeName: user.name,
          action: 'release',
          seatLabel: null,
          prevSeatLabel,
          details: `Released seat ${prevSeatLabel}`,
        },
      });
    });

    const updated = await prisma.user.findFirst({ where: { id: user.id }, include: USER_INCLUDE });
    return { success: true, message: `Released seat ${prevSeatLabel} from ${user.name}.`, employee: toEmployee(updated as any) };
  },

  async updateEmployee(
    employeeCode: string,
    updates: Partial<Omit<Employee, 'id' | 'seatId'>>,
  ): Promise<{ success: boolean; message: string; employee?: Employee }> {

    const user = await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, employeeCode },
      include: { project: { select: { id: true, code: true } } },
    });

    if (!user) return { success: false, message: `Employee ${employeeCode} not found.` };

    const data: any = {};
    if (updates.name) data.name = updates.name;
    if (updates.role) data.jobTitle = updates.role;
    if (updates.department) data.department = updates.department;
    if (updates.status) data.status = updates.status;
    if (updates.joinDate) data.joinDate = updates.joinDate;

    if (updates.projectCode !== undefined) {
      if (updates.projectCode === null) {
        data.projectId = null;
      } else {
        const proj = await prisma.project.findFirst({
          where: { tenantId: TENANT_ID, code: updates.projectCode },
        });
        if (proj) data.projectId = proj.id;
      }
    }

    await prisma.user.update({ where: { id: user.id }, data });

    if (updates.projectCode !== undefined && updates.projectCode !== user.project?.code) {
      await prisma.allocationLog.create({
        data: {
          tenantId: TENANT_ID,
          employeeCode,
          employeeName: user.name,
          action: 'reassign',
          details: `Project updated from ${user.project?.code ?? 'None'} to ${updates.projectCode ?? 'None'}`,
        },
      });
    }

    const updated = await prisma.user.findFirst({ where: { id: user.id }, include: USER_INCLUDE });
    return { success: true, message: `${user.name} updated.`, employee: toEmployee(updated as any) };
  },

  // ── Logs ──────────────────────────────────────────────────────────────────
  async getLogs(limit = 50): Promise<AllocationLog[]> {
    const rows = await prisma.allocationLog.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map(r => ({
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      employeeId: r.employeeCode,
      employeeName: r.employeeName,
      action: r.action as 'allocate' | 'release' | 'reassign',
      seatId: r.seatLabel ?? null,
      previousSeatId: r.prevSeatLabel ?? null,
      details: r.details,
    }));
  },

  // ── Seed data reset (admin/demo only) ────────────────────────────────────
  async generateSeedData(): Promise<void> {
    console.log('[DB] Resetting seed — re-run: npm run seed');
    // Actual seed logic lives in prisma/seed.ts — this is a no-op placeholder.
  },

  // ── Auto-allocate new joiners ─────────────────────────────────────────────
  async autoAllocateJoiners(): Promise<{ allocatedCount: number; details: string[] }> {
    // 1. Fetch all unassigned new joiners
    const unassigned = await prisma.user.findMany({
      where:   { tenantId: TENANT_ID, status: 'New Joiner', seatAssignment: null },
      include: { project: { select: { code: true, targetZone: true } } },
    });

    if (unassigned.length === 0) return { allocatedCount: 0, details: ['No unassigned new joiners.'] };

    // 2. Fetch enough vacant seats for everyone in one query
    const vacantSeats = await prisma.seat.findMany({
      where:  { tenantId: TENANT_ID, status: 'AVAILABLE' },
      select: { id: true, label: true, floor: true, zone: true },
      take:   unassigned.length + 50,
    });

    if (vacantSeats.length === 0) return { allocatedCount: 0, details: ['No vacant seats available.'] };

    // 3. Build per-zone seat queues (in-memory, no extra DB calls)
    const seatsByZone = new Map<string, typeof vacantSeats>();
    for (const s of vacantSeats) {
      const key = `F${s.floor}-Z${s.zone}`;
      if (!seatsByZone.has(key)) seatsByZone.set(key, []);
      seatsByZone.get(key)!.push(s);
    }

    // 4. Greedily match each joiner to a seat (preferred zone first, then any)
    const reservedIds = new Set<string>();
    type Match = { userId: string; seatId: string; label: string; empCode: string; empName: string };
    const matches: Match[] = [];
    const details: string[] = [];

    for (const emp of unassigned) {
      const targetZone = emp.project?.targetZone ?? '';
      let seat: { id: string; label: string } | null = null;

      // Preferred zone first
      if (targetZone) {
        for (const s of (seatsByZone.get(targetZone) ?? [])) {
          if (!reservedIds.has(s.id)) { seat = s; break; }
        }
      }
      // Fall back to any available seat
      if (!seat) {
        for (const s of vacantSeats) {
          if (!reservedIds.has(s.id)) { seat = s; break; }
        }
      }

      if (!seat) {
        details.push(`No vacant seats available for ${emp.name} (${emp.employeeCode}).`);
        continue;
      }

      reservedIds.add(seat.id);
      matches.push({ userId: emp.id, seatId: seat.id, label: seat.label, empCode: emp.employeeCode, empName: emp.name });
    }

    if (matches.length === 0) return { allocatedCount: 0, details };

    // 5. Commit everything in one transaction (3 bulk queries)
    const seatIds = matches.map(m => m.seatId);
    await prisma.$transaction([
      prisma.seatAssignment.createMany({
        data:           matches.map(m => ({ userId: m.userId, seatId: m.seatId })),
        skipDuplicates: true,
      }),
      prisma.seat.updateMany({
        where: { id: { in: seatIds } },
        data:  { status: 'OCCUPIED' },
      }),
      prisma.allocationLog.createMany({
        data: matches.map(m => ({
          tenantId:     TENANT_ID,
          employeeCode: m.empCode,
          employeeName: m.empName,
          action:       'allocate',
          seatLabel:    m.label,
          prevSeatLabel: null,
          details:      `Auto-allocated to seat ${m.label}`,
        })),
      }),
    ]);

    for (const m of matches) {
      details.push(`Auto-allocated ${m.empName} (${m.empCode}) → seat ${m.label}`);
    }

    return { allocatedCount: matches.length, details };
  },

  // ── Create employee ────────────────────────────────────────────────────────
  async createEmployee(
    data: Pick<Employee, 'name' | 'email' | 'role' | 'department' | 'status' | 'joinDate'> & {
      projectCode?: string | null;
      employeeCode?: string;
    },
  ): Promise<{ success: boolean; message: string; employee?: Employee }> {

    // Auto-generate employee code if not supplied
    let employeeCode = data.employeeCode?.trim().toUpperCase() ?? '';
    if (!employeeCode) {
      const count = await prisma.user.count({ where: { tenantId: TENANT_ID } });
      employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;
    }

    // Ensure uniqueness
    const existing = await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, OR: [{ employeeCode }, { email: data.email }] },
    });
    if (existing) {
      return { success: false, message: `An employee with this code or email already exists.` };
    }

    let projectId: string | null = null;
    if (data.projectCode) {
      const proj = await prisma.project.findFirst({
        where: { tenantId: TENANT_ID, code: data.projectCode },
      });
      if (!proj) return { success: false, message: `Project ${data.projectCode} not found.` };
      projectId = proj.id;
    }

    const user = await prisma.user.create({
      data: {
        tenantId:     TENANT_ID,
        employeeCode,
        name:         data.name,
        email:        data.email,
        role:         'EMPLOYEE',
        jobTitle:     data.role,
        department:   data.department,
        status:       data.status,
        joinDate:     data.joinDate,
        projectId,
      },
      include: USER_INCLUDE,
    });

    await prisma.allocationLog.create({
      data: {
        tenantId:     TENANT_ID,
        employeeCode: user.employeeCode,
        employeeName: user.name,
        action:       'allocate',
        details:      `Employee ${user.name} (${user.employeeCode}) created.`,
      },
    });

    return { success: true, message: `Employee ${user.name} created.`, employee: toEmployee(user as any) };
  },

  // ── Delete employee ────────────────────────────────────────────────────────
  async deleteEmployee(
    employeeCode: string,
  ): Promise<{ success: boolean; message: string }> {

    const user = await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, employeeCode },
      include: { seatAssignment: { include: { seat: true } } },
    });
    if (!user) return { success: false, message: `Employee ${employeeCode} not found.` };

    // Release seat first (within transaction) then delete user
    await prisma.$transaction(async (tx) => {
      if (user.seatAssignment) {
        await tx.seatAssignment.delete({ where: { userId: user.id } });
        await tx.seat.update({
          where: { id: user.seatAssignment.seatId },
          data:  { status: 'AVAILABLE' },
        });
      }
      await tx.user.delete({ where: { id: user.id } });
    });

    return { success: true, message: `Employee ${employeeCode} (${user.name}) permanently deleted.` };
  },

  // ── Get single project ─────────────────────────────────────────────────────
  async getProjectByCode(
    code: string,
  ): Promise<Project | undefined> {
    const proj = await prisma.project.findFirst({
      where: { tenantId: TENANT_ID, code },
    });
    if (!proj) return undefined;
    return { code: proj.code, name: proj.name, lead: proj.lead, color: proj.color, targetZone: proj.targetZone };
  },

  // ── Update project ─────────────────────────────────────────────────────────
  async updateProject(
    code: string,
    updates: Partial<Omit<Project, 'code'>>,
  ): Promise<{ success: boolean; message: string; project?: Project }> {

    const proj = await prisma.project.findFirst({ where: { tenantId: TENANT_ID, code } });
    if (!proj) return { success: false, message: `Project ${code} not found.` };

    const updated = await prisma.project.update({
      where: { id: proj.id },
      data: {
        ...(updates.name       !== undefined ? { name:       updates.name }       : {}),
        ...(updates.lead       !== undefined ? { lead:       updates.lead }       : {}),
        ...(updates.color      !== undefined ? { color:      updates.color }      : {}),
        ...(updates.targetZone !== undefined ? { targetZone: updates.targetZone } : {}),
      },
    });

    return {
      success: true,
      message: `Project ${code} updated.`,
      project: { code: updated.code, name: updated.name, lead: updated.lead, color: updated.color, targetZone: updated.targetZone },
    };
  },

  // ── Delete project ─────────────────────────────────────────────────────────
  async deleteProject(
    code: string,
  ): Promise<{ success: boolean; message: string }> {

    const proj = await prisma.project.findFirst({
      where:   { tenantId: TENANT_ID, code },
      include: { members: { select: { id: true } } },
    });
    if (!proj) return { success: false, message: `Project ${code} not found.` };
    if (proj.members.length > 0) {
      return { success: false, message: `Project ${code} still has ${proj.members.length} member(s). Reassign or remove them first.` };
    }

    await prisma.project.delete({ where: { id: proj.id } });
    return { success: true, message: `Project ${code} deleted.` };
  },

  // ── Get single seat ────────────────────────────────────────────────────────
  async getSeatByLabel(
    label: string,
  ): Promise<Seat | undefined> {
    const seat = await prisma.seat.findFirst({
      where:   { tenantId: TENANT_ID, label },
      include: { assignment: { include: { user: { select: { employeeCode: true } } } } },
    });
    return seat ? toSeat(seat as any) : undefined;
  },

  // ── Create seat ────────────────────────────────────────────────────────────
  async createSeat(
    data: { floor: number; zone: string; number: number; type?: string },
  ): Promise<{ success: boolean; message: string; seat?: Seat }> {

    const zone   = data.zone.toUpperCase();
    const label  = `F${data.floor}-Z${zone}-${String(data.number).padStart(3, '0')}`;

    const existing = await prisma.seat.findFirst({ where: { tenantId: TENANT_ID, label } });
    if (existing) return { success: false, message: `Seat ${label} already exists.` };

    const seat = await prisma.seat.create({
      data: {
        tenantId: TENANT_ID,
        label,
        floor:    data.floor,
        zone,
        number:   data.number,
        type:     (data.type?.toUpperCase() as any) ?? 'REGULAR',
        status:   'AVAILABLE',
      },
    });

    return { success: true, message: `Seat ${label} created.`, seat: toSeat({ ...seat, assignment: null }) };
  },

  // ── Update seat ────────────────────────────────────────────────────────────
  async updateSeat(
    label: string,
    updates: { type?: string; status?: string },
  ): Promise<{ success: boolean; message: string; seat?: Seat }> {

    const seat = await prisma.seat.findFirst({ where: { tenantId: TENANT_ID, label } });
    if (!seat) return { success: false, message: `Seat ${label} not found.` };

    // Prevent manually marking as OCCUPIED via this route — use allocateSeat for that
    if (updates.status === 'OCCUPIED') {
      return { success: false, message: `Use POST /api/seats/allocate to occupy a seat.` };
    }

    const updated = await prisma.seat.findFirst({
      where:   { id: seat.id },
      include: { assignment: { include: { user: { select: { employeeCode: true } } } } },
    });

    await prisma.seat.update({
      where: { id: seat.id },
      data: {
        ...(updates.type   ? { type:   updates.type.toUpperCase()   as any } : {}),
        ...(updates.status ? { status: updates.status.toUpperCase() as any } : {}),
      },
    });

    const refreshed = await prisma.seat.findFirst({
      where:   { id: seat.id },
      include: { assignment: { include: { user: { select: { employeeCode: true } } } } },
    });

    return { success: true, message: `Seat ${label} updated.`, seat: toSeat(refreshed as any) };
  },

  // ── Delete seat ────────────────────────────────────────────────────────────
  async deleteSeat(
    label: string,
  ): Promise<{ success: boolean; message: string }> {

    const seat = await prisma.seat.findFirst({
      where:   { tenantId: TENANT_ID, label },
      include: { assignment: { select: { id: true } } },
    });
    if (!seat)             return { success: false, message: `Seat ${label} not found.` };
    if (seat.assignment)   return { success: false, message: `Seat ${label} is currently occupied. Release it first.` };

    await prisma.seat.delete({ where: { id: seat.id } });
    return { success: true, message: `Seat ${label} permanently deleted.` };
  },
};
