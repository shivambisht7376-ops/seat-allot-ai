/** Pure-SVG seat utilization bar chart per floor/zone. */

import React from 'react';

interface ZoneData {
  key:      string; // e.g. "F1-ZA"
  total:    number;
  occupied: number;
  rate:     number;
}

interface Props {
  data: Record<string, { total: number; occupied: number; rate: number }>;
}

const ZONE_COLORS = ['#4f46e5','#0ea5e9','#10b981','#f59e0b'];

export function SeatUtilizationChart({ data }: Props) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>;
  }

  // Build per-floor groups
  const floors: { floor: number; zones: ZoneData[] }[] = [];
  for (let f = 1; f <= 4; f++) {
    const zones: ZoneData[] = [];
    for (const z of ['A','B','C','D']) {
      const key = `F${f}-Z${z}`;
      const d = data[key];
      if (d) zones.push({ key, ...d });
    }
    if (zones.length) floors.push({ floor: f, zones });
  }

  const BAR_H = 18;
  const GAP   = 6;
  const LEFT  = 56;
  const RIGHT = 40;
  const WIDTH = 340;
  const rowHeight = BAR_H + GAP;
  const totalRows = floors.reduce((s, f) => s + f.zones.length + 1, 0);
  const SVG_H = totalRows * rowHeight + 12;

  let y = 8;
  const rows: React.ReactNode[] = [];

  for (const { floor, zones } of floors) {
    // Floor label
    rows.push(
      <text key={`fl${floor}`} x={0} y={y + BAR_H * 0.75} fontSize={10} fontWeight={700} fill="#64748b">
        F{floor}
      </text>
    );
    y += rowHeight;

    for (const z of zones) {
      const barW = Math.max(2, ((z.rate / 100) * (WIDTH - LEFT - RIGHT)));
      const color = z.rate > 90 ? '#ef4444' : z.rate > 70 ? '#f59e0b' : ZONE_COLORS[z.key.charCodeAt(4) - 65] ?? '#4f46e5';

      rows.push(
        <g key={z.key}>
          {/* Zone label */}
          <text x={10} y={y + BAR_H * 0.72} fontSize={9} fill="#94a3b8" fontWeight={500}>
            Z{z.key.slice(-1)}
          </text>
          {/* Track */}
          <rect x={LEFT} y={y} width={WIDTH - LEFT - RIGHT} height={BAR_H} rx={4} fill="#f1f5f9" />
          {/* Fill */}
          <rect x={LEFT} y={y} width={barW} height={BAR_H} rx={4} fill={color} opacity={0.85} />
          {/* % label */}
          <text x={LEFT + (WIDTH - LEFT - RIGHT) + 6} y={y + BAR_H * 0.72} fontSize={9} fill="#334155" fontWeight={700}>
            {z.rate}%
          </text>
        </g>
      );
      y += rowHeight;
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${SVG_H}`} className="font-sans">
        {rows}
      </svg>
    </div>
  );
}
