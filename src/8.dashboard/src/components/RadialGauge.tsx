interface RadialGaugeProps {
  value: number; // 0 to 1
  label: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function RadialGauge({ 
  value, 
  label, 
  color = "var(--accent-primary)", 
  size = 120, 
  strokeWidth = 10 
}: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - Math.max(0, Math.min(1, value)) * circumference;

  return (
    <div className="gauge-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          stroke="var(--border-light)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Value track */}
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: 'absolute', marginTop: size / 2 - 12 }}>
        <div className="gauge-value" style={{ textAlign: 'center', color }}>
          {Math.round(value * 100)}%
        </div>
      </div>
      <div className="gauge-label" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}
