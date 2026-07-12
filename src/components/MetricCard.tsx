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
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`bg-white rounded-xl p-5 border shadow-xs flex flex-col justify-between h-36 ${colorClass}`}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 font-sans">
          {title}
        </span>
        <div className="p-2 bg-slate-50 rounded-lg text-slate-600 border border-slate-100">
          {icon}
        </div>
      </div>
      
      <div className="mt-2">
        <h3 className="text-2xl font-bold font-sans tracking-tight text-slate-900">
          {value}
        </h3>
        
        <div className="flex items-center justify-between mt-1 text-xs">
          <span className="text-slate-500 font-sans truncate pr-2">
            {subtitle}
          </span>
          {trend && (
            <span className={`font-semibold font-mono whitespace-nowrap ${trend.isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
