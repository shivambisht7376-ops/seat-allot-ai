/**
 * EmployeeDashboard — read-only personal portal for regular employees.
 * Shows: own seat, project card, floor map (view-only), AI assistant.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Bot, Building2, RefreshCw, LogOut, User,
  Briefcase, CheckCircle, AlertCircle, Calendar,
} from 'lucide-react';
import { useAuth, useAuthHeader } from '../context/AuthContext.js';
import { Employee, Project } from '../types.js';
import { SeatingMap }       from './SeatingMap.js';
import { AiAssistantPanel } from './AiAssistantPanel.js';

const TABS = [
  { id: 'home',      label: 'My Workspace', icon: User },
  { id: 'map',       label: 'Floor Map',    icon: MapPin },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
];

export function EmployeeDashboard() {
  const { user, logout }        = useAuth();
  const authHeader              = useAuthHeader();
  const [tab, setTab]           = useState('home');
  const [profile, setProfile]   = useState<Employee | null>(null);
  const [project, setProject]   = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const [empRes, projRes] = await Promise.all([
        fetch(`/api/employees/${user.employeeCode}`, { headers: authHeader as any }),
        fetch('/api/projects', { headers: authHeader as any }),
      ]);
      if (empRes.ok) {
        const emp: Employee = await empRes.json();
        setProfile(emp);
        if (projRes.ok) {
          const all: Project[] = await projRes.json();
          setProjects(all);
          setProject(all.find(p => p.code === emp.projectCode) ?? null);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">

      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 block">Seat Allot AI</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Employee Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">{user?.name}</span>
            </div>
            <button onClick={logout} className="p-1.5 border border-slate-200 hover:bg-red-50 hover:border-red-200 rounded-lg text-slate-400 hover:text-red-500 transition cursor-pointer" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Tab Bar */}
        <div className="border-b border-slate-200 flex gap-1 text-sm font-semibold text-slate-500 pb-px">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                id={`emp-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition cursor-pointer rounded-t-lg ${
                  tab === t.id
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

              {tab === 'home' && (
                loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                    <span className="text-sm font-semibold">Loading your workspace…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Profile card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-md">
                          {user?.name?.charAt(0) ?? 'E'}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">{profile?.name ?? user?.name}</h2>
                          <p className="text-xs text-slate-500 font-medium">{profile?.role}</p>
                          <p className="text-xs text-slate-400 font-mono">{profile?.id}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {[
                          { label: 'Department', value: profile?.department, icon: Briefcase },
                          { label: 'Status',     value: profile?.status,     icon: CheckCircle },
                          { label: 'Join Date',  value: profile?.joinDate,   icon: Calendar },
                        ].map(row => {
                          const Icon = row.icon;
                          return (
                            <div key={row.label} className="flex items-center gap-2.5 text-sm">
                              <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-500 font-medium w-24">{row.label}</span>
                              <span className="text-slate-800 font-semibold">{row.value ?? '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Seat card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-emerald-500" />
                        Your Desk
                      </h3>
                      {profile?.seatId ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                          <p className="text-2xl font-extrabold text-emerald-700 font-mono">{profile.seatId}</p>
                          <p className="text-xs text-emerald-600 font-medium mt-1">Assigned Workstation</p>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center flex items-center gap-2 justify-center">
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                          <p className="text-sm font-semibold text-amber-700">No seat assigned yet</p>
                        </div>
                      )}

                      {project && (
                        <div className="mt-4">
                          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            Project Assignment
                          </h3>
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color }} />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{project.name}</p>
                              <p className="text-xs text-slate-500">Lead: {project.lead}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )
              )}

              {tab === 'map' && (
                <SeatingMap id="emp-seating" projects={projects} onStatsChanged={() => {}} readOnly />
              )}

              {tab === 'assistant' && (
                <AiAssistantPanel id="emp-assistant" onStatsChanged={() => {}} />
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
