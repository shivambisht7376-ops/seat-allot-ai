/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building, Users, UserPlus, AlertCircle, TrendingUp, RefreshCw, 
  Settings, HelpCircle, CheckCircle, Database, ChevronRight, MapPin, Layers, BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import { DbStats, AllocationLog } from '../types.js';
import { MetricCard } from './MetricCard.js';
import { StatusDonutChart }      from './charts/StatusDonutChart.js';
import { ProjectHeadcountChart } from './charts/ProjectHeadcountChart.js';
import { SeatUtilizationChart }  from './charts/SeatUtilizationChart.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface DashboardProps {
  id: string;
  stats: DbStats | null;
  onStatsChanged: () => void;
}

export function Dashboard({ id, stats, onStatsChanged }: DashboardProps) {
  const authHeader = useAuthHeader();
  const [logs, setLogs] = useState<AllocationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [floorUtil, setFloorUtil] = useState<Record<string, { total: number, occupied: number, rate: number }>>({});
  const [floorUtilLoading, setFloorUtilLoading] = useState<boolean>(false);
  const [projectHeadcount, setProjectHeadcount] = useState<any[]>([]);
  const [seedingLoading, setSeedingLoading] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    setLogsLoading(true);
    setFloorUtilLoading(true);
    try {
      const [logsRes, utilRes, hcRes] = await Promise.all([
        fetch('/api/logs?limit=8',          { headers: authHeader as any }),
        fetch('/api/seats/utilization',     { headers: authHeader as any }),
        fetch('/api/projects/headcount',    { headers: authHeader as any }),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (utilRes.ok) setFloorUtil(await utilRes.json());
      if (hcRes.ok)   setProjectHeadcount(await hcRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
      setFloorUtilLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [stats]);

  // Triggers backend regeneration of 5000 employee seed records
  const handleResetSeeds = async () => {
    if (!confirm('⚠️ WARNING: This will completely wipe all current seat allocations and re-generate a fresh set of 5,000 highly realistic employee records and mappings. Do you want to proceed?')) return;
    setSeedingLoading(true);
    try {
      const res = await fetch('/api/db/reset', {
        method: 'POST'
      });
      if (res.ok) {
        alert('Database regenerated successfully with 5,000 corporate records.');
        onStatsChanged();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSeedingLoading(false);
    }
  };

  // Process floor aggregated rates
  const getFloorAggregated = (floorNum: number) => {
    let total = 0;
    let occupied = 0;
    for (const zone of ['A', 'B', 'C', 'D']) {
      const key = `F${floorNum}-Z${zone}`;
      if (floorUtil[key]) {
        total += floorUtil[key].total;
        occupied += floorUtil[key].occupied;
      }
    }
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, rate };
  };

  return (
    <div id={id} className="space-y-6">
      
      {/* Bento Stats Panel */}
      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            id="stat-capacity"
            title="Desk Capacity"
            value={`${stats.occupiedSeats.toLocaleString()} / ${stats.totalSeats.toLocaleString()}`}
            icon={<Building className="w-5 h-5 text-indigo-400" />}
            subtitle="Total physical workstations mapped"
            trend={{ value: `${stats.utilizationRate}% occupancy`, isPositive: stats.utilizationRate < 95 }}
          />
          <MetricCard
            id="stat-roster"
            title="Total Roster"
            value={stats.totalEmployees.toLocaleString()}
            icon={<Users className="w-5 h-5 text-emerald-400" />}
            subtitle="Active employees in database"
            trend={{ value: `+${stats.newJoiners} joiners`, isPositive: true }}
          />
          <MetricCard
            id="stat-joiners"
            title="Pending Allocation"
            value={stats.unassignedJoiners.toLocaleString()}
            icon={<UserPlus className="w-5 h-5 text-amber-400" />}
            subtitle="New joiners awaiting seat mapping"
            trend={{ value: `${Math.round((stats.unassignedJoiners / stats.totalEmployees) * 1000) / 10}% roster`, isPositive: stats.unassignedJoiners > 0 }}
          />
          <MetricCard
            id="stat-vacancies"
            title="Available Vacancies"
            value={stats.vacantSeats.toLocaleString()}
            icon={<AlertCircle className="w-5 h-5 text-purple-400" />}
            subtitle="Available hot-desks / physical slots"
          />
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 glass-panel rounded-xl animate-pulse font-medium">
          Calculating spatial bento analytics...
        </div>
      )}

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Donut */}
        {stats && (
          <div className="glass-panel rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2 relative z-10">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Workforce Status
            </h4>
            <div className="relative z-10">
              <StatusDonutChart stats={stats} />
            </div>
          </div>
        )}

        {/* Project Headcount */}
        <div className="glass-panel rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2 relative z-10">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Headcount by Project
          </h4>
          <div className="relative z-10">
            {projectHeadcount.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-medium">Loading...</div>
            ) : (
              <ProjectHeadcountChart data={projectHeadcount} />
            )}
          </div>
        </div>

        {/* Seat Utilization Row-Based Bar Chart */}
        <div className="glass-panel rounded-xl p-5 shadow-lg relative overflow-hidden group md:col-span-1 lg:col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2 relative z-10">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Seat Utilization by Zone
          </h4>
          <div className="space-y-6 relative z-10">
            {floorUtilLoading ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-medium">Loading map analytics...</div>
            ) : (
              [1, 2, 3, 4].map(floor => {
                const floorAg = getFloorAggregated(floor);
                return (
                  <div key={floor} className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-300">F{floor}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{floorAg.rate}% avg</span>
                    </div>
                    {['A', 'B', 'C', 'D'].map(zone => {
                      const key = `F${floor}-Z${zone}`;
                      const zData = floorUtil[key];
                      if (!zData) return null;
                      
                      // Using a consistent dark color palette for zones
                      const bgMap: Record<string, string> = {
                        'A': 'bg-indigo-500',
                        'B': 'bg-sky-500',
                        'C': 'bg-emerald-500',
                        'D': 'bg-amber-500'
                      };
                      const bgColor = bgMap[zone];

                      return (
                        <div key={key} className="flex items-center gap-3 text-xs">
                          <span className="w-5 text-right text-[10px] text-slate-500 font-mono">Z{zone}</span>
                          <div className="flex-1 h-3.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${zData.rate}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className={`h-full ${bgColor} rounded-full`}
                            />
                          </div>
                          <span className="w-8 text-[10px] text-slate-300 font-mono text-right">{zData.rate}%</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Content: Floor Levels and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Floor plans occupancy tracker (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 font-sans">Workspace Density map</h4>
              <p className="text-xs text-slate-500 font-sans mt-0.5">Real-time occupancy rates of corporate zones across all floor levels</p>
            </div>
            <Layers className="w-5 h-5 text-slate-400" />
          </div>

          {floorUtilLoading ? (
            <div className="flex justify-center items-center py-20 gap-2 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Scanning spatial allocations...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(floorNum => {
                const floorAgg = getFloorAggregated(floorNum);
                
                return (
                  <div key={floorNum} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-100/50 transition duration-150">
                    <div className="space-y-0.5 min-w-[120px]">
                      <h5 className="font-bold text-slate-900 text-sm">Floor Level {floorNum}</h5>
                      <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase font-sans">Corporate Suites</span>
                    </div>

                    {/* Zone detail grids inside a floor bar */}
                    <div className="flex-1 grid grid-cols-4 gap-2.5 max-w-sm">
                      {['A', 'B', 'C', 'D'].map(zone => {
                        const key = `F${floorNum}-Z${zone}`;
                        const zoneData = floorUtil[key] || { rate: 0, occupied: 0, total: 0 };
                        
                        return (
                          <div 
                            key={zone} 
                            className="bg-white border border-slate-200 p-2 rounded-lg text-center font-sans shadow-2xs relative overflow-hidden"
                            title={`${key}: ${zoneData.occupied}/${zoneData.total} seated`}
                          >
                            <span className="block font-bold text-slate-500 text-[10px] leading-tight">Zone {zone}</span>
                            <span className="block font-semibold text-slate-900 text-xs mt-1 font-mono">{zoneData.rate}%</span>
                            
                            {/* Visual background indicator */}
                            <div 
                              className="absolute bottom-0 left-0 right-0 h-1 rounded-full transition-all"
                              style={{ 
                                width: `${zoneData.rate}%`, 
                                backgroundColor: zoneData.rate > 90 ? '#ef4444' : zoneData.rate > 70 ? '#f59e0b' : '#3b82f6' 
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-right min-w-[80px]">
                      <span className="block font-extrabold text-slate-900 text-sm font-sans">{floorAgg.rate}%</span>
                      <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{floorAgg.occupied}/{floorAgg.total} desks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-time Logs & Admin (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Audit Logs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 font-sans mb-3.5 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-700" />
                Live Allocation Audit Log
              </h4>

              {logsLoading ? (
                <div className="flex justify-center items-center py-12 gap-2 text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Reading corporate audit logs...</span>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-xs leading-relaxed border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 font-sans">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          log.action === 'allocate' 
                            ? 'bg-blue-100 text-blue-700' 
                            : log.action === 'release' 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 font-medium">
                          {log.details}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                          <span>{log.employeeName}</span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No allocation events logged yet.
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 text-center font-sans border-t border-slate-150 pt-3 mt-4">
              Comprehensive event logging satisfies SOC-2 enterprise safety audits.
            </div>
          </div>

          {/* Admin Operations Box */}
          <div className="bg-slate-950 text-white rounded-xl p-5 shadow-lg border border-slate-800">
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-400" />
              Administrative Operations
            </h5>
            <p className="text-xs text-slate-300 leading-relaxed">
              Reset database indices and allocate custom mock suites of **5,000 corporate records** instantly. Ideal for evaluating layout mapping and analytics performance.
            </p>
            
            <button
              id="btn-trigger-db-reset"
              onClick={handleResetSeeds}
              disabled={seedingLoading}
              className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              {seedingLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>Regenerate & Seed 5,000 Records</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
