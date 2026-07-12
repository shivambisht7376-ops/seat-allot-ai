/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Root component — wraps app in AuthProvider and routes to role-appropriate dashboard.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginPage }         from './components/LoginPage.js';
import { AdminDashboard }    from './components/AdminDashboard.js';
import { HRDashboard }       from './components/HRDashboard.js';
import { EmployeeDashboard } from './components/EmployeeDashboard.js';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-300" />
          <span className="text-sm font-semibold text-white/70">Restoring session…</span>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Route to role-appropriate dashboard
  if (user.role === 'ADMIN')    return <AdminDashboard />;
  if (user.role === 'MANAGER')  return <HRDashboard />;
  return <EmployeeDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key="app-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <AppRouter />
        </motion.div>
      </AnimatePresence>
    </AuthProvider>
  );
}
