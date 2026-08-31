import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface Props {
  value: number | null | undefined;
  /** Decimal places to display (default: 0) */
  decimals?: number;
  /** Animation duration in seconds (default: 0.6) */
  duration?: number;
  /** Fallback string when value is null/undefined */
  fallback?: string;
  className?: string;
}

/**
 * AnimatedNumber — Uses Framer Motion's useMotionValue + animate for smooth counting.
 * Easing: [0.16, 1, 0.3, 1] (Apple-feel curve).
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 0.6,
  fallback = "—",
  className = "",
}: Props) {
  const motionVal = useMotionValue(value ?? 0);
  const rounded = useTransform(motionVal, (latest) =>
    latest.toFixed(decimals)
  );

  useEffect(() => {
    if (value == null) return;
    const controls = animate(motionVal, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, duration, motionVal]);

  if (value == null) return <span className={className}>{fallback}</span>;

  return <motion.span className={className}>{rounded}</motion.span>;
}
