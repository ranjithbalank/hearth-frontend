import { motion } from "framer-motion";
import { useState } from "react";

export interface DonutSlice { label: string; value: number; color: string; display?: string }

/** Part-to-whole donut. 2px surface gaps between segments (mark spec), an
 *  always-present legend with direct value + % labels (identity never by colour
 *  alone — this is also the secondary encoding the validator requires for the
 *  amber↔green pair), a hover highlight, and an animated sweep. Centre carries
 *  the total so the chart reads as one figure. */
export function Donut({
  slices,
  size = 148,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  /** overrides the computed count in the centre (e.g. a money total) */
  centerValue?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2; // px of surface between segments

  let acc = 0;
  const segs = slices.map((d) => {
    const frac = d.value / total;
    const len = Math.max(0, frac * c - gap);
    const seg = { d, len, offset: acc, pct: Math.round(frac * 100) };
    acc += frac * c;
    return seg;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--donut-track,#EEF2F7)" strokeWidth={thickness} />
          {segs.map((s, i) => (
            <motion.circle
              key={s.d.label}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.d.color} strokeWidth={hover === i ? thickness + 3 : thickness}
              strokeDasharray={`${s.len} ${c - s.len}`}
              strokeDashoffset={-s.offset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.12 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default", transition: "stroke-width .15s" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          {hover !== null ? (
            <div className="animate-fade-in">
              <div className="stat-num text-xl leading-none">{segs[hover].pct}%</div>
              <div className="text-[10px] text-muted mt-0.5 max-w-[80px]">{slices[hover].label}</div>
            </div>
          ) : (
            <div>
              <div className={`stat-num leading-none ${centerValue ? "text-base" : "text-2xl"}`}>{centerValue ?? total}</div>
              {centerLabel && <div className="text-[10px] uppercase tracking-wide text-muted mt-1">{centerLabel}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-[120px] space-y-1.5">
        {slices.map((d, i) => (
          <button
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`w-full flex items-start gap-2 text-left rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${
              hover === i ? "bg-cream" : ""
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1" style={{ background: d.color }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{d.label}</span>
              <span className="block text-xs text-muted tabular-nums">{d.display ?? d.value} · {segs[i].pct}%</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
