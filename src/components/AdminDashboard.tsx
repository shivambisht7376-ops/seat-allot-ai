/**
 * AdminDashboard — full access: all tabs including destructive actions.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, MapPin, Users, Briefcase, UserPlus, Bot,
  Building2, RefreshCw, LogOut, Shield,
} from 'lucide-react';
import { DbStats, Project } from '../types.js';
import { useAuth, useAuthHeader } from '../context/AuthContext.js';
import { Dashboard }         from './Dashboard.js';
import { SeatingMap }        from './SeatingMap.js';
import { EmployeeDirectory } from './EmployeeDirectory.js';
import { ProjectManager }    from './ProjectManager.js';
import { UnassignedQueue }   from './UnassignedQueue.js';
import { AiAssistantPanel }  from './AiAssistantPanel.js';

const TABS = [
  { id: 'dashboard', label: 'Overview',      icon: LayoutDashboard },
  { id: 'seating',   label: 'Floor Maps',    icon: MapPin },
  { id: 'roster',    label: 'Employees',     icon: Users },
  { id: 'projects',  label: 'Projects',      icon: Briefcase },
  { id: 'queue',     label: 'New Joiners',   icon: UserPlus },
  { id: 'assistant', label: 'AI Assistant',  icon: Bot },
];

export function AdminDashboard() {
  const { user, logout }   = useAuth();
  const authHeader         = useAuthHeader();
  const [tab, setTab]      = useState('dashboard');
  const [stats, setStats]  = useState<DbStats | null>(null);
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
    <div className="min-h-screen gradient-bg flex flex-col font-sans antialiased text-slate-100">

      {/* Topbar */}
      <header className="glass-panel sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block tracking-wide">Seat Allot AI</span>
              <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest block">Admin Console</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchGlobal} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-smooth cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-indigo-200">{user?.name}</span>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">ADMIN</span>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-smooth cursor-pointer" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-2 text-sm font-semibold p-1 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                id={`admin-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 transition-smooth cursor-pointer rounded-lg relative overflow-hidden ${
                  tab === t.id
                    ? 'text-white bg-white/10 shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/10 rounded-lg"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </span>
                {t.id === 'queue' && stats && stats.unassignedJoiners > 0 && (
                  <span className="relative z-10 ml-1 bg-rose-500 text-white font-mono font-bold text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-lg shadow-rose-500/30">
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
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-sm font-semibold">Loading workspace…</span>
              </motion.div>
            ) : (
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {tab === 'dashboard' && <Dashboard id="admin-dashboard" stats={stats} onStatsChanged={fetchGlobal} />}
                {tab === 'seating'   && <SeatingMap id="admin-seating" projects={projects} onStatsChanged={fetchGlobal} />}
                {tab === 'roster'    && <EmployeeDirectory id="admin-roster" projects={projects} onStatsChanged={fetchGlobal} userRole="ADMIN" />}
                {tab === 'projects'  && <ProjectManager id="admin-projects" projects={projects} onProjectCreated={fetchGlobal} onStatsChanged={fetchGlobal} />}
                {tab === 'queue'     && <UnassignedQueue id="admin-queue" onStatsChanged={fetchGlobal} />}
                {tab === 'assistant' && <AiAssistantPanel id="admin-assistant" onStatsChanged={fetchGlobal} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
