import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import AnimatedNumber from "../components/AnimatedNumber";
import EmptyState from "../components/EmptyState";
import RadialGauge from "../components/RadialGauge";
import StatusBadge from "../components/StatusBadge";
import { getTwinStates } from "../services/api";
import type { TwinState } from "../types/api";

const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

function bandLabel(score: number | null): string {
  if (score == null) return "Unknown";
  if (score >= 90) return "Healthy";
  if (score >= 70) return "Warning";
  return "Critical";
}

function bandStatus(score: number | null): string {
  if (score == null) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "warning";
  return "critical";
}

function bandBorderClass(score: number | null): string {
  if (score == null) return "";
  if (score >= 90) return "card-status-green";
  if (score >= 70) return "card-status-amber";
  return "card-status-red";
}

function TwinEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M9 8h6M9 11h4" opacity=".5" />
    </svg>
  );
}

export default function DigitalTwinPage() {
  const [states, setStates] = useState<TwinState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTwinStates()
      .then((r) => setStates(r.data))
      .catch(() => setError("Failed to load digital twin states"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center gap-3 py-12 text-[#5A5F6B]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4361EE] border-t-transparent" />
        Loading digital twin states…
      </div>
    );

  if (error) return <p className="py-8 text-[#DC2626] font-medium">{error}</p>;

  if (states.length === 0)
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#0F1115]">Digital Twin Telemetry</h2>
          <p className="mt-1 text-sm text-[#5A5F6B]">
            ARGUS composite health score (0–100) combining CUSUM and LSTM autoencoders.
          </p>
        </div>
        <EmptyState
          icon={<TwinEmptyIcon />}
          title="No twin states recorded"
          body="Train a model and run detection on a dataset to generate the first digital twin snapshot."
          ctaLabel="Go to Models"
          ctaTo="/app/models"
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#8C919E] uppercase tracking-wider">Machine Fleet Monitoring</p>
          <h2 className="text-2xl font-bold text-[#0F1115] mt-0.5">Live Twin Telemetry ({states.length} Active Machines)</h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {states.map((s, idx) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.08, ease: APPLE_EASE }}
            className={`card ${bandBorderClass(s.health_score)}`}
          >
            {/* Card Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#0F1115]">
                    {s.machine_id}
                  </h3>
                  <StatusBadge status={bandStatus(s.health_score)} label={bandLabel(s.health_score)} />
                </div>
                <p className="mt-0.5 text-xs font-semibold text-[#8C919E] uppercase tracking-wider">{s.stage_name}</p>
              </div>

              {/* Radial Gauge */}
              <div className="flex flex-col items-center shrink-0">
                <RadialGauge value={s.health_score} size={84} strokeWidth={7} />
              </div>
            </div>

            {/* Status Tags */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {s.drift_type && (
                <span className="tag-pill-accent">Drift: {s.drift_type}</span>
              )}
              {s.root_cause_parameter && (
                <span className="tag-pill-purple">
                  Root Cause: {s.root_cause_parameter}
                </span>
              )}
              <span className="ml-auto text-xs font-mono font-normal text-[#8C919E]">
                {s.state_timestamp
                  ? new Date(s.state_timestamp).toLocaleString()
                  : "—"}
              </span>
            </div>

            {/* Parameter Table */}
            <div className="mb-5 overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9F9FB]">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="col-txt !py-2 !text-[10px]">Parameter</th>
                    <th className="col-num !py-2 !text-[10px]">Current</th>
                    <th className="col-num !py-2 !text-[10px]">Target</th>
                    <th className="col-num !py-2 !text-[10px]">Limits</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(s.parameter_values ?? {}).map(([name, value]) => {
                    const lim = s.operating_limits?.[name];
                    const target = s.target_values?.[name];
                    const out =
                      lim &&
                      lim.lower != null &&
                      lim.upper != null &&
                      (value < lim.lower || value > lim.upper);
                    return (
                      <tr key={name} className="hover:bg-white transition-colors">
                        <td className="col-txt font-medium text-xs text-[#0F1115]">{name}</td>
                        {/* Light-weight monospace numerals (weight 300-400, NOT bold) */}
                        <td
                          className={`col-num !text-xs font-mono font-normal ${
                            out ? "text-[#DC2626] font-medium bg-[#FEE2E2] px-1 rounded" : "text-[#0F1115]"
                          }`}
                        >
                          {value.toFixed(2)}
                        </td>
                        <td className="col-num !text-xs font-mono font-normal text-[#5A5F6B]">
                          {target != null ? target.toFixed(2) : "—"}
                        </td>
                        <td className="col-num !text-xs font-mono font-normal text-[#8C919E]">
                          {lim && lim.lower != null
                            ? `${lim.lower}–${lim.upper}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detection Scores: Monospace light weight (300-400) */}
            <div>
              <p className="text-[10px] font-bold text-[#8C919E] uppercase tracking-wider mb-2">Detection Signal Scores</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "CUSUM", value: s.cusum_score },
                  { label: "LSTM", value: s.lstm_score },
                  { label: "Hybrid", value: s.hybrid_score },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-[#F4F4F5] border border-[#E5E7EB] text-center">
                    <span className="block text-[10px] font-semibold uppercase text-[#8C919E] mb-0.5">{label}</span>
                    <AnimatedNumber
                      value={value}
                      decimals={3}
                      duration={0.5}
                      className="font-mono font-normal text-xs text-[#0F1115]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {s.dataset_id && (
              <p className="mt-3 text-[10px] font-mono font-normal text-[#8C919E] text-right">
                Dataset ID: #{s.dataset_id}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
