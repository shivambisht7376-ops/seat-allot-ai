/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Briefcase, RefreshCw, Layers, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
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
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                        {proj.code}
                      </span>
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
                    {unseated > 0 ? (
                      <span className="text-amber-600 font-bold">{unseated} unallocated</span>
                    ) : (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">All Seated</span>
                    )}
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
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="p-3 bg-white border rounded-xl text-slate-400 shadow-xs mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-xs">Dynamic Team Zoning</h4>
            <p className="text-[11px] text-slate-400 font-sans max-w-[180px] mt-2">
              Add new project groups to enable cluster assignments. The system auto-aligns seating maps to minimize team isolation.
            </p>
            <button
              id="btn-map-project-placeholder"
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 transition shadow-2xs"
            >
              Start New Mapping
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
