"""Standalone orchestration of the complete Module 1 + Module 2 workflow.

    load/generate data -> validate -> preprocess -> wide feature table
    -> baseline -> chronological split -> scaler -> sequences -> LSTM AE
    -> CUSUM -> reconstruction errors -> hybrid score -> persistence
    -> drift classification -> severity -> root cause -> forecast
    -> health score -> save results -> save evaluation outputs

No algorithm formulas live in this file — it only wires together the existing
implementations in backend/app/modules.
"""
from pathlib import Path

from algorithm_pipeline import (
    config_loader,
    data_adapter,
    module1_runner,
    module2_runner,
    module3_runner,
    result_writer,
)


def run_pipeline(config_path: str) -> dict:
    """Run the full standalone pipeline described by a YAML/JSON config file."""
    cfg = config_loader.load_config(config_path)

    # 1. load or generate the dataset
    long_df, ground_truth = data_adapter.load_data(cfg.data)

    # 2. Module 1: validate -> clean -> quality -> features
    m1 = module1_runner.run_module1(long_df, cfg.preprocessing)
    clean_df = m1["clean_df"]

    # 3. Module 2 per machine/stage target (auto-discovered when not configured)
    targets = [(t.machine_id, t.stage_name) for t in cfg.targets] or data_adapter.discover_targets(
        clean_df
    )
    target_results = []
    for machine_id, stage_name in targets:
        wide, param_info = data_adapter.wide_frame_for(clean_df, machine_id, stage_name)
        model_id, artifacts, training_summary = module2_runner.train_or_load(
            wide, param_info, machine_id, stage_name, ground_truth, cfg.training
        )
        detection_result, context = module2_runner.detect(
            wide, artifacts, model_id, machine_id, stage_name, cfg.detection
        )
        evaluation = module2_runner.evaluate_against_ground_truth(
            detection_result, context, ground_truth, machine_id, stage_name
        )
        impact = module3_runner.run_module3(detection_result, machine_id, stage_name, cfg.module3)
        target_results.append(
            {
                "machine_id": machine_id,
                "stage_name": stage_name,
                "model_id": model_id,
                "training": training_summary,
                "detection": detection_result,
                "evaluation": evaluation,
                "impact": impact,
            }
        )

    payload = {
        "run_name": cfg.name,
        "config_path": str(Path(config_path).resolve()),
        "data_source": cfg.data.source,
        "input_rows": int(len(long_df)),
        "ground_truth_drifts": len(ground_truth),
        "module1": {
            "validation": m1["validation_report"],
            "cleaning": m1["cleaning_report"],
            "quality": m1["quality"],
            "cleaned_rows": int(len(clean_df)),
        },
        "targets": target_results,
    }

    # 4. save results + evaluation outputs
    out_dir = result_writer.write_results(
        cfg.output.results_dir,
        cfg.name,
        payload,
        cleaned_df=clean_df if cfg.output.save_cleaned_data else None,
        features_df=m1["features_df"] if cfg.output.save_cleaned_data else None,
    )
    payload["results_dir"] = str(out_dir)

    _print_summary(payload)
    return payload


def _print_summary(payload: dict) -> None:
    line = "=" * 64
    print(line)
    print(f"ARGUS algorithm pipeline — {payload['run_name']}")
    print(line)
    print(
        f"Data source : {payload['data_source']} "
        f"({payload['input_rows']} input rows, {payload['ground_truth_drifts']} injected drifts)"
    )
    q = payload["module1"]["quality"]
    print(
        f"Module 1    : valid={payload['module1']['validation']['is_valid']} "
        f"quality={q['quality_score']:.1f} cleaned_rows={payload['module1']['cleaned_rows']}"
    )
    for t in payload["targets"]:
        d = t["detection"]
        print(f"\nTarget {t['machine_id']} / {t['stage_name']} (model {t['model_id']})")
        print(
            f"  status={d['status']} drift_detected={d['drift_detected']} "
            f"type={d['drift_type']}"
        )
        print(
            f"  hybrid={d['hybrid_score']:.3f} severity={d['severity']['score']:.1f} "
            f"({d['severity']['level']}) health={d['health_score']:.1f}"
        )
        rc = d.get("root_cause") or {}
        if rc.get("parameter_name"):
            print(
                f"  root cause: {rc['parameter_name']} "
                f"(contribution {rc.get('contribution')}, direction {rc.get('direction')})"
            )
        e = t["evaluation"]
        if e.get("ground_truth_available"):
            print(
                f"  evaluation: precision={e['precision']} recall={e['recall']} "
                f"f1={e['f1_score']} fpr={e['false_positive_rate']} fnr={e['false_negative_rate']}"
            )
            print(
                f"              detection_delay={e['detection_delay_hours']}h "
                f"start_error={e['estimated_start_error_hours']}h"
            )
        else:
            print(f"  evaluation: no ground truth for this scope ({e.get('note', '')})")
        imp = t.get("impact")
        if imp is not None:
            if imp.get("skipped"):
                print(f"  impact (Module 3): skipped — {imp.get('reason')}")
            else:
                fin = imp["financial"]
                unc = imp["uncertainty"]
                print(
                    f"  impact (Module 3, DEMO assumptions): total={fin['total_financial_impact']} "
                    f"{fin['currency']} (best {unc['best_case']} / worst {unc['worst_case']}) "
                    f"yield_loss={imp['operational']['yield_loss_percentage_points']}pp "
                    f"scrap={imp['operational']['scrap_units']} rework={imp['operational']['rework_units']}"
                )
    print(f"\nResults written to {payload['results_dir']}")
    print(line)
