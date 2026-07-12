/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface MetricCardProps {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  colorClass?: string;
}

export function MetricCard({ id, title, value, icon, subtitle, trend, colorClass = 'border-slate-200 text-slate-800' }: MetricCardProps) {
  return (
    <motion.div
      id={id}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`glass-card glow-border rounded-xl p-6 flex flex-col justify-between h-36 ${colorClass}`}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
          {title}
        </span>
        <div className="p-2.5 bg-white/5 rounded-lg text-indigo-300 border border-white/10 shadow-inner">
          {icon}
        </div>
      </div>
      
      <div className="mt-2 relative z-10">
        <h3 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
          {value}
        </h3>
        
        <div className="flex items-center justify-between mt-1 text-xs">
          <span className="text-slate-400 truncate pr-2 font-medium">
            {subtitle}
          </span>
          {trend && (
            <span className={`font-bold font-mono whitespace-nowrap px-1.5 py-0.5 rounded ${trend.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
