/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Briefcase, RefreshCw, Layers, CheckCircle, AlertTriangle, Sparkles, Edit2, Users, XIcon, Search } from 'lucide-react';
import { Project, Employee } from '../types.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface ProjectManagerProps {
  id: string;
  projects: Project[];
  onProjectCreated: () => void;
  onStatsChanged: () => void;
}

export function ProjectManager({ id, projects, onProjectCreated, onStatsChanged }: ProjectManagerProps) {
  const authHeader = useAuthHeader();
  const [loading, setLoading] = useState<boolean>(false);
  const [projectStats, setProjectStats] = useState<Record<string, { count: number, seated: number }>>({});
  
  // Create Project Form States
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [lead, setLead] = useState<string>('');
  const [targetZone, setTargetZone] = useState<string>('F1-ZA');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  
  // Edit & Team Management States
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editLead, setEditLead] = useState<string>('');
  const [editTargetZone, setEditTargetZone] = useState<string>('');
  const [editLoading, setEditLoading] = useState<boolean>(false);
  
  const [managingTeamProject, setManagingTeamProject] = useState<Project | null>(null);
  const [unassignedSearch, setUnassignedSearch] = useState<string>('');
  const [unassignedList, setUnassignedList] = useState<Employee[]>([]);
  const [selectedToAssign, setSelectedToAssign] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);

  const fetchProjectStats = async () => {
    setLoading(true);
    try {
      // Fetch stats of project memberships from directory
      const res = await fetch('/api/employees?limit=5000', { headers: authHeader as any });
      if (res.ok) {
        const result = await res.json();
        const roster: Employee[] = result.data;
        
        const statsMap: Record<string, { count: number, seated: number }> = {};
        
        // Initialize
        projects.forEach(p => {
          statsMap[p.code] = { count: 0, seated: 0 };
        });

        roster.forEach(emp => {
          if (emp.projectCode && statsMap[emp.projectCode]) {
            statsMap[emp.projectCode].count++;
            if (emp.seatId) {
              statsMap[emp.projectCode].seated++;
            }
          }
        });

        setProjectStats(statsMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectStats();
  }, [projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !lead.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({
          code: `PROJ-${code.trim().toUpperCase()}`,
          name: name.trim(),
          lead: lead.trim(),
          targetZone
        })
      });

      if (res.ok) {
        setCode('');
        setName('');
        setLead('');
        setTargetZone('F1-ZA');
        setShowAddForm(false);
        onProjectCreated();
        onStatsChanged();
      } else {
        const data = await res.json();
        alert(`Error creating project: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim() || !editLead.trim()) return;

    setEditLoading(true);
    try {
      const res = await fetch(`/api/projects/${editingProject.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({
          name: editName.trim(),
          lead: editLead.trim(),
          targetZone: editTargetZone
        })
      });

      if (res.ok) {
        setEditingProject(null);
        onProjectCreated();
      } else {
        const data = await res.json();
        alert(`Error updating project: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditLoading(false);
    }
  };

  const loadUnassigned = async (search = '') => {
    try {
      const res = await fetch(`/api/employees?limit=50&isUnassigned=true&textSearch=${search}`, { headers: authHeader as any });
      if (res.ok) {
        const result = await res.json();
        setUnassignedList(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (managingTeamProject) {
      loadUnassigned(unassignedSearch);
    }
  }, [managingTeamProject, unassignedSearch]);

  const handleAssignSelected = async () => {
    if (!managingTeamProject || selectedToAssign.length === 0) return;
    setAssignLoading(true);
    try {
      // Assign sequentially
      for (const empId of selectedToAssign) {
        await fetch(`/api/employees/${empId}/assign-project`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
          body: JSON.stringify({ projectCode: managingTeamProject.code })
        });
      }
      setManagingTeamProject(null);
      setSelectedToAssign([]);
      onStatsChanged();
      onProjectCreated();
      fetchProjectStats();
    } catch (err) {
      console.error(err);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div id={id} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* List of active projects with utilization cards */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-sans">Project & Workspace Mapping</h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Assigned designated corporate zones and seating utilization metrics</p>
          </div>

          <button
            id="btn-show-add-project"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Map New Project</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Recalculating project allocations...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(proj => {
              const stats = projectStats[proj.code] || { count: 0, seated: 0 };
              const unseated = stats.count - stats.seated;
              const rate = stats.count > 0 ? Math.round((stats.seated / stats.count) * 100) : 0;
              
              return (
                <div
                  key={proj.code}
                  id={`project-card-${proj.code}`}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition duration-150"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3.5 h-3.5 rounded-sm"
                          style={{ backgroundColor: proj.color }}
                        />
                        <h4 className="font-bold text-slate-900 text-sm">{proj.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                          {proj.code}
                        </span>
                        <button 
                          onClick={() => {
                            setEditingProject(proj);
                            setEditName(proj.name);
                            setEditLead(proj.lead);
                            setEditTargetZone(proj.targetZone);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Edit Project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-sans">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Project Lead</span>
                        <span className="font-semibold text-slate-800">{proj.lead}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Target Workspace</span>
                        <span className="font-semibold text-slate-800 font-mono">{proj.targetZone.replace('-', ' • ')}</span>
                      </div>
                    </div>

                    {/* Progress slider bar */}
                    <div className="mt-5">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold font-sans uppercase tracking-wider mb-1.5">
                        <span>Seating Allocation</span>
                        <span>{rate}% Seated ({stats.seated}/{stats.count})</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${rate}%`, backgroundColor: proj.color }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold font-mono text-slate-500 pt-3 border-t border-slate-100 mt-4">
                    <span>Active Team: {stats.count} members</span>
                    <div className="flex items-center gap-2">
                      {unseated > 0 ? (
                        <span className="text-amber-600 font-bold">{unseated} unallocated</span>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">All Seated</span>
                      )}
                      <button
                        onClick={() => {
                          setManagingTeamProject(proj);
                          setUnassignedSearch('');
                          setSelectedToAssign([]);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 rounded flex items-center gap-1 transition"
                      >
                        <Users className="w-3 h-3" />
                        Manage Team
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Project Creation Form Block (4 cols) */}
      <div className="lg:col-span-4">
        {showAddForm ? (
          <form 
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[400px]"
          >
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h4 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                  <Briefcase className="w-4.5 h-4.5 text-slate-700" />
                  Map Project Zone
                </h4>
                <p className="text-xs text-slate-500 font-sans mt-1">Configure preferred zones to optimize team-clustering seating arrangements.</p>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Code Prefix</label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 text-slate-500 border border-r-0 border-slate-200 px-3 py-2 rounded-l-lg font-mono font-bold">
                      PROJ-
                    </span>
                    <input
                      type="text"
                      id="project-code-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. TITAN, APOLLO"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-r-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    id="project-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Project Apollo Space Program"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Director / Lead</label>
                  <input
                    type="text"
                    id="project-lead-input"
                    value={lead}
                    onChange={(e) => setLead(e.target.value)}
                    placeholder="e.g. David Vance"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designated Cluster Zone</label>
                  <select
                    id="project-target-zone-select"
                    value={targetZone}
                    onChange={(e) => setTargetZone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4].flatMap(floor => 
                      ['A', 'B', 'C', 'D'].map(zone => (
                        <option key={`F${floor}-Z${zone}`} value={`F${floor}-Z${zone}`}>
                          Floor {floor} • Zone {zone} Seating
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-2.5 mt-6">
              <button
                type="button"
                id="btn-cancel-project"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 font-semibold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-submit-project"
                disabled={formLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                {formLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Create Mapping</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-slate-900 rounded-xl p-5 shadow-xs text-white min-h-[400px] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Layers className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/10">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span className="text-amber-100">Smart Mapping</span>
              </div>
              <h4 className="text-lg font-extrabold mb-2 leading-tight">Create designated work zones for project teams.</h4>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Assigning a Target Workspace automatically restricts seat allocations for team members to ensure cross-functional clustering.
              </p>
            </div>

            <div className="relative z-10 bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold">Improved Collaboration</span>
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold">Prevents Zone Fragmentation</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-6 relative">
            <button onClick={() => setEditingProject(null)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              <XIcon className="w-5 h-5" />
            </button>
            <h4 className="font-extrabold text-slate-900 mb-4 text-lg">Edit Project</h4>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Project Name</label>
                <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Project Lead</label>
                <input required type="text" value={editLead} onChange={e => setEditLead(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Zone</label>
                <select value={editTargetZone} onChange={e => setEditTargetZone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2">
                  {[1, 2, 3, 4].flatMap(floor => ['A', 'B', 'C', 'D'].map(zone => (
                    <option key={`F${floor}-Z${zone}`} value={`F${floor}-Z${zone}`}>Floor {floor} • Zone {zone}</option>
                  )))}
                </select>
              </div>
              <button disabled={editLoading} type="submit" className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {managingTeamProject && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 relative flex flex-col max-h-[80vh]">
            <button onClick={() => setManagingTeamProject(null)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              <XIcon className="w-5 h-5" />
            </button>
            <h4 className="font-extrabold text-slate-900 mb-1 text-lg">Assign Team to {managingTeamProject.code}</h4>
            <p className="text-xs text-slate-500 mb-4">Select unassigned employees to add to this project.</p>
            
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search unassigned..." 
                value={unassignedSearch}
                onChange={e => setUnassignedSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-100 rounded-lg bg-slate-50/50 p-2 space-y-1">
              {unassignedList.length === 0 ? (
                <div className="text-xs text-center text-slate-400 py-8">No unassigned employees found.</div>
              ) : (
                unassignedList.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white rounded border border-transparent hover:border-slate-200 transition cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedToAssign.includes(emp.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedToAssign(prev => [...prev, emp.id]);
                        else setSelectedToAssign(prev => prev.filter(id => id !== emp.id));
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-xs text-slate-800">{emp.name}</div>
                      <div className="text-[10px] text-slate-500">{emp.role} • {emp.department}</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <button 
              disabled={assignLoading || selectedToAssign.length === 0}
              onClick={handleAssignSelected}
              className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {assignLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} 
              Assign {selectedToAssign.length > 0 ? selectedToAssign.length : ''} Members
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
