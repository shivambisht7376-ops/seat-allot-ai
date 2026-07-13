/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserCheck, Sparkles, RefreshCw } from 'lucide-react';
import { Employee } from '../types.js';
import { useAuthHeader } from '../context/AuthContext.js';

interface UnassignedQueueProps {
  id: string;
  onStatsChanged: () => void;
}

export function UnassignedQueue({ id }: UnassignedQueueProps) {
  const authHeader = useAuthHeader();
  const [joiners, setJoiners] = useState<Employee[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchJoiners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees?limit=500&status=New%20Joiner', { headers: authHeader as any });
      if (res.ok) {
        const data = await res.json();
        setJoiners(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiners();
  }, []);

  return (
    <div id={id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col h-full min-h-[500px]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-lg font-bold text-indigo-900 font-sans flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            All New Joiners
          </h4>
          <p className="text-sm text-indigo-500 font-sans mt-0.5">
            {total} recently onboarded employees across the organization
          </p>
        </div>
        <button
          onClick={fetchJoiners}
          className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 flex-1">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-300" />
          <span className="text-sm text-indigo-400 font-sans">Loading joiners...</span>
        </div>
      ) : joiners.length > 0 ? (
        <div className="space-y-3 overflow-y-auto pr-2 flex-1">
          {joiners.map(emp => (
            <div
              key={emp.id}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition duration-150 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg border border-indigo-200">
                  {emp.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2)}
                </div>
                <div>
                  <div className="font-bold text-indigo-900 text-sm leading-tight">{emp.name}</div>
                  <div className="text-xs text-indigo-500 mt-1 font-mono">{emp.id} <span className="font-sans text-slate-400 mx-1">•</span> <span className="font-sans">{emp.role}</span></div>
                  <div className="text-[11px] text-indigo-400 font-sans mt-1">Joined: <span className="font-medium">{emp.joinDate}</span></div>
                </div>
              </div>

              <div className="text-right">
                <span className={`px-3 py-1.5 border rounded-md text-xs font-bold block mb-2 shadow-xs ${emp.seatId ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {emp.seatId ? `Seat: ${emp.seatId}` : 'Unassigned Desk'}
                </span>
                <span className="text-[11px] bg-white text-indigo-600 border border-slate-200 px-2.5 py-1 rounded-md font-bold shadow-xs inline-block">
                  {emp.projectCode || 'No Project'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center text-center flex-1 justify-center">
          <UserCheck className="w-12 h-12 text-indigo-300 mb-3" />
          <h5 className="font-bold text-indigo-700 text-base">No New Joiners</h5>
          <p className="text-sm text-indigo-400 font-sans mt-1">
            There are currently no employees with the New Joiner status.
          </p>
        </div>
      )}
    </div>
  );
}
