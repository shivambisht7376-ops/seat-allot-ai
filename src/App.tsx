/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, Briefcase, UserPlus, Bot, LayoutDashboard, 
  MapPin, RefreshCw, Layers, Database, HelpCircle, CheckCircle, User 
} from 'lucide-react';

import { DbStats, Project } from './types.js';
import { Dashboard } from './components/Dashboard.js';
import { SeatingMap } from './components/SeatingMap.js';
import { EmployeeDirectory } from './components/EmployeeDirectory.js';
import { ProjectManager } from './components/ProjectManager.js';
import { UnassignedQueue } from './components/UnassignedQueue.js';
import { AiAssistantPanel } from './components/AiAssistantPanel.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<DbStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // User session meta (from ADDITIONAL_METADATA)
  const userEmail = "shivambisht7376@gmail.com";

  const fetchGlobalState = async () => {
    try {
      // 1. Fetch capacity statistics
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch active projects list
      const projectsRes = await fetch('/api/projects');
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      }
    } catch (err) {
      console.error('Failed to connect to full-stack backend APIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalState();
  }, []);

  const handleStateChanged = () => {
    fetchGlobalState();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 selection:bg-blue-500/10 selection:text-blue-700">
      
      {/* Premium Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-sm border border-slate-800">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block font-sans">
                Corporate Seating Layouts
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider block">
                Workspace & Projects Router
              </span>
            </div>
          </div>

          {/* Quick Real-time Sync Button */}
          <div className="flex items-center gap-4">
            <button
              id="btn-sync-global-state"
              onClick={fetchGlobalState}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition duration-150 flex items-center gap-1 cursor-pointer"
              title="Sync overall seating database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Active User session pill */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
              <div className="w-5 h-5 bg-slate-900 text-white font-bold rounded-md flex items-center justify-center text-[10px]">
                SB
              </div>
              <span className="text-xs font-semibold text-slate-600 font-mono">
                {userEmail}
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* Roster & Analytics Main View Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        
        {/* Navigation Tabs bar with notifications counter */}
        <div className="border-b border-slate-200 flex flex-wrap gap-2 text-sm font-semibold text-slate-500 pb-px">
          <button
            id="tab-btn-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview Dashboard</span>
          </button>

          <button
            id="tab-btn-seating"
            onClick={() => setActiveTab('seating')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition cursor-pointer ${
              activeTab === 'seating'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Interactive Floor Maps</span>
          </button>

          <button
            id="tab-btn-roster"
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition cursor-pointer ${
              activeTab === 'roster'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Directory</span>
          </button>

          <button
            id="tab-btn-projects"
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition cursor-pointer ${
              activeTab === 'projects'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Project Zoning</span>
          </button>

          <button
            id="tab-btn-queue"
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition relative cursor-pointer ${
              activeTab === 'queue'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>New Joiner Queue</span>
            {stats && stats.unassignedJoiners > 0 && (
              <span className="absolute top-2.5 -right-1 bg-amber-500 text-white font-mono font-bold text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-slate-50">
                {stats.unassignedJoiners}
              </span>
            )}
          </button>

          <button
            id="tab-btn-assistant"
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-sans transition cursor-pointer ${
              activeTab === 'assistant'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <Bot className="w-4 h-4 text-blue-500" />
            <span className="text-slate-900 font-bold">AI Assistant</span>
          </button>
        </div>

        {/* Reactive tab stages */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400"
              >
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="font-semibold text-sm font-sans">Connecting to enterprise workspace services...</span>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'dashboard' && (
                  <Dashboard id="stage-dashboard" stats={stats} onStatsChanged={handleStateChanged} />
                )}
                
                {activeTab === 'seating' && (
                  <SeatingMap id="stage-seating" projects={projects} onStatsChanged={handleStateChanged} />
                )}

                {activeTab === 'roster' && (
                  <EmployeeDirectory id="stage-roster" projects={projects} onStatsChanged={handleStateChanged} />
                )}

                {activeTab === 'projects' && (
                  <ProjectManager id="stage-projects" projects={projects} onProjectCreated={handleStateChanged} onStatsChanged={handleStateChanged} />
                )}

                {activeTab === 'queue' && (
                  <UnassignedQueue id="stage-queue" onStatsChanged={handleStateChanged} />
                )}

                {activeTab === 'assistant' && (
                  <AiAssistantPanel id="stage-assistant" onStatsChanged={handleStateChanged} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Footer information panel */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-6 text-center font-sans text-[11px] text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>Enterprise Seating Layout Router • Mapped for 5,000 Workspace Employees</span>
          <div className="flex gap-4 font-mono font-bold text-slate-400 uppercase">
            <span>SOC-2 Compliant</span>
            <span>•</span>
            <span>Vite SPA Host</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
