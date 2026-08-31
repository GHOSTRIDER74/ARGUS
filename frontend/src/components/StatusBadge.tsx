/**
 * StatusBadge — single source of truth for all status / severity pills.
 *
 * Maps every status string the app uses to the shared three-tier
 * color system: green (healthy / resolved), amber (warning / moderate /
 * acknowledged), red (critical / high / open), orange (degraded),
 * slate (minor / low / unknown / neutral).
 */

type Variant = "green" | "amber" | "orange" | "red" | "slate";

function variantFor(status: string): Variant {
  const s = status.toLowerCase();
  if (["healthy", "resolved", "active"].includes(s)) return "green";
  if (["warning", "moderate", "acknowledged"].includes(s)) return "amber";
  if (["degraded"].includes(s)) return "orange";
  if (["critical", "high", "open"].includes(s)) return "red";
  return "slate";
}

interface Props {
  status: string;
  /** Optional: override the display label (defaults to status string) */
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = "" }: Props) {
  const variant = variantFor(status);
  return (
    <span
      className={`status-badge status-badge-${variant} ${className}`}
      title={status}
    >
      {label ?? status}
    </span>
  );
}
