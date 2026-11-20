import { cn } from "../lib/utils";

const STYLES: Record<string, { badge: string; dot: string }> = {
  healthy:  { badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-400" },
  warning:  { badge: "bg-amber-400/10 text-amber-300 ring-amber-400/30", dot: "bg-amber-400" },
  critical: { badge: "bg-red-500/10 text-red-300 ring-red-400/35", dot: "bg-red-400 animate-pulse" },
  info:     { badge: "bg-sky-500/10 text-sky-300 ring-sky-400/25", dot: "bg-sky-400" },
  offline:  { badge: "bg-slate-500/10 text-slate-400 ring-slate-500/25", dot: "bg-slate-500" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STYLES[(status || "offline").toLowerCase()] ?? STYLES.offline;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset", s.badge, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}
