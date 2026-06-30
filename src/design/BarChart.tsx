/** Minimal SVG bar chart — no chart library needed. */
export function BarChart({ bars }: { bars: { name: string; value: number }[] }) {
  if (!bars.length) return <div className="text-sm text-muted py-6 text-center">No data.</div>;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const W = 520, H = 200, pad = 28;
  const bw = (W - pad * 2) / bars.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* baseline */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#EDE7DC" strokeWidth="1" />
      {bars.map((b, i) => {
        const h = ((H - pad * 2) * b.value) / max;
        const x = pad + i * bw + bw * 0.18;
        const y = H - pad - h;
        return (
          <g key={b.name}>
            <rect x={x} y={y} width={bw * 0.64} height={h} rx="4" fill="#1C6B57" />
            <text x={x + bw * 0.32} y={y - 5} textAnchor="middle" fontSize="11" fill="#3D4A4E">
              {Math.round(b.value).toLocaleString("en-IN")}
            </text>
            <text x={x + bw * 0.32} y={H - pad + 14} textAnchor="middle" fontSize="10.5" fill="#8A8478">
              {b.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
