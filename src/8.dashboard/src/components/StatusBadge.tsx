import { cn } from "../lib/utils";

type Status = "healthy" | "warning" | "critical" | "info" | "offline";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normStatus = (status || "offline").toLowerCase();
  
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-500/10";
  let dotStyle = "bg-emerald-500";
  let hasPing = false;

  if (normStatus === "critical" || normStatus === "interlocked") {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/80 ring-1 ring-rose-500/10";
    dotStyle = "bg-rose-500";
    hasPing = true;
  } else if (normStatus === "warning") {
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80 ring-1 ring-amber-500/10";
    dotStyle = "bg-amber-500";
  } else if (normStatus === "offline") {
    badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
    dotStyle = "bg-slate-400";
  }

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full font-mono text-[11px] inline-flex items-center gap-1.5 border capitalize font-semibold shadow-2xs", badgeStyle, className)}>
      <span className="relative flex h-2 w-2">
        {hasPing && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", dotStyle)} />
      </span>
      {normStatus === "interlocked" ? "Interlocked" : status}
    </span>
  );
}
