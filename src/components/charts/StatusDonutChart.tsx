/** Pure-SVG donut chart for employee status breakdown. */

import React from 'react';
import { DbStats } from '../../types.js';

interface Props {
  stats: DbStats;
}

const SEGMENTS = [
  { key: 'activeEmployees', label: 'Active',     color: '#10b981' },
  { key: 'newJoiners',      label: 'New Joiner', color: '#f59e0b' },
] as const;

export function StatusDonutChart({ stats }: Props) {
  const resigned = stats.totalEmployees - stats.activeEmployees - stats.newJoiners;
  const segments = [
    { label: 'Active',     value: stats.activeEmployees, color: '#10b981' },
    { label: 'New Joiner', value: stats.newJoiners,      color: '#f59e0b' },
    { label: 'Resigned',   value: Math.max(resigned, 0), color: '#94a3b8' },
  ].filter(s => s.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>;
  }

  // Build SVG arc paths
  const CX = 80, CY = 80, R = 60, IR = 38;
  const toXY = (angle: number, r: number) => ({
    x: CX + r * Math.cos((angle - 90) * (Math.PI / 180)),
    y: CY + r * Math.sin((angle - 90) * (Math.PI / 180)),
  });

  const arcs: React.ReactNode[] = [];
  let startAngle = 0;

  for (const seg of segments) {
    const sweep = (seg.value / total) * 360;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > 180 ? 1 : 0;
    const s1 = toXY(startAngle, R);
    const s2 = toXY(endAngle,   R);
    const i1 = toXY(startAngle, IR);
    const i2 = toXY(endAngle,   IR);

    const d = [
      `M ${s1.x} ${s1.y}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${s2.x} ${s2.y}`,
      `L ${i2.x} ${i2.y}`,
      `A ${IR} ${IR} 0 ${largeArc} 0 ${i1.x} ${i1.y}`,
      'Z',
    ].join(' ');

    arcs.push(<path key={seg.label} d={d} fill={seg.color} opacity={0.85} />);
    startAngle = endAngle;
  }

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160">
        {arcs}
        {/* Centre label */}
        <text x={CX} y={CY - 4}  textAnchor="middle" fontSize={18} fontWeight={800} fill="#0f172a">{total.toLocaleString()}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={9}  fontWeight={500} fill="#94a3b8">employees</text>
      </svg>

      {/* Legend */}
      <div className="space-y-2.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <div>
              <p className="text-xs font-semibold text-slate-700">{seg.label}</p>
              <p className="text-[10px] text-slate-400 font-mono">
                {seg.value.toLocaleString()} &nbsp;({Math.round((seg.value / total) * 100)}%)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
