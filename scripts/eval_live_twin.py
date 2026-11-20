"""
Before/after accuracy of the LIVE digital twin: CUSUM only vs CUSUM + LSTM-AE.

Replays data/processed/secom_processed.csv through StateManager with a drift injected on one
etch channel (3 drift types x 4 channels x onsets 800/1000/1200 = 36 runs), and scores the
etch stage after every record: an "alert" is WARNING or CRITICAL on the etcher that got the record.
Metrics over records 500..end: F1, false-alarm rate (pre-onset), latency (records from onset to first alert).
Run:  python scripts/eval_live_twin.py
"""
import json, sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "src" / "2.twin"), str(ROOT / "src" / "3.drift")]
from state_manager import StateManager          # noqa: E402
from live_lstm import LiveLSTM, FEATURES         # noqa: E402

EVAL_START, ONSETS, CYCLE = 500, [800, 1000, 1200], 50
df = pd.read_csv(ROOT / "data" / "processed" / "secom_processed.csv")
cols = [c for c in df.columns if c not in ("Time",)]
base = df[cols].copy()


def inject(kind, ch, onset):
    d = base.copy()
    sd = float(d[ch][:EVAL_START].std())
    t = np.arange(len(d)); m = t >= onset
    add = {"gradual": (t - onset) * 0.04 * sd, "sudden": np.full(len(d), 3.0 * sd),
           "cyclical": 1.5 * sd * np.sin(2 * np.pi * (t - onset) / CYCLE)}[kind]
    d.loc[m, ch] = d.loc[m, ch] + add[m]
    return d


def replay(d, lstm):
    sm = StateManager(lstm=lstm)
    alert, crit = np.zeros(len(d), int), np.zeros(len(d), int)
    for i, rec in enumerate(d.to_dict("records")):
        sm.ingest_telemetry(rec)
        m = sm.machines["ETCH-01" if (i + 1) % 2 == 0 else "ETCH-02"]   # etcher that received record i
        alert[i] = m.health.value != "healthy"
        crit[i] = m.health.value == "critical"
    return alert, crit


def score(a, onset):
    t = np.arange(len(a)); ev = t >= EVAL_START
    y, p = (t[ev] >= onset).astype(int), a[ev]
    tp, fp = int(((p == 1) & (y == 1)).sum()), int(((p == 1) & (y == 0)).sum())
    fn, tn = int(((p == 0) & (y == 1)).sum()), int(((p == 0) & (y == 0)).sum())
    prec, rec = tp / max(tp + fp, 1), tp / max(tp + fn, 1)
    hits = np.flatnonzero(a[onset:])
    return {"f1": 2 * prec * rec / max(prec + rec, 1e-9), "far": 100 * fp / max(fp + tn, 1),
            "lat": float(hits[0]) if len(hits) else None}


def summary(rows):
    lat = [r["lat"] for r in rows if r["lat"] is not None]
    return {"f1": round(float(np.mean([r["f1"] for r in rows])), 3), "far_pct": round(float(np.mean([r["far"] for r in rows])), 1),
            "latency": round(float(np.mean(lat)), 1) if lat else None, "detected_pct": round(100 * len(lat) / len(rows), 1)}


lstm = LiveLSTM.load_or_train()
res = {m: {"alert": [], "critical": [], "by_type": {}} for m in ("CUSUM only", "CUSUM + LSTM-AE")}
for kind in ("gradual", "sudden", "cyclical"):
    for ch in FEATURES:
        for onset in ONSETS:
            d = inject(kind, ch, onset)
            for name, model in (("CUSUM only", None), ("CUSUM + LSTM-AE", lstm)):
                a, c = replay(d, model)
                r = score(a, onset)
                res[name]["alert"].append(r); res[name]["critical"].append(score(c, onset))
                res[name]["by_type"].setdefault(kind, []).append(r)
    print("done", kind, flush=True)

clean_alert = {name: round(100 * replay(base, model)[0][EVAL_START:].mean(), 1)
               for name, model in (("CUSUM only", None), ("CUSUM + LSTM-AE", lstm))}
out = {name: {"alert": summary(v["alert"]), "critical": summary(v["critical"]),
              "alert_f1_by_type": {k: round(float(np.mean([r["f1"] for r in rs])), 3) for k, rs in v["by_type"].items()},
              "alert_rate_on_clean_secom_pct": clean_alert[name]} for name, v in res.items()}
out["config"] = {"runs": 36, "eval_from_record": EVAL_START, "lstm_tau_99": round(lstm.tau, 4)}
(ROOT / "results").mkdir(exist_ok=True)
(ROOT / "results" / "live_twin_eval.json").write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=2))
