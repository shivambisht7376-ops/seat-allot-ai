/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { Employee, Project, Seat, DbStats, AllocationLog } from '../types.js';

const DB_FILE_PATH = path.join(process.cwd(), 'db_store.json');

// Memory indexes for sub-millisecond lookups
let employees: Employee[] = [];
let projects: Project[] = [];
let seats: Map<string, Seat> = new Map(); // seatId -> Seat
let logs: AllocationLog[] = [];

// Static project templates
const PROJECT_TEMPLATES: Project[] = [
  { code: 'PROJ-APOLLO', name: 'Project Apollo', lead: 'David Vance', color: '#3b82f6', targetZone: 'F1-ZA' },
  { code: 'PROJ-GEMINI', name: 'Project Gemini', lead: 'Sarah Lin', color: '#10b981', targetZone: 'F1-ZB' },
  { code: 'PROJ-TITAN', name: 'Project Titan', lead: 'Robert Chen', color: '#f59e0b', targetZone: 'F2-ZA' },
  { code: 'PROJ-HELIOS', name: 'Project Helios', lead: 'Elena Rostova', color: '#8b5cf6', targetZone: 'F2-ZB' },
  { code: 'PROJ-VALKYRIE', name: 'Project Valkyrie', lead: 'Marcus Aureli', color: '#ec4899', targetZone: 'F3-ZA' },
  { code: 'PROJ-SENTINEL', name: 'Project Sentinel', lead: 'Deepa Naidu', color: '#14b8a6', targetZone: 'F3-ZB' },
  { code: 'PROJ-GENESIS', name: 'Project Genesis', lead: 'John Sterling', color: '#6366f1', targetZone: 'F4-ZA' },
  { code: 'PROJ-NEBULA', name: 'Project Nebula', lead: 'Sonia Croft', color: '#ef4444', targetZone: 'F4-ZB' },
  { code: 'PROJ-AURORA', name: 'Project Aurora', lead: 'Yuki Tanaka', color: '#a855f7', targetZone: 'F3-ZC' },
  { code: 'PROJ-PHOENIX', name: 'Project Phoenix', lead: 'Liam O\'Connor', color: '#f97316', targetZone: 'F4-ZC' }
];

const DEPARTMENTS = [
  'Engineering',
  'Product Management',
  'Design',
  'Quality Assurance',
  'Operations',
  'Sales & Marketing',
  'Human Resources',
  'Finance'
];

const ROLES_BY_DEPT: Record<string, string[]> = {
  'Engineering': ['Software Engineer', 'Senior Software Engineer', 'Tech Lead', 'Staff Engineer', 'DevOps Engineer', 'Security Engineer', 'Cloud Architect'],
  'Product Management': ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Director of Product'],
  'Design': ['UX Designer', 'UI Designer', 'Senior UX Researcher', 'Product Designer'],
  'Quality Assurance': ['QA Engineer', 'Senior Automation QA', 'QA Lead', 'SDET'],
  'Operations': ['System Administrator', 'Operations Analyst', 'IT Support Specialist', 'Site Reliability Engineer'],
  'Sales & Marketing': ['Account Executive', 'Marketing Specialist', 'Growth Lead', 'Customer Success Manager'],
  'Human Resources': ['HR Specialist', 'Talent Acquisition Partner', 'HR Business Partner', 'Office Manager'],
  'Finance': ['Financial Analyst', 'Senior Accountant', 'Compliance Specialist']
};

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Alexander', 'Debra', 'Frank', 'Rachel',
  'Patrick', 'Carolyn', 'Raymond', 'Janet', 'Jack', 'Maria', 'Dennis', 'Heather', 'Jerry', 'Samantha'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes'
];

/**
 * Generate 5,000 highly realistic employees and create the 5,600 physical seat configurations.
 */
