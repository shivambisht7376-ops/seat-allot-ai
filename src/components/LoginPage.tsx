/**
 * LoginPage — premium glassmorphism login screen with demo credentials panel.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Eye, EyeOff, LogIn, Sparkles, Shield, Users, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

const DEMO_ACCOUNTS = [
  {
    role:     'Admin',
    email:    'admin@enterprise.com',
    password: 'Admin@1234',
    icon:     Shield,
    color:    'from-violet-500 to-purple-600',
    bg:       'bg-violet-50 border-violet-200',
    badge:    'bg-violet-100 text-violet-700',
    desc:     'Full system access',
  },
  {
    role:     'HR Manager',
    email:    'hr@enterprise.com',
    password: 'Hr@1234',
    icon:     Users,
    color:    'from-sky-500 to-blue-600',
    bg:       'bg-sky-50 border-sky-200',
    badge:    'bg-sky-100 text-sky-700',
    desc:     'Employee & seat management',
  },
  {
    role:     'Employee',
    email:    'emp@enterprise.com',
    password: 'Emp@1234',
    icon:     User,
    color:    'from-emerald-500 to-teal-600',
    bg:       'bg-emerald-50 border-emerald-200',
    badge:    'bg-emerald-100 text-emerald-700',
    desc:     'View-only personal portal',
  },
];

export function LoginPage() {
  const { login }                         = useAuth();
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [error, setError]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.success) setError(result.error ?? 'Login failed.');
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative z-0">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">

        {/* Left – Branding */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col justify-center text-white"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
              <Building2 className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Seat Allot AI</h1>
              <p className="text-xs text-white/50 font-medium">Enterprise Workspace Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Intelligent<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
              Workspace Management
            </span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-xs">
            AI-powered seat allocation, real-time floor maps, and employee management for 3,000+ people.
          </p>

          <div className="flex items-center gap-2 text-xs text-white/40 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Powered by Gemini AI · Neon PostgreSQL · React</span>
          </div>
        </motion.div>

        {/* Right – Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h3>
            <p className="text-sm text-slate-500 mb-6">Sign in to your workspace</p>

            {/* Demo Account Chips */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Quick demo login
              </p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.role}
                      onClick={() => fillDemo(acc)}
                      type="button"
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border ${acc.bg} hover:opacity-90 transition-all text-left group`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${acc.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{acc.role}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${acc.badge}`}>
                            {acc.desc}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block truncate">{acc.email}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold group-hover:text-slate-600 transition">
                        Fill ↗
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-medium">or enter manually</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@enterprise.com"
                  required
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={submitting || !email || !password}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign in to Workspace
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
