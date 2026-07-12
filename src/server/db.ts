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
    // Fetch all new joiners without a seat
    const unassigned = await prisma.user.findMany({
      where: { tenantId: TENANT_ID, status: 'New Joiner', seatAssignment: null },
      include: { project: { select: { code: true, targetZone: true } } },
    });

    const details: string[] = [];
    let allocatedCount = 0;

    for (const emp of unassigned) {
      // Determine preferred zone from project
      const targetZone = emp.project?.targetZone ?? '';
      let preferredFloor: number | null = null;
      let preferredZone: string | null = null;
      if (targetZone) {
        const m = targetZone.match(/F(\d)-Z([A-D])/);
        if (m) { preferredFloor = parseInt(m[1], 10); preferredZone = m[2]; }
      }

      // Find first vacant seat, preferred zone first then any
      const searchCriteria = [
        ...(preferredFloor && preferredZone
          ? [{ tenantId: TENANT_ID, status: 'AVAILABLE' as const, floor: preferredFloor, zone: preferredZone }]
          : []),
        { tenantId: TENANT_ID, status: 'AVAILABLE' as const },
      ];

      let vacantSeat: { id: string; label: string } | null = null;
      for (const criteria of searchCriteria) {
        vacantSeat = await prisma.seat.findFirst({
          where: criteria,
          select: { id: true, label: true },
        });
        if (vacantSeat) break;
      }

      if (!vacantSeat) {
        details.push(`No vacant seats for ${emp.name} (${emp.employeeCode}).`);
        continue;
      }

      const result = await this.allocateSeat(emp.employeeCode, vacantSeat.label);
      if (result.success) {
        allocatedCount++;
        details.push(`Auto-allocated ${emp.name} (${emp.employeeCode}) → seat ${vacantSeat.label}`);
      }
    }

    return { allocatedCount, details };
  },
};
