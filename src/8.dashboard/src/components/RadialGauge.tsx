interface RadialGaugeProps {
  value: number; // 0 to 1
  label?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function RadialGauge({ 
  value, 
  label, 
  color = "#10B981", 
  size = 96, 
  strokeWidth = 7 
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - clamped * circumference;

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Subtle background glow/track */}
          <circle
            stroke="#e2e8f0"
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
            style={{ 
              strokeDashoffset: offset, 
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' 
            }}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>

        {/* Center percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span 
            className="font-mono font-bold text-base md:text-lg tracking-tight"
            style={{ color }}
          >
            {Math.round(clamped * 100)}%
          </span>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest -mt-0.5">
            Drift
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1">
          {label}
        </span>
      )}
    </div>
  );
}
