import { type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaTo?: string;
  ctaOnClick?: () => void;
}

export default function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
  ctaOnClick,
}: Props) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon mb-1">{icon}</div>}
      <div>
        <p className="empty-state-title">{title}</p>
        {body && <p className="empty-state-body mt-1">{body}</p>}
      </div>
      {ctaLabel && (
        ctaTo ? (
          <Link to={ctaTo} className="btn-primary mt-2">
            {ctaLabel}
          </Link>
        ) : (
          <button onClick={ctaOnClick} className="btn-primary mt-2">
            {ctaLabel}
          </button>
        )
      )}
    </div>
  );
}
