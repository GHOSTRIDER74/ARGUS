import { cn } from "../lib/utils";

type Status = "healthy" | "warning" | "critical" | "info" | "offline";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normStatus = (status || "offline").toLowerCase() as Status;
  
  // Map our states to CSS classes in index.css
  const validStatuses: Status[] = ["healthy", "warning", "critical", "info", "offline"];
  const finalStatus = validStatuses.includes(normStatus) ? normStatus : "info";

  return (
    <span className={cn("badge", `badge-${finalStatus}`, className)}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}
