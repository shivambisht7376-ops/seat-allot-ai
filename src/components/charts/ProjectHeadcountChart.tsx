/** Pure-SVG horizontal bar chart: employee headcount per project. */

import React from 'react';

interface ProjectCount {
  code:  string;
  name:  string;
  color: string;
  count: number;
}

interface Props {
  data: ProjectCount[];
}

export function ProjectHeadcountChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No projects yet</div>;
  }

  const sorted  = [...data].sort((a, b) => b.count - a.count).slice(0, 12);
  const maxVal  = Math.max(...sorted.map(d => d.count), 1);
  const BAR_H   = 20;
  const GAP     = 6;
  const LEFT    = 100;
  const RIGHT   = 44;
  const WIDTH   = 360;
  const SVG_H   = sorted.length * (BAR_H + GAP) + 8;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${SVG_H}`} className="font-sans">
        {sorted.map((p, i) => {
          const y   = i * (BAR_H + GAP) + 4;
          const barW = Math.max(4, ((p.count / maxVal) * (WIDTH - LEFT - RIGHT)));
          const shortName = p.name.length > 13 ? p.name.slice(0, 12) + '…' : p.name;

          return (
            <g key={p.code}>
              {/* Project name */}
              <text x={0} y={y + BAR_H * 0.72} fontSize={9.5} fill="#94a3b8" fontWeight={500} textAnchor="start">
                {shortName}
              </text>
              {/* Track */}
              <rect x={LEFT} y={y} width={WIDTH - LEFT - RIGHT} height={BAR_H} rx={5} fill="rgba(255,255,255,0.05)" />
              {/* Bar */}
              <rect x={LEFT} y={y} width={barW} height={BAR_H} rx={5} fill={p.color} opacity={0.8} />
              {/* Count */}
              <text x={LEFT + (WIDTH - LEFT - RIGHT) + 6} y={y + BAR_H * 0.72} fontSize={9.5} fill="#e2e8f0" fontWeight={700}>
                {p.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
