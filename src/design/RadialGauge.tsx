import { motion } from "framer-motion";

/** Single-value magnitude (0–100%) as a progress ring — the "hero number with
 *  a ring" form. One hue (sequential), an animated sweep, a recessive track.
 *  Centre content is caller-supplied so the big number can live inside it. */
export function RadialGauge({
  pct,
  size = 92,
  thickness = 9,
  track = "rgba(255,255,255,0.15)",
  arc = "#93C5FD",
  children,
}: {
  pct: number;
  size?: number;
  thickness?: number;
  /** ring background colour (recessive) */
  track?: string;
  /** progress arc colour (the one hue) */
  arc?: string;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arc}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * clamped) / 100 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