export function generateSeedData(): void {
  console.log('Generating high-performance database seed data of ~5,000 employees...');

  // 1. Initialize Seats (4 Floors, 4 Zones, 350 seats per zone = 5,600 seats)
  seats.clear();
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A', 'B', 'C', 'D']) {
      for (let num = 1; num <= 350; num++) {
        const id = `F${floor}-Z${zone}-${String(num).padStart(3, '0')}`;
        seats.set(id, {
          id,
          floor,
          zone,
          number: num,
          employeeId: null
        });
      }
    }
  }

  projects = [...PROJECT_TEMPLATES];
  employees = [];
  logs = [];

  // 2. Generate Employees
  // Let's generate exactly 5,000 employees
  const totalCount = 5000;
  
  // Allocate target zone distributions so projects sit in clustered locations
  // E.g. Apollo sits mostly in F1-ZA and F1-ZB.
  // We distribute projects amongst employees based on weights
  const projectWeights = [0.12, 0.12, 0.10, 0.10, 0.10, 0.10, 0.08, 0.08, 0.10, 0.05, 0.05]; // last element is unassigned project
  
  // Create desks queues per zone to distribute seated employees cleanly
  const seatQueues: Record<string, string[]> = {};
  for (let floor = 1; floor <= 4; floor++) {
    for (const zone of ['A', 'B', 'C', 'D']) {
      const zoneCode = `F${floor}-Z${zone}`;
      seatQueues[zoneCode] = [];
      for (let num = 1; num <= 350; num++) {
        seatQueues[zoneCode].push(`F${floor}-Z${zone}-${String(num).padStart(3, '0')}`);
      }
    }
  }

  for (let i = 1; i <= totalCount; i++) {
    const id = `EMP-${String(i).padStart(4, '0')}`;
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}@enterprise.com`;
    
    const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
    const roles = ROLES_BY_DEPT[department];
    const role = roles[Math.floor(Math.random() * roles.length)];
    
    // Choose status (93% Active, 5% New Joiner, 2% Resigned)
    const randStatus = Math.random();
    let status: 'Active' | 'New Joiner' | 'Resigned' = 'Active';
    if (randStatus > 0.98) {
      status = 'Resigned';
    } else if (randStatus > 0.93) {
      status = 'New Joiner';
    }

    // Determine project mapping
    let projectCode: string | null = null;
    const pRand = Math.random();
    let cumulative = 0;
    for (let p = 0; p < PROJECT_TEMPLATES.length; p++) {
      cumulative += projectWeights[p];
      if (pRand <= cumulative) {
        projectCode = PROJECT_TEMPLATES[p].code;
        break;
      }
    }

    // Assign join date
    let joinDate = '2024-03-12';
    if (status === 'New Joiner') {
      const daysAhead = Math.floor(Math.random() * 60) + 1;
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      joinDate = d.toISOString().split('T')[0];
    } else {
      const daysAgo = Math.floor(Math.random() * 700) + 30;
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      joinDate = d.toISOString().split('T')[0];
    }

    // Determine seating allocation
    let seatId: string | null = null;
    
    if (status !== 'Resigned') {
      // 95% of active employees get a seat, but new joiners are mostly unassigned
      const needsSeat = status === 'New Joiner' ? (Math.random() > 0.8) : (Math.random() > 0.05);
      
      if (needsSeat) {
        // Try to seat them in their project's target zone
        const project = projects.find(p => p.code === projectCode);
        let zoneCode = project ? project.targetZone : null;
        
        // If no preferred zone or that zone is full, pick a random non-full zone
        if (!zoneCode || !seatQueues[zoneCode] || seatQueues[zoneCode].length === 0) {
          const keys = Object.keys(seatQueues).filter(k => seatQueues[k].length > 0);
          if (keys.length > 0) {
            zoneCode = keys[Math.floor(Math.random() * keys.length)];
          }
        }
        
        if (zoneCode && seatQueues[zoneCode] && seatQueues[zoneCode].length > 0) {
          seatId = seatQueues[zoneCode].shift() || null;
          if (seatId) {
            const seatObj = seats.get(seatId);
            if (seatObj) {
              seatObj.employeeId = id;
              seats.set(seatId, seatObj);
            }
          }
        }
      }
    }

    employees.push({
      id,
      name,
      email,
      role,
      department,
      projectCode,
      seatId,
      status,
      joinDate
    });
  }

  // Create initial audit log entries (just a few major ones)
  logs.push({
    id: 'LOG-0001',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    employeeId: 'EMP-0012',
    employeeName: employees.find(e => e.id === 'EMP-0012')?.name || 'John Smith',
    action: 'allocate',
    seatId: 'F1-ZA-102',
    previousSeatId: null,
    details: 'Initial corporate cluster desk allocation'
  });

  saveToDisk();
  console.log(`Successfully seeded ${employees.length} employees and allocated ${Array.from(seats.values()).filter(s => s.employeeId !== null).length} desks.`);
}

/**
 * Save current database state to file disk
 */
function saveToDisk(): void {
  try {
    const data = {
      projects,
      employees,
      seats: Array.from(seats.entries()),
      logs
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database disk:', error);
  }
}

/**
 * Load database from disk, or trigger automatic seeding if not present.
 */
export function initializeDatabase(): void {
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      console.log('Loading existing database state from disk...');
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      
      projects = parsed.projects || [];
      employees = parsed.employees || [];
      logs = parsed.logs || [];
      
      seats.clear();
      if (parsed.seats && Array.isArray(parsed.seats)) {
        for (const [key, val] of parsed.seats) {
          seats.set(key, val);
        }
      } else {
        // Fallback reconstruction
        generateSeedData();
      }
      
      // Secondary check: verify employee count
      if (employees.length < 1000) {
        console.warn('Employee data seems corrupted or incomplete. Re-seeding database...');
        generateSeedData();
      }
    } catch (e) {
      console.error('Failed to parse db_store.json. Restoring with seeds...', e);
      generateSeedData();
    }
  } else {
    generateSeedData();
  }
}

// Ensure database initialized immediately
initializeDatabase();

/**
 * Database Getter and Setter Methods for REST API and Gemini Actions
 */
export const DbService = {
  getStats(): DbStats {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const newJoiners = employees.filter(e => e.status === 'New Joiner').length;
    const unassignedJoiners = employees.filter(e => e.status === 'New Joiner' && e.seatId === null).length;
    
    const allSeats = Array.from(seats.values());
    const totalSeats = allSeats.length;
    const occupiedSeats = allSeats.filter(s => s.employeeId !== null).length;
    const vacantSeats = totalSeats - occupiedSeats;
    const utilizationRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 10000) / 100 : 0;

    return {
      totalEmployees,
      activeEmployees,
      newJoiners,
      unassignedJoiners,
      totalSeats,
      occupiedSeats,
      vacantSeats,
      utilizationRate
    };
  },

  getProjects(): Project[] {
    return projects;
  },

  createProject(proj: Omit<Project, 'color'>): Project {
    const color = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    const newProj: Project = { ...proj, color };
    projects.push(newProj);
    saveToDisk();
    return newProj;
  },

  getEmployees(limit = 100, offset = 0, textSearch = '', projectCode = '', floor: number | null = null, zone = '', isUnassigned = false): { data: Employee[], total: number } {
    let filtered = employees;

    if (isUnassigned) {
      filtered = filtered.filter(e => e.seatId === null && e.status !== 'Resigned');
    }

    if (textSearch) {
      const searchLower = textSearch.toLowerCase().trim();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(searchLower) ||
        e.id.toLowerCase().includes(searchLower) ||
        e.email.toLowerCase().includes(searchLower) ||
        e.role.toLowerCase().includes(searchLower) ||
        e.department.toLowerCase().includes(searchLower) ||
        (e.seatId && e.seatId.toLowerCase().includes(searchLower))
      );
    }

    if (projectCode) {
      filtered = filtered.filter(e => e.projectCode === projectCode);
    }

    if (floor !== null || zone) {
      filtered = filtered.filter(e => {
        if (!e.seatId) return false;
        const seatObj = seats.get(e.seatId);
        if (!seatObj) return false;
        if (floor !== null && seatObj.floor !== floor) return false;
        if (zone && seatObj.zone !== zone) return false;
        return true;
      });
    }

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return { data, total };
  },

  getEmployeeById(id: string): Employee | undefined {
    return employees.find(e => e.id === id);
  },

  getEmployeeBySeat(seatId: string): Employee | undefined {
    return employees.find(e => e.seatId === seatId);
  },

  getSeats(floor: number, zone: string): Seat[] {
    const allSeats = Array.from(seats.values());
    return allSeats.filter(s => s.floor === floor && s.zone === zone);
  },

  getSeatMapUtilization(): Record<string, { total: number, occupied: number, rate: number }> {
    const map: Record<string, { total: number, occupied: number, rate: number }> = {};
    
    // Floors 1-4, Zones A-D
    for (let floor = 1; floor <= 4; floor++) {
      for (const zone of ['A', 'B', 'C', 'D']) {
        const key = `F${floor}-Z${zone}`;
        map[key] = { total: 0, occupied: 0, rate: 0 };
      }
    }

    for (const seat of seats.values()) {
      const key = `F${seat.floor}-Z${seat.zone}`;
      if (map[key]) {
        map[key].total++;
        if (seat.employeeId) {
          map[key].occupied++;
        }
      }
    }

    for (const key of Object.keys(map)) {
      const entry = map[key];
      entry.rate = entry.total > 0 ? Math.round((entry.occupied / entry.total) * 100) : 0;
    }

    return map;
  },

  allocateSeat(employeeId: string, seatId: string): { success: boolean, message: string, employee?: Employee } {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) {
      return { success: false, message: `Employee with ID ${employeeId} not found.` };
    }

    if (emp.status === 'Resigned') {
      return { success: false, message: `Cannot allocate seat to resigned employee.` };
    }

    const seat = seats.get(seatId);
    if (!seat) {
      return { success: false, message: `Seat ${seatId} does not exist.` };
    }

    if (seat.employeeId && seat.employeeId !== employeeId) {
      return { success: false, message: `Seat ${seatId} is already occupied by employee ID ${seat.employeeId}.` };
    }

    // Capture previous seat for transition
    const previousSeatId = emp.seatId;

    if (previousSeatId === seatId) {
      return { success: true, message: `Employee already assigned to seat ${seatId}.`, employee: emp };
    }

    // Release previous seat if occupied
    if (previousSeatId) {
      const prevSeat = seats.get(previousSeatId);
      if (prevSeat) {
        prevSeat.employeeId = null;
        seats.set(previousSeatId, prevSeat);
      }
    }

    // Assign new seat to employee
    emp.seatId = seatId;
    if (emp.status === 'New Joiner') {
      // Re-profile to Active when desk assigned if preferred, or maintain status
    }

    // Assign employee to seat map
    seat.employeeId = employeeId;
    seats.set(seatId, seat);

    // Create audit log
    const logId = `LOG-${String(logs.length + 1).padStart(4, '0')}`;
    const log: AllocationLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      employeeId,
      employeeName: emp.name,
      action: previousSeatId ? 'reassign' : 'allocate',
      seatId,
      previousSeatId,
      details: previousSeatId 
        ? `Reassigned from seat ${previousSeatId} to ${seatId} under project ${emp.projectCode || 'Unassigned'}`
        : `Allocated first-time seat ${seatId} under project ${emp.projectCode || 'Unassigned'}`
    };
    logs.unshift(log);

    saveToDisk();
    return { success: true, message: `Successfully allocated seat ${seatId} to ${emp.name}.`, employee: emp };
  },

  releaseSeat(employeeId: string): { success: boolean, message: string, employee?: Employee } {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) {
      return { success: false, message: `Employee with ID ${employeeId} not found.` };
    }

    const seatId = emp.seatId;
    if (!seatId) {
      return { success: true, message: `Employee ${emp.name} already has no assigned seat.` };
    }

    // Free the seat
    const seat = seats.get(seatId);
    if (seat) {
      seat.employeeId = null;
      seats.set(seatId, seat);
    }

    emp.seatId = null;

    // Create log
    const logId = `LOG-${String(logs.length + 1).padStart(4, '0')}`;
    const log: AllocationLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      employeeId,
      employeeName: emp.name,
      action: 'release',
      seatId: null,
      previousSeatId: seatId,
      details: `Released seat ${seatId}. Previously managed under project ${emp.projectCode || 'None'}`
    };
    logs.unshift(log);

    saveToDisk();
    return { success: true, message: `Successfully released seat ${seatId} from ${emp.name}.`, employee: emp };
  },

  updateEmployee(employeeId: string, updates: Partial<Omit<Employee, 'id' | 'seatId'>>): { success: boolean, message: string, employee?: Employee } {
    const empIdx = employees.findIndex(e => e.id === employeeId);
    if (empIdx === -1) {
      return { success: false, message: `Employee ${employeeId} not found.` };
    }

    const oldProject = employees[empIdx].projectCode;
    employees[empIdx] = { ...employees[empIdx], ...updates };
    
    // If project code changed, we can write a transition note
    if (updates.projectCode !== undefined && updates.projectCode !== oldProject) {
      const logId = `LOG-${String(logs.length + 1).padStart(4, '0')}`;
      logs.unshift({
        id: logId,
        timestamp: new Date().toISOString(),
        employeeId,
        employeeName: employees[empIdx].name,
        action: 'reassign',
        seatId: employees[empIdx].seatId,
        previousSeatId: employees[empIdx].seatId,
        details: `Updated project mapping from ${oldProject || 'None'} to ${updates.projectCode || 'None'}`
      });
    }

    saveToDisk();
    return { success: true, message: `Employee ${employees[empIdx].name} updated successfully.`, employee: employees[empIdx] };
  },

  getLogs(limit = 50): AllocationLog[] {
    return logs.slice(0, limit);
  },

  autoAllocateJoiners(): { allocatedCount: number, details: string[] } {
    const unassigned = employees.filter(e => e.status === 'New Joiner' && e.seatId === null);
    const details: string[] = [];
    let count = 0;

    for (const emp of unassigned) {
      // Find a seat near project target zone
      const proj = projects.find(p => p.code === emp.projectCode);
      const zonesToSearch = proj ? [proj.targetZone] : [];
      
      // Expand search zones
      for (let floor = 1; floor <= 4; floor++) {
        for (const zone of ['A', 'B', 'C', 'D']) {
          const zCode = `F${floor}-Z${zone}`;
          if (!zonesToSearch.includes(zCode)) {
            zonesToSearch.push(zCode);
          }
        }
      }

      // Find first vacant seat in the zones list
      let allocatedSeatId: string | null = null;
      for (const zoneCode of zonesToSearch) {
        const [floorStr, zoneStr] = zoneCode.split('-Z');
        const floorNum = parseInt(floorStr.substring(1), 10);
        
        const zoneSeats = Array.from(seats.values()).filter(s => s.floor === floorNum && s.zone === zoneStr && s.employeeId === null);
        if (zoneSeats.length > 0) {
          allocatedSeatId = zoneSeats[0].id;
          break;
        }
      }

      if (allocatedSeatId) {
        const result = this.allocateSeat(emp.id, allocatedSeatId);
        if (result.success) {
          count++;
          details.push(`Auto-allocated new joiner ${emp.name} (${emp.id}) to vacant seat ${allocatedSeatId} under project ${emp.projectCode || 'None'}`);
        }
      } else {
        details.push(`Failed to auto-allocate ${emp.name}: No vacant seats available in building.`);
      }
    }

    return { allocatedCount: count, details };
  }
};
