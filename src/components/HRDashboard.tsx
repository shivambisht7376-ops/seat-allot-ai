/**
 * HRDashboard — HR Manager view: employees + allocation, no destructive operations.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, UserPlus, Bot,
  Building2, RefreshCw, LogOut, Briefcase,
} from 'lucide-react';
import { DbStats, Project } from '../types.js';
import { useAuth, useAuthHeader } from '../context/AuthContext.js';
import { Dashboard }         from './Dashboard.js';
import { EmployeeDirectory } from './EmployeeDirectory.js';
import { UnassignedQueue }   from './UnassignedQueue.js';
import { AiAssistantPanel }  from './AiAssistantPanel.js';
import { ProjectManager }    from './ProjectManager.js';

const TABS = [
  { id: 'dashboard', label: 'Overview',     icon: LayoutDashboard },
  { id: 'roster',    label: 'Employees',    icon: Users },
  { id: 'queue',     label: 'Seat Queue',   icon: UserPlus },
  { id: 'projects',  label: 'Projects',     icon: Briefcase },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
];

export function HRDashboard() {
  const { user, logout }  = useAuth();
  const authHeader        = useAuthHeader();
  const [tab, setTab]     = useState('dashboard');
  const [stats, setStats] = useState<DbStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchGlobal = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/stats',    { headers: authHeader as any }),
        fetch('/api/projects', { headers: authHeader as any }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (pRes.ok) setProjects(await pRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGlobal(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">

      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 block">Seat Allot AI</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">HR Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchGlobal} className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-500' : ''}`} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg">
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-xs font-bold text-sky-700">{user?.name}</span>
              <span className="text-[9px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full font-bold">HR</span>
            </div>
            <button onClick={logout} className="p-1.5 border border-slate-200 hover:bg-red-50 hover:border-red-200 rounded-lg text-slate-400 hover:text-red-500 transition cursor-pointer" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Tab Bar */}
        <div className="border-b border-slate-200 flex flex-wrap gap-1 text-sm font-semibold text-slate-500 pb-px">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                id={`hr-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition cursor-pointer rounded-t-lg ${
                  tab === t.id
                    ? 'border-sky-500 text-sky-700 bg-sky-50/50'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.id === 'queue' && stats && stats.unassignedJoiners > 0 && (
                  <span className="ml-1 bg-amber-500 text-white font-mono font-bold text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                    {stats.unassignedJoiners > 9 ? '9+' : stats.unassignedJoiners}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
                <span className="text-sm font-semibold">Loading HR portal…</span>
              </motion.div>
            ) : (
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {tab === 'dashboard' && <Dashboard id="hr-dashboard" stats={stats} onStatsChanged={fetchGlobal} />}
                {tab === 'roster'    && <EmployeeDirectory id="hr-roster" projects={projects} onStatsChanged={fetchGlobal} userRole="MANAGER" />}
                {tab === 'queue'     && <UnassignedQueue id="hr-queue" onStatsChanged={fetchGlobal} />}
                {tab === 'projects'  && <ProjectManager id="hr-projects" projects={projects} onProjectCreated={fetchGlobal} onStatsChanged={fetchGlobal} />}
                {tab === 'assistant' && <AiAssistantPanel id="hr-assistant" onStatsChanged={fetchGlobal} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
