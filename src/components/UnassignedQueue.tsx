/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserCheck, AlertTriangle, Play, Sparkles, X, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Employee } from '../types.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface UnassignedQueueProps {
  id: string;
  onStatsChanged: () => void;
}

export function UnassignedQueue({ id, onStatsChanged }: UnassignedQueueProps) {
  const authHeader = useAuthHeader();
  const [unassigned, setUnassigned] = useState<Employee[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [runningAuto, setRunningAuto] = useState<boolean>(false);
  const [resultsLog, setResultsLog] = useState<string[] | null>(null);

  const fetchUnassigned = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees?limit=500&isUnassigned=true&status=New%20Joiner', { headers: authHeader as any });
      if (res.ok) {
        const data = await res.json();
        setUnassigned(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnassigned();
  }, []);

  const handleAutoAllocate = async () => {
    if (!confirm('Are you sure you want to run the intelligent auto-allocation engine? This will assign vacant desks near designated project zones.')) return;
    setRunningAuto(true);
    try {
      const res = await fetch('/api/seats/auto-allocate', {
        method: 'POST',
        headers: { ...(authHeader as any) },
      });
      if (res.ok) {
        const data = await res.json();
        setResultsLog(data.details);
        fetchUnassigned();
        onStatsChanged();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningAuto(false);
    }
  };

  return (
    <div id={id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-base font-bold text-indigo-900 font-sans flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              New Joiner Queue
            </h4>
            <p className="text-xs text-indigo-500 font-sans mt-0.5">
              {total} unallocated new joiners pending a desk mapping
            </p>
          </div>

          <button
            id="btn-auto-allocate-queue"
            onClick={handleAutoAllocate}
            disabled={total === 0 || runningAuto}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-indigo-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            {runningAuto ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Auto-Allocate</span>
          </button>
        </div>

        {resultsLog && (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3 relative text-xs">
            <button
              onClick={() => setResultsLog(null)}
              className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
            <h5 className="font-bold text-indigo-800 flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Allocation Engine Results:
            </h5>
            <div className="space-y-1 max-h-[140px] overflow-y-auto divide-y divide-slate-100 font-sans text-indigo-600">
              {resultsLog.length > 0 ? (
                resultsLog.map((log, i) => (
                  <div key={i} className="py-1 text-[11px] leading-relaxed">
                    {log}
                  </div>
                ))
              ) : (
                <div className="py-1 text-indigo-400 italic">
                  All systems cleared. No allocations processed.
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-300" />
            <span className="text-xs text-indigo-400 font-sans">Loading incoming queue...</span>
          </div>
        ) : unassigned.length > 0 ? (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {unassigned.map(emp => (
              <div
                key={emp.id}
                id={`queue-item-${emp.id}`}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition duration-150"
              >
                <div className="pr-2 truncate">
                  <div className="font-bold text-indigo-900 leading-tight truncate">{emp.name}</div>
                  <div className="text-[10px] text-indigo-400 font-mono mt-0.5">{emp.id} • {emp.role}</div>
                  <div className="text-[10px] text-indigo-400 font-sans mt-0.5">Joined: {emp.joinDate}</div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase block mb-1">
                    Joiner
                  </span>
                  <span className="text-[10px] bg-slate-200/60 text-indigo-600 border border-slate-300/40 px-1.5 py-0.5 rounded font-bold">
                    {emp.projectCode || 'No Project'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center text-center">
            <UserCheck className="w-8 h-8 text-indigo-400 mb-2" />
            <h5 className="font-bold text-indigo-700 text-xs">Queue Cleared</h5>
            <p className="text-[11px] text-indigo-400 font-sans mt-1">
              All incoming new joiners have been assigned workspaces successfully.
            </p>
          </div>
        )}
      </div>

      <div className="text-[10px] text-indigo-400 text-center font-sans mt-4 pt-2 border-t border-slate-100">
        Engine prioritizes vacant seats mapped to preferred project zones.
      </div>
    </div>
  );
}
