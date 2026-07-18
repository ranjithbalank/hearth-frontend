import { useRef, useState } from "react";

import { money } from "../lib/money";

/** Minimal SVG line chart for one or two daily series — 2px round-cap lines,
 *  ringed end markers, recessive gridlines, a legend, and a hover crosshair
 *  tooltip carrying the exact values. No chart library needed. */

export interface LineSeries { name: string; color: string; values: number[] }

/** Round a max up to a clean axis ceiling (1/2/2.5/5 × 10^k). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}

const compact = (v: number) =>
  v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));

export function LineChart({ days, series }: { days: string[]; series: LineSeries[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, padL = 46, padR = 16, padT = 12, padB = 26;
  const n = days.length;
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => padL + (n < 2 ? 0 : ((W - padL - padR) * i) / (n - 1));
  const y = (v: number) => H - padB - ((H - padT - padB) * v) / top;
  const skip = Math.max(1, Math.ceil(n / 8)); // x labels that never collide

  function onMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n < 1) return;
    const px = ((e.clientX - rect.left) * W) / rect.width;
    const step = n < 2 ? 1 : (W - padL - padR) / (n - 1);
    setHover(Math.min(n - 1, Math.max(0, Math.round((px - padL) / step))));
  }

  return (
    <div className="relative">
      <div className="flex gap-4 mb-2">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* gridlines + clean y ticks */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} y1={y(top * f)} x2={W - padR} y2={y(top * f)}
              stroke="#E2E8F0" strokeWidth="1" />
            <text x={padL - 6} y={y(top * f) + 3.5} textAnchor="end" fontSize="9.5" fill="#64748B">
              {compact(top * f)}
            </text>
          </g>
        ))}
        {/* x labels: every nth day + the last one, dropping the nth tick that
            would crowd the forced end label */}
        {days.map((d, i) => ((i % skip === 0 && n - 1 - i >= skip / 2) || i === n - 1) && (
          <text key={i} x={x(i)} y={H - padB + 14} textAnchor="middle" fontSize="9" fill="#64748B">
            {d}
          </text>
        ))}
        {/* hover crosshair */}
        {hover !== null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB}
            stroke="#94A3B8" strokeWidth="1" strokeDasharray="none" />
        )}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {/* end marker + hovered point, ringed in the surface color */}
            {[...(hover !== null ? [hover] : []), n - 1].map((i) => (
              <circle key={i} cx={x(i)} cy={y(s.values[i] ?? 0)} r="4"
                fill={s.color} stroke="#FFFFFF" strokeWidth="2" />
            ))}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="absolute top-6 pointer-events-none card px-3 py-2 text-xs shadow-pop"
          style={{ left: `${Math.min(84, Math.max(2, (x(hover) / W) * 100))}%` }}>
          <div className="font-semibold mb-1">{days[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.name}</span>
              <span className="font-medium ml-auto pl-3">{money(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
