import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface Props {
  value: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function bandColor(score: number | null | undefined): string {
  if (score == null) return "#8C919E";
  if (score >= 90) return "#16A34A"; // Green
  if (score >= 70) return "#D97706"; // Amber
  return "#DC2626";                   // Red
}

function bandBg(score: number | null | undefined): string {
  if (score == null) return "#F4F4F5";
  if (score >= 90) return "#DCFCE7";
  if (score >= 70) return "#FEF9C3";
  return "#FEE2E2";
}

export default function RadialGauge({ value, size = 100, strokeWidth = 7, className = "" }: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const arcFraction = 0.75; // 270° arc
  const arcLength = circumference * arcFraction;
  const targetScore = value ?? 0;

  const motionScore = useMotionValue(targetScore);
  const roundedScore = useTransform(motionScore, (v) => Math.round(v));

  useEffect(() => {
    if (value == null) return;
    const controls = animate(motionScore, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, motionScore]);

  const filled = arcLength * (Math.min(Math.max(targetScore, 0), 100) / 100);
  const color = bandColor(value);
  const bg = bandBg(value);
  const rotation = -225;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={bg}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
          style={{ transition: "stroke 300ms ease" }}
        />
        {/* Filled Arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms ease",
          }}
        />
      </svg>

      {/* Monospace score readout: Light-weight monospace (300-400), NOT bold */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-mono font-normal leading-none"
          style={{
            fontSize: size * 0.24,
            color: value == null ? "#8C919E" : color,
            transition: "color 300ms ease",
          }}
        >
          {value != null ? roundedScore : "—"}
        </motion.span>
        <span
          className="font-sans font-medium leading-none mt-0.5"
          style={{ fontSize: size * 0.1, color: "#8C919E" }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
