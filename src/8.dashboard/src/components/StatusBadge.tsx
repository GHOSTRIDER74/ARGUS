import { cn } from "../lib/utils";

type Status = "healthy" | "warning" | "critical" | "info" | "offline";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normStatus = (status || "offline").toLowerCase();
  
  let badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200/60";
  let dotStyle = "bg-emerald-500";

  if (normStatus === "critical") {
    badgeStyle = "bg-coral-subtle text-secondary border-secondary-container/40";
    dotStyle = "bg-secondary animate-pulse";
  } else if (normStatus === "warning") {
    badgeStyle = "bg-amber-100 text-amber-900 border-amber-200/60";
    dotStyle = "bg-amber-500";
  } else if (normStatus === "offline") {
    badgeStyle = "bg-surface-container text-on-surface-variant border-outline-variant/30";
    dotStyle = "bg-outline-variant";
  }

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full font-label-caps text-[11px] inline-flex items-center gap-1.5 border capitalize font-semibold", badgeStyle, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotStyle)} />
      {status}
    </span>
  );
}
