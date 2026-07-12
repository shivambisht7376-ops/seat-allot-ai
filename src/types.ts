/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  projectCode: string | null;
  seatId: string | null;
  status: 'Active' | 'New Joiner' | 'Resigned';
  joinDate: string;
}

export interface Project {
  code: string;
  name: string;
  lead: string;
  color: string;
  targetZone: string; // e.g. "F1-ZA"
}

export interface Seat {
  id: string; // e.g. "F1-ZA-001"
  floor: number;
  zone: string; // A, B, C, D
  number: number;
  employeeId: string | null;
}

export interface DbStats {
  totalEmployees: number;
  activeEmployees: number;
  newJoiners: number;
  unassignedJoiners: number;
  totalSeats: number;
  occupiedSeats: number;
  vacantSeats: number;
  utilizationRate: number;
}

export interface AllocationLog {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  action: 'allocate' | 'release' | 'reassign';
  seatId: string | null;
  previousSeatId: string | null;
  details: string;
}

export interface SearchQuery {
  text: string;
  floor: number | null;
  zone: string | null;
  projectCode: string | null;
  status: string | null;
  isUnassigned: boolean;
}
