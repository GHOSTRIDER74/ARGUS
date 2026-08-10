/** Minimal dependency-free SVG line chart for time-series with reference lines. */

interface RefLine {
  value: number;
  color: string;
  label: string;
  dashed?: boolean;
}

interface VertMarker {
  index: number;
  color: string;
  label: string;
}

interface Props {
  values: (number | null)[];
  height?: number;
  color?: string;
  refLines?: RefLine[];
  vertMarkers?: VertMarker[];
  extraSeries?: { values: (number | null)[]; color: string; label: string }[];
}

export default function TrendChart({
  values,
  height = 200,
  color = "#38bdf8",
  refLines = [],
  vertMarkers = [],
  extraSeries = [],
}: Props) {
  const width = 800;
  const pad = 36;
  const nums = [
    ...values,
    ...refLines.map((r) => r.value),
    ...extraSeries.flatMap((s) => s.values),
  ].filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return <p className="text-sm text-slate-500">No data to chart.</p>;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const x = (i: number, n: number) => pad + (i / Math.max(n - 1, 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - min) / range) * (height - 2 * pad);

  const path = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${i === 0 || vals[i - 1] == null ? "M" : "L"}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-md bg-slate-950">
      {/* y-axis labels */}
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <text x={4} y={y(v) + 4} fill="#64748b" fontSize={10}>
            {v.toFixed(1)}
          </text>
          <line x1={pad} x2={width - pad} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth={1} />
        </g>
      ))}
      {refLines.map((r, i) => (
        <g key={`r${i}`}>
          <line
            x1={pad}
            x2={width - pad}
            y1={y(r.value)}
            y2={y(r.value)}
            stroke={r.color}
            strokeWidth={1.2}
            strokeDasharray={r.dashed ? "5,4" : undefined}
          />
          <text x={width - pad + 2} y={y(r.value) + 3} fill={r.color} fontSize={9}>
            {r.label}
          </text>
        </g>
      ))}
      {vertMarkers.map((m, i) => (
        <g key={`v${i}`}>
          <line
            x1={x(m.index, values.length)}
            x2={x(m.index, values.length)}
            y1={pad / 2}
            y2={height - pad}
            stroke={m.color}
            strokeWidth={1.2}
            strokeDasharray="4,3"
          />
          <text x={x(m.index, values.length) + 3} y={pad / 2 + 8} fill={m.color} fontSize={9}>
            {m.label}
          </text>
        </g>
      ))}
      {extraSeries.map((s, i) => (
        <path key={`s${i}`} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.2} opacity={0.9} />
      ))}
      <path d={path(values)} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
