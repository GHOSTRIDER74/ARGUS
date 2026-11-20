import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (val: number) => string;
  className?: string;
  decimals?: number;
  from?: number;
}

export function AnimatedNumber({ 
  value, 
  duration = 800, 
  formatFn,
  className,
  decimals,
  from = 0
}: AnimatedNumberProps) {
  // Start from 0 (or custom from) so numbers flip / roll up whenever a user navigates to a new page!
  const [displayValue, setDisplayValue] = useState<number>(from);
  const currentValRef = useRef<number>(from);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = currentValRef.current;
    const distance = value - startValue;

    if (distance === 0) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth cubic-out easing for an authentic odometer/flip roll feel
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 3);
      const current = progress === 1 ? value : startValue + distance * easeProgress;
      
      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animRef.current = window.requestAnimationFrame(step);
      } else {
        currentValRef.current = value;
      }
    };

    animRef.current = window.requestAnimationFrame(step);

    return () => {
      if (animRef.current) {
        window.cancelAnimationFrame(animRef.current);
      }
    };
  }, [value, duration]);

  const formatted = (() => {
    if (formatFn) {
      return formatFn(displayValue);
    }
    if (decimals !== undefined) {
      return displayValue.toFixed(decimals);
    }
    // Cleanly round integers during flip to avoid unformatted decimal tails
    if (Number.isInteger(value)) {
      return Math.round(displayValue).toLocaleString();
    }
    return Number(displayValue.toFixed(2)).toLocaleString();
  })();

  return <span className={className}>{formatted}</span>;
}
