import { motion } from "framer-motion";
import { useId, useRef, useState } from "react";

import { money } from "../lib/money";

/** SVG line chart for one or two daily series — smoothed (monotone-cubic,
 *  no overshoot on spikes), gradient area fill, an animated draw-in on
 *  mount, recessive gridlines, a legend, and a hover crosshair tooltip
 *  carrying the exact values. No chart library needed. */

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

/** Monotone-cubic Hermite spline through evenly (or unevenly) spaced points —
 *  same family of algorithm as D3's curveMonotoneX. Unlike a Catmull-Rom
 *  spline it never overshoots past a point's neighbours, which matters here:
 *  daily revenue series can have a sharp one-day spike, and an overshooting
 *  curve would render that as a dip below zero on either side. */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i + 1].x, y1 = pts[i + 1].y;
    const cx0 = x0 + dx[i] / 3, cy0 = y0 + (t[i] * dx[i]) / 3;
    const cx1 = x1 - dx[i] / 3, cy1 = y1 - (t[i + 1] * dx[i]) / 3;
    d += ` C${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
  }
  return d;
}

export function LineChart({ days, series }: { days: string[]; series: LineSeries[] }) {
  const uid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, padL = 46, padR = 16, padT = 12, padB = 26;
  const n = days.length;
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => padL + (n < 2 ? 0 : ((W - padL - padR) * i) / (n - 1));
  const y = (v: number) => H - padB - ((H - padT - padB) * v) / top;
  const baseline = H - padB;
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
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`lc-grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* gridlines + clean y ticks */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} y1={y(top * f)} x2={W - padR} y2={y(top * f)}
              className="stroke-hairline" strokeWidth="1" />
            <text x={padL - 6} y={y(top * f) + 3.5} textAnchor="end" fontSize="9.5" className="fill-muted">
              {compact(top * f)}
            </text>
          </g>
        ))}
        {/* x labels: every nth day + the last one, dropping the nth tick that
            would crowd the forced end label */}
        {days.map((d, i) => ((i % skip === 0 && n - 1 - i >= skip / 2) || i === n - 1) && (
          <text key={i} x={x(i)} y={H - padB + 14} textAnchor="middle" fontSize="9" className="fill-muted">
            {d}
          </text>
        ))}
        {/* hover crosshair */}
        {hover !== null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB}
            stroke="#94A3B8" strokeWidth="1" strokeDasharray="none" />
        )}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
          const line = smoothPath(pts);
          const area = n > 1
            ? `${line} L${x(n - 1)},${baseline} L${x(0)},${baseline} Z`
            : "";
          return (
            <g key={s.name}>
              {area && (
                <motion.path
                  d={area}
                  fill={`url(#lc-grad-${uid}-${si})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />
              )}
              <motion.path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* end marker + hovered point, ringed in the surface color */}
              {[...(hover !== null ? [hover] : []), n - 1].map((i) => (
                <motion.circle
                  key={i}
                  cx={x(i)}
                  cy={y(s.values[i] ?? 0)}
                  r="4"
                  fill={s.color}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i === hover ? 0 : 1, type: "spring", stiffness: 400, damping: 20 }}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="absolute top-6 pointer-events-none card px-3 py-2 text-xs shadow-pop z-10 animate-scale-in"
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
