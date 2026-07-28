import { motion } from "framer-motion";
import { useId } from "react";

/** SVG column chart — no chart library needed. Labels never tilt or
 *  collide: small 9px names that wrap onto two lines under the column, an
 *  ellipsis only when even two lines can't hold them (the hover tooltip
 *  carries the full name + exact value), and when columns get extremely
 *  narrow only every nth label is drawn. Bars grow in on mount, staggered
 *  left-to-right, with a glossy vertical gradient fill. */

/** 4px rounded data-end, square at the baseline. */
function roundedTop(x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-w} z`;
}

const ell = (s: string, fit: number) =>
  s.length > fit ? s.slice(0, Math.max(fit - 1, 3)) + "…" : s;

/** Fit a name under its column: one line if it fits, else two lines broken
 *  at the space nearest the middle, each line ellipsized as a last resort. */
function nameLines(name: string, fit: number): string[] {
  if (name.length <= fit) return [name];
  const words = name.split(" ");
  if (words.length === 1) return [ell(name, fit)];
  let best = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return [ell(words.slice(0, best).join(" "), fit), ell(words.slice(best).join(" "), fit)];
}

export function BarChart({ bars }: { bars: { name: string; value: number }[] }) {
  const uid = useId();
  if (!bars.length) return <div className="text-sm text-muted py-6 text-center">No data.</div>;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const longest = Math.max(...bars.map((b) => b.name.length));
  const W = 520, pad = 28;
  const bw = (W - pad * 2) / bars.length;
  // Characters that fit under one column at font-size 9 (~5px per char).
  const fit = Math.max(0, Math.floor((bw - 4) / 5));
  // Extremely narrow columns: draw every nth label instead.
  const skip = fit < 4 ? Math.max(1, Math.ceil((longest * 5.2 + 8) / bw)) : 1;
  const labels = bars.map((b) =>
    skip > 1 ? (null as string[] | null) : nameLines(b.name, fit));
  const twoLine = labels.some((l) => l && l.length > 1);
  const padB = twoLine ? 38 : 28;
  const H = 172 + padB;
  const baseline = H - padB;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      <defs>
        <linearGradient id={`bc-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1={pad} y1={baseline} x2={W - pad} y2={baseline} className="stroke-hairline" strokeWidth="1" />
      {bars.map((b, i) => {
        const h = ((H - pad - padB) * b.value) / max;
        const x = pad + i * bw + bw * 0.18;
        const cx = x + bw * 0.32;
        const lines = skip > 1 ? (i % skip === 0 ? [b.name] : []) : labels[i]!;
        return (
          <g key={`${b.name}-${i}`}>
            <title>{`${b.name}: ${b.value.toLocaleString("en-IN")}`}</title>
            <motion.path
              d={roundedTop(x, baseline - h, bw * 0.64, h)}
              fill={`url(#bc-grad-${uid})`}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              whileHover={{ opacity: 0.85 }}
              style={{ transformOrigin: `${cx}px ${baseline}px` }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            />
            <text x={cx} y={baseline - h - 5} textAnchor="middle" fontSize={bw < 36 ? 8.5 : 10} className="fill-body font-medium">
              {Math.round(b.value).toLocaleString("en-IN")}
            </text>
            {lines.map((line, j) => (
              <text key={j} x={cx} y={baseline + 12 + j * 10} textAnchor="middle"
                fontSize="9" className="fill-muted">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
