"""Write pipeline outputs to a timestamped folder under the results directory."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd


def _json_default(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name) or "run"


def write_results(
    results_dir: str | Path,
    run_name: str,
    payload: dict,
    cleaned_df: pd.DataFrame | None = None,
    features_df: pd.DataFrame | None = None,
) -> Path:
    """Save the full pipeline result plus evaluation outputs. Returns the run folder."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    out = Path(results_dir) / f"{stamp}_{_safe_name(run_name)}"
    out.mkdir(parents=True, exist_ok=True)

    (out / "pipeline_result.json").write_text(
        json.dumps(payload, indent=2, default=_json_default), encoding="utf-8"
    )

    evaluations = {
        f"{t['machine_id']}/{t['stage_name']}": t.get("evaluation")
        for t in payload.get("targets", [])
    }
    (out / "evaluation.json").write_text(
        json.dumps(evaluations, indent=2, default=_json_default), encoding="utf-8"
    )

    impacts = {
        f"{t['machine_id']}/{t['stage_name']}": t["impact"]
        for t in payload.get("targets", [])
        if t.get("impact") is not None
    }
    if impacts:
        (out / "impact_result.json").write_text(
            json.dumps(impacts, indent=2, default=_json_default), encoding="utf-8"
        )

    if cleaned_df is not None:
        cleaned_df.to_csv(out / "cleaned_data.csv", index=False)
    if features_df is not None:
        features_df.to_csv(out / "feature_table.csv", index=False)
    return out
