/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, X, Check, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Seat, Employee, Project } from '../types.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface SeatingMapProps {
  id: string;
  projects: Project[];
  onStatsChanged: () => void;
  readOnly?: boolean;
}

export function SeatingMap({ id, projects, onStatsChanged, readOnly = false }: SeatingMapProps) {
  const authHeader = useAuthHeader();
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedZone, setSelectedZone] = useState<string>('A');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [seatEmployee, setSeatEmployee] = useState<Employee | null>(null);
  
  // Quick Search state for map highlighting
  const [highlightTerm, setHighlightTerm] = useState<string>('');
  
  // Selection/Assignment states
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [unassignedList, setUnassignedList] = useState<Employee[]>([]);
  const [assigningLoading, setAssigningLoading] = useState<boolean>(false);

  // Load seats for selected Floor and Zone
  const loadSeats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seats?floor=${selectedFloor}&zone=${selectedZone}`, { headers: authHeader as any });
      if (res.ok) {
        const data = await res.json();
        setSeats(data);
      }
    } catch (err) {
      console.error('Failed to load seats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats();
  }, [selectedFloor, selectedZone]);

  // Load currently seated employee when a seat is clicked
  useEffect(() => {
    if (selectedSeat && selectedSeat.employeeId) {
      fetch(`/api/employees/${selectedSeat.employeeId}`)
        .then(res => res.json())
        .then(data => setSeatEmployee(data))
        .catch(() => setSeatEmployee(null));
    } else {
      setSeatEmployee(null);
    }
    
    // Clear assign search
    setAssignSearch('');
  }, [selectedSeat]);

  // Load list of unassigned employees for seat assignment dropdown
  const loadUnassignedEmployees = async () => {
    try {
      const res = await fetch(`/api/employees?limit=30&isUnassigned=true&textSearch=${assignSearch}`);
      if (res.ok) {
        const result = await res.json();
        setUnassignedList(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedSeat && !selectedSeat.employeeId) {
      loadUnassignedEmployees();
    }
  }, [selectedSeat, assignSearch]);

  // Allocate seat
  const handleAllocate = async (empId: string) => {
    if (!selectedSeat) return;
    setAssigningLoading(true);
    try {
      const res = await fetch('/api/seats/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId, seatId: selectedSeat.id })
      });
      if (res.ok) {
        // Refresh local seats and trigger callback
        await loadSeats();
        setSelectedSeat(null);
        onStatsChanged();
      } else {
        const errorData = await res.json();
        alert(`Allocation error: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigningLoading(false);
    }
  };

  // Release seat
  const handleRelease = async (empId: string) => {
    if (!confirm('Are you sure you want to release this seat allocation?')) return;
    setAssigningLoading(true);
    try {
      const res = await fetch('/api/seats/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId })
      });
      if (res.ok) {
        await loadSeats();
        setSelectedSeat(null);
        onStatsChanged();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigningLoading(false);
    }
  };

  // Helper: map a project code to color for seat badge
  const getProjectColor = (projectCode: string | null) => {
    if (!projectCode) return '#cbd5e1'; // slate-300
    const proj = projects.find(p => p.code === projectCode);
    return proj ? proj.color : '#cbd5e1';
  };

  // Determine if a seat should highlight because it matches highlight term
  const matchesHighlight = (seat: Seat) => {
    if (!highlightTerm) return false;
    const term = highlightTerm.toUpperCase();
    if (seat.id.includes(term)) return true;
    if (seat.employeeId && seat.employeeId.includes(term)) return true;
    return false;
  };

  return (
    <div id={id} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Floor Plan & Map Configuration Side (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        
        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(floor => (
              <button
                key={floor}
                id={`btn-floor-${floor}`}
                onClick={() => setSelectedFloor(floor)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  selectedFloor === floor
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Floor {floor}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {['A', 'B', 'C', 'D'].map(zone => (
              <button
                key={zone}
                id={`btn-zone-${zone}`}
                onClick={() => setSelectedZone(zone)}
                className={`w-10 h-10 flex items-center justify-center font-bold text-sm rounded-lg border transition-all duration-200 ${
                  selectedZone === zone
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>

          {/* Map Highlighting search bar */}
          <div className="relative w-full sm:w-60">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              id="map-highlight-input"
              value={highlightTerm}
              onChange={(e) => setHighlightTerm(e.target.value)}
              placeholder="Highlight Seat or Emp ID..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {highlightTerm && (
              <button
                onClick={() => setHighlightTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-center text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm bg-slate-100 border border-slate-200"></div>
            <span>Vacant Seat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm bg-blue-100 border border-blue-200"></div>
            <span>Occupied Seat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm border-2 border-yellow-400 bg-white"></div>
            <span>Search Highlight</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">350 desks</span> in Zone {selectedZone}
          </div>
        </div>

        {/* Seating Grid Stage */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-auto shadow-xs min-h-[460px] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500 font-sans">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
              <span>Loading Layout Plans...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="text-center font-semibold text-xs text-slate-400 font-sans uppercase tracking-wider mb-2">
                ZONE {selectedZone} FRONT DESKS / INGRESS PATHWAY
              </div>
              
              {/* Desks Grid: 14 rows, 25 columns */}
              <div className="grid grid-cols-25 gap-2.5 max-w-[700px]">
                {seats.map((seat, index) => {
                  const isOccupied = seat.employeeId !== null;
                  const isHighlighted = matchesHighlight(seat);
                  const isSelected = selectedSeat?.id === seat.id;
                  
                  return (
                    <motion.button
                      key={seat.id}
                      id={`seat-tile-${seat.id}`}
                      whileHover={{ scale: 1.15, zIndex: 10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      onClick={() => setSelectedSeat(seat)}
                      className={`w-5.5 h-5.5 rounded-md flex items-center justify-center text-[8px] font-bold cursor-pointer relative transition-all ${
                        isSelected 
                          ? 'ring-2 ring-blue-600 ring-offset-2 z-20 scale-110'
                          : isHighlighted 
                          ? 'ring-2 ring-yellow-400 ring-offset-1 z-10 animate-pulse'
                          : isOccupied 
                          ? 'bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-700' 
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      title={`${seat.id} ${isOccupied ? '(Occupied)' : '(Vacant)'}`}
                    >
                      {/* Visual Project Accent Border for occupied seats */}
                      {isOccupied && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-md"
                          style={{ backgroundColor: getProjectColor(seat.employeeId) }}
                        />
                      )}
                      {seat.number}
                    </motion.button>
                  );
                })}
              </div>

              <div className="text-center font-semibold text-xs text-slate-400 font-sans uppercase tracking-wider mt-4">
                ZONE {selectedZone} REAR WALL / SERVICE DUCTS
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seat Detail Sidebar / Allocation Controls (4 cols) */}
      <div className="lg:col-span-4">
        <AnimatePresence mode="wait">
          {selectedSeat ? (
            <motion.div
              key="detail-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[500px]"
            >
              <div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h4 className="text-lg font-bold font-sans text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Seat {selectedSeat.id}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Floor {selectedSeat.floor} • Zone {selectedSeat.zone} • Desk {selectedSeat.number}</p>
                  </div>
                  <button 
                    id="btn-close-seat-detail"
                    onClick={() => setSelectedSeat(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {selectedSeat.employeeId ? (
                  /* Occupied Seat View */
                  <div className="space-y-4">
                    {seatEmployee ? (
                      <>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                            {seatEmployee.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm leading-tight">{seatEmployee.name}</h5>
                            <span className="text-xs text-slate-500 font-mono">{seatEmployee.id}</span>
                          </div>
                        </div>

                        <div className="space-y-2.5 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Role</span>
                            <span className="font-semibold text-slate-800 text-right">{seatEmployee.role}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Department</span>
                            <span className="font-semibold text-slate-800">{seatEmployee.department}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-sans">Project Group</span>
                            <span 
                              className="px-2 py-0.5 rounded-md font-bold text-[10px]"
                              style={{ 
                                backgroundColor: `${getProjectColor(seatEmployee.projectCode)}15`, 
                                color: getProjectColor(seatEmployee.projectCode),
                                border: `1px solid ${getProjectColor(seatEmployee.projectCode)}30`
                              }}
                            >
                              {seatEmployee.projectCode || 'UNASSIGNED'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Status</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              seatEmployee.status === 'New Joiner' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {seatEmployee.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Joined Date</span>
                            <span className="font-semibold text-slate-800">{seatEmployee.joinDate}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 mt-4">
                          <button
                            id={`btn-release-seat-${selectedSeat.id}`}
                            onClick={() => handleRelease(seatEmployee.id)}
                            disabled={assigningLoading}
                            className="w-full py-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
                          >
                            Release Seat Assignment
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"></div>
                        <span className="text-xs text-slate-400 font-sans">Loading occupant record...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Vacant Seat Allocation Screen */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>This desk is vacant. You can assign it to any unallocated team member below.</span>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-sans">Select Employee</label>
                      
                      {/* Embedded filter inside sidebar */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          id="sidebar-assign-search"
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          placeholder="Search unassigned joiner..."
                          className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                        />
                      </div>

                      {/* Filtered Employees Dropdown/List */}
                      <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-[220px] bg-slate-50 divide-y divide-slate-100">
                        {unassignedList.length > 0 ? (
                          unassignedList.map(emp => (
                            <button
                              key={emp.id}
                              id={`assign-emp-btn-${emp.id}`}
                              onClick={() => handleAllocate(emp.id)}
                              className="w-full text-left p-2.5 hover:bg-blue-50/50 flex items-center justify-between text-xs transition"
                            >
                              <div className="pr-2 truncate">
                                <div className="font-semibold text-slate-800 truncate">{emp.name}</div>
                                <div className="text-slate-400 font-mono text-[10px] mt-0.5">{emp.id} • {emp.role}</div>
                              </div>
                              <div className="flex-shrink-0">
                                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-bold">
                                  {emp.projectCode || 'None'}
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400 font-sans">
                            No unassigned employees found.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 text-center font-sans border-t border-slate-100 pt-3">
                Workspace allocations log instantly for corporate safety and auditing.
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="no-select-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[500px]"
            >
              <div className="w-12 h-12 rounded-xl bg-white border shadow-xs flex items-center justify-center text-slate-400 mb-4">
                <User className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Select a desk to begin</h4>
              <p className="text-xs text-slate-500 font-sans max-w-[200px] mt-2">
                Click any desk slot in the seating layout grid to view workspace profiles, change allocations, or map teams.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
