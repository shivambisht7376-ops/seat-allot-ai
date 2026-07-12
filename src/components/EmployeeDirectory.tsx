/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, UserMinus, Plus, UserCheck, SlidersHorizontal, RefreshCw, AlertCircle, UserX, Briefcase, UserPlus } from 'lucide-react';
import { Employee, Project } from '../types.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface EmployeeDirectoryProps {
  id: string;
  projects: Project[];
  onStatsChanged: () => void;
  userRole?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
}

export function EmployeeDirectory({ id, projects, onStatsChanged, userRole = 'EMPLOYEE' }: EmployeeDirectoryProps) {
  const authHeader = useAuthHeader();
  const canManage = userRole === 'ADMIN' || userRole === 'MANAGER';
  const canDelete = userRole === 'ADMIN';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Filter States
  const [searchText, setSearchText] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [isUnassigned, setIsUnassigned] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Active Selected Employee for editing/profile modal
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [updateProjectLoading, setUpdateProjectLoading] = useState<boolean>(false);
  
  // Add Employee State
  const [isAddingEmployee, setIsAddingEmployee] = useState<boolean>(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addJoinDate, setAddJoinDate] = useState('');
  const [addProjectCode, setAddProjectCode] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Seat Reassignment State
  const [reassignSeatId, setReassignSeatId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [vacantSeats, setVacantSeats] = useState<any[]>([]);
  const [loadingVacantSeats, setLoadingVacantSeats] = useState(false);

  useEffect(() => {
    if (editingEmployee) {
      setLoadingVacantSeats(true);
      fetch('/api/seats/vacant', { headers: authHeader as any })
        .then(res => res.json())
        .then(data => setVacantSeats(data || []))
        .catch(err => console.error(err))
        .finally(() => setLoadingVacantSeats(false));
    }
  }, [editingEmployee]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const floorQuery = selectedFloor ? `&floor=${selectedFloor}` : '';
      const zoneQuery = selectedZone ? `&zone=${selectedZone}` : '';
      const projQuery = selectedProject ? `&projectCode=${selectedProject}` : '';
      const textQuery = searchText ? `&textSearch=${encodeURIComponent(searchText)}` : '';
      const unassignedQuery = isUnassigned ? `&isUnassigned=true` : '';

      const res = await fetch(
        `/api/employees?limit=${limit}&offset=${offset}${textQuery}${projQuery}${floorQuery}${zoneQuery}${unassignedQuery}`,
        { headers: authHeader as any }
      );
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [offset, selectedProject, selectedFloor, selectedZone, isUnassigned]);

  // Handle live search typing debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setOffset(0);
      fetchEmployees();
    }, 300);

    return () => clearTimeout(handler);
  }, [searchText]);

  const handlePageChange = (newOffset: number) => {
    if (newOffset >= 0 && newOffset < total) {
      setOffset(newOffset);
    }
  };

  const handleReleaseSeat = async (empId: string) => {
    if (!confirm('Release the desk allocation for this employee?')) return;
    try {
      const res = await fetch('/api/seats/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({ employeeId: empId })
      });
      if (res.ok) {
        fetchEmployees();
        onStatsChanged();
        if (editingEmployee && editingEmployee.id === empId) {
          setEditingEmployee(prev => prev ? { ...prev, seatId: null } : null);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleTerminate = async (empId: string, empName: string) => {
    if (!confirm(`Terminate ${empName}? This will release their seat and mark them as Resigned.`)) return;
    try {
      const res = await fetch(`/api/employees/${empId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
      });
      if (res.ok) { fetchEmployees(); onStatsChanged(); setEditingEmployee(null); }
      else { const d = await res.json(); alert(d.error ?? 'Failed to terminate.'); }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (empId: string, empName: string) => {
    if (!confirm(`WARNING: Completely delete employee record for ${empName}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { ...(authHeader as any) }
      });
      if (res.ok) { fetchEmployees(); onStatsChanged(); setEditingEmployee(null); }
      else { const d = await res.json(); alert(d.error ?? 'Failed to delete.'); }
    } catch (err) { console.error(err); }
  };

  const handleUpdateProject = async (empId: string, projCode: string) => {
    setUpdateProjectLoading(true);
    try {
      const res = await fetch(`/api/employees/${empId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({ projectCode: projCode || null })
      });
      if (res.ok) {
        fetchEmployees();
        onStatsChanged();
        if (editingEmployee && editingEmployee.id === empId) {
          setEditingEmployee(prev => prev ? { ...prev, projectCode: projCode || null } : null);
        }
      }
    } catch (err) { console.error(err); }
    finally { setUpdateProjectLoading(false); }
  };
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addEmail || !addRole || !addDepartment || !addJoinDate) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          role: addRole.trim(),
          department: addDepartment.trim(),
          joinDate: addJoinDate,
          projectCode: addProjectCode.trim() || undefined,
          status: 'Active'
        })
      });
      if (res.ok) {
        setIsAddingEmployee(false);
        setAddName('');
        setAddEmail('');
        setAddRole('');
        setAddDepartment('');
        setAddJoinDate('');
        setAddProjectCode('');
        fetchEmployees();
        onStatsChanged();
      } else {
        const d = await res.json();
        alert(`Error creating employee: ${d.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleReassignSeatSubmit = async (empId: string, oldSeatId: string | null) => {
    if (!reassignSeatId.trim()) return;
    setReassignLoading(true);
    try {
      // Allocate new seat (backend automatically releases old seat)
      const res = await fetch('/api/seats/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({ employeeId: empId, seatId: reassignSeatId.trim().toUpperCase() })
      });

      if (res.ok) {
        setReassignSeatId('');
        fetchEmployees();
        onStatsChanged();
        if (editingEmployee && editingEmployee.id === empId) {
          setEditingEmployee(prev => prev ? { ...prev, seatId: reassignSeatId.trim().toUpperCase() } : null);
        }
      } else {
        const d = await res.json();
        alert(`Failed to allocate seat: ${d.error}`);
        // If release succeeded but allocate failed, refresh anyway
        fetchEmployees();
        onStatsChanged();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReassignLoading(false);
    }
  };
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div id={id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      
      {/* Header and Quick Filters */}
      <div className="p-5 border-b border-slate-150">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-indigo-900 font-sans">Corporate Directory</h3>
            <p className="text-xs text-indigo-500 font-sans mt-0.5">Manage details and assignments for {total.toLocaleString()} employees</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-indigo-400" />
              <input 
                type="text" 
                placeholder="Search name, ID, or role..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              id="btn-toggle-filters"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border rounded-lg transition cursor-pointer ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-indigo-500 hover:bg-slate-50'}`}
              title="Advanced Filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {canManage && (
              <button
                onClick={() => setIsAddingEmployee(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Filters Drawer */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <label className="block font-bold text-indigo-600 mb-1">Project Mapping</label>
              <select
                id="filter-project"
                value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setOffset(0); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-indigo-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-indigo-600 mb-1">Floor Level</label>
              <select
                id="filter-floor"
                value={selectedFloor}
                onChange={(e) => { setSelectedFloor(e.target.value); setOffset(0); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-indigo-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Floors</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
                <option value="3">Floor 3</option>
                <option value="4">Floor 4</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-indigo-600 mb-1">Zone Letter</label>
              <select
                id="filter-zone"
                value={selectedZone}
                onChange={(e) => { setSelectedZone(e.target.value); setOffset(0); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-indigo-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Zones</option>
                <option value="A">Zone A</option>
                <option value="B">Zone B</option>
                <option value="C">Zone C</option>
                <option value="D">Zone D</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-600">
                <input
                  type="checkbox"
                  id="filter-unassigned"
                  checked={isUnassigned}
                  onChange={(e) => { setIsUnassigned(e.target.checked); setOffset(0); }}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span>Unallocated Desk Only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-indigo-700">
          <thead className="bg-slate-50 text-indigo-500 uppercase font-bold text-[10px] tracking-wider font-sans border-b border-slate-150">
            <tr>
              <th className="px-6 py-3.5">Employee ID</th>
              <th className="px-6 py-3.5">Full Name / Email</th>
              <th className="px-6 py-3.5">Role / Department</th>
              <th className="px-6 py-3.5">Assigned Project</th>
              <th className="px-6 py-3.5">Seat Assignment</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-indigo-400">
                  <div className="flex items-center justify-center gap-2.5">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                    <span>Querying enterprise directory...</span>
                  </div>
                </td>
              </tr>
            ) : employees.length > 0 ? (
              employees.map(emp => (
                <tr 
                  key={emp.id} 
                  id={`employee-row-${emp.id}`}
                  className="hover:bg-slate-50/50 transition duration-150 cursor-pointer"
                  onClick={() => setEditingEmployee(emp)}
                >
                  <td className="px-6 py-4 font-mono font-semibold text-xs text-indigo-500">{emp.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-indigo-900 leading-tight">{emp.name}</div>
                    <div className="text-xs text-indigo-400 mt-0.5">{emp.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-indigo-800 font-medium">{emp.role}</div>
                    <div className="text-xs text-indigo-400 mt-0.5">{emp.department}</div>
                  </td>
                  <td className="px-6 py-4">
                    {emp.projectCode ? (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-semibold">
                        {emp.projectCode}
                      </span>
                    ) : (
                      <span className="text-xs text-indigo-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {emp.seatId ? (
                      <span className="text-indigo-800 font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                        {emp.seatId}
                      </span>
                    ) : (
                      <span className="text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-2 py-1 rounded text-[11px] inline-flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> No Desk
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      emp.status === 'Active' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : emp.status === 'New Joiner' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-slate-150 text-indigo-600'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {emp.seatId && (
                        <button
                          id={`release-seat-btn-${emp.id}`}
                          onClick={() => handleReleaseSeat(emp.id)}
                          title="Release assigned seat"
                          className="p-1.5 border border-slate-200 text-indigo-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 rounded-lg transition"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        id={`edit-profile-btn-${emp.id}`}
                        onClick={() => setEditingEmployee(emp)}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-lg text-xs font-semibold"
                      >
                        Profile
                      </button>
                      {canManage && emp.status !== 'Resigned' && (
                        <button
                          id={`btn-terminate-${emp.id}`}
                          onClick={() => handleTerminate(emp.id, emp.name)}
                          className="px-2.5 py-1.5 border border-amber-200 hover:bg-amber-50 text-amber-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                          title="Mark Resigned"
                        >
                          <UserX className="w-3 h-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          id={`btn-delete-${emp.id}`}
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                          title="Permanently Delete"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-indigo-400 font-sans">
                  No employee match found in enterprise directory. Try broad searches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between font-sans text-xs">
        <span className="text-indigo-500 font-medium">
          Showing <span className="font-bold text-indigo-800">{offset + 1}</span> to <span className="font-bold text-indigo-800">{Math.min(offset + limit, total)}</span> of <span className="font-bold text-indigo-800">{total.toLocaleString()}</span> employees
        </span>
        
        <div className="flex gap-1.5">
          <button
            id="btn-prev-page"
            onClick={() => handlePageChange(offset - limit)}
            disabled={offset === 0}
            className="p-1.5 border border-slate-200 rounded-lg hover:bg-white bg-slate-50 text-indigo-500 disabled:opacity-50 transition cursor-pointer"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          
          <div className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-indigo-700 font-sans">
            Page {currentPage} of {totalPages}
          </div>

          <button
            id="btn-next-page"
            onClick={() => handlePageChange(offset + limit)}
            disabled={offset + limit >= total}
            className="p-1.5 border border-slate-200 rounded-lg hover:bg-white bg-slate-50 text-indigo-500 disabled:opacity-50 transition cursor-pointer"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Employee Profile and Seating Edit Slide-Over/Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 relative">
            <button
              id="btn-close-editing-modal"
              onClick={() => setEditingEmployee(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-indigo-400 hover:text-indigo-600 transition"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4 mb-4">
              <div className="w-12 h-12 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center text-base">
                {editingEmployee.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-indigo-900">{editingEmployee.name}</h4>
                <p className="text-xs font-mono text-indigo-400">{editingEmployee.id} • Joined: {editingEmployee.joinDate}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <label className="text-indigo-400 block mb-0.5">Title / Role</label>
                  <span className="font-bold text-indigo-800 text-sm block">{editingEmployee.role}</span>
                </div>
                <div>
                  <label className="text-indigo-400 block mb-0.5">Department</label>
                  <span className="font-bold text-indigo-800 text-sm block">{editingEmployee.department}</span>
                </div>
              </div>

              <div>
                <label className="text-indigo-400 text-xs block mb-1 font-sans">Current Seating Desk</label>
                {editingEmployee.seatId ? (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs mb-2">
                    <div>
                      <span className="font-bold text-indigo-800">{editingEmployee.seatId}</span>
                      <span className="text-indigo-400 text-[10px] ml-2 font-sans">(Physical Slot Allocated)</span>
                    </div>
                    <button
                      id={`modal-release-btn-${editingEmployee.id}`}
                      onClick={() => handleReleaseSeat(editingEmployee.id)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold rounded-md transition"
                    >
                      Release Seat
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs flex justify-between items-center font-sans mb-2">
                    <span className="font-semibold">No seat currently allocated</span>
                    <span className="text-[10px] bg-white border border-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold uppercase">Pending</span>
                  </div>
                )}
                <div className="flex gap-2 items-center mt-2">
                  <select
                    value={reassignSeatId}
                    onChange={(e) => setReassignSeatId(e.target.value)}
                    disabled={loadingVacantSeats}
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">
                      {loadingVacantSeats ? 'Loading seats...' : 'Select a vacant seat...'}
                    </option>
                    {vacantSeats.map(seat => (
                      <option key={seat.id} value={seat.id}>{seat.id}</option>
                    ))}
                  </select>
                  <button
                    disabled={!reassignSeatId.trim() || reassignLoading}
                    onClick={() => handleReassignSeatSubmit(editingEmployee.id, editingEmployee.seatId)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1"
                  >
                    {reassignLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Assign
                  </button>
                </div>
              </div>

              <div>
                <label className="text-indigo-400 text-xs block mb-1 font-sans">Update Project Assignment</label>
                <select
                  id="modal-update-project-select"
                  value={editingEmployee.projectCode || ''}
                  disabled={updateProjectLoading}
                  onChange={(e) => handleUpdateProject(editingEmployee.id, e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Unassigned (General Pool)</option>
                  {projects.map(p => (
                    <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                id="btn-close-modal-bottom"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-6 relative">
            <button onClick={() => setIsAddingEmployee(false)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-indigo-400">
              <XIcon className="w-5 h-5" />
            </button>
            <h4 className="font-extrabold text-indigo-900 mb-4 text-lg">Onboard Employee</h4>
            <form onSubmit={handleAddEmployeeSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-indigo-700 mb-1">Full Name</label>
                <input required type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block font-bold text-indigo-700 mb-1">Email</label>
                <input required type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="john@enterprise.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-indigo-700 mb-1">Role</label>
                  <input required type="text" value={addRole} onChange={e => setAddRole(e.target.value)} placeholder="Developer" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-indigo-700 mb-1">Department</label>
                  <input required type="text" value={addDepartment} onChange={e => setAddDepartment(e.target.value)} placeholder="Engineering" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-indigo-700 mb-1">Join Date</label>
                  <input required type="date" value={addJoinDate} onChange={e => setAddJoinDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-indigo-700 mb-1">Project Code</label>
                  <select value={addProjectCode} onChange={e => setAddProjectCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500">
                    <option value="">Unassigned</option>
                    {projects.map(p => (
                      <option key={p.code} value={p.code}>{p.code}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button disabled={addLoading} type="submit" className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} Create Profile
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple internal X icon for modal close
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
