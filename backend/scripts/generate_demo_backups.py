"""
Pre-generates:
1. data/synthetic_feedback.csv (with source="synthetic") and trains the 6-feature RandomForest model
2. Runs the deterministic demo pipeline (seed=42) on data/demo_courses.csv
3. Exports all 5 views (master, teacher, student, staff, canteen) and all 7 formats
   (csv, xlsx, pdf, png, jpg, json, html) into data/demo_output/
"""
import os
import sys
import shutil

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from ml.preference_learner import PreferenceLearner
from ml.predictor import PreferencePredictor
from utils.csv_parser import parse_schedule_csv
from app.services.solver import TimetableSolver
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.timetable_formatter import VALID_VIEWS, generate_multi_views
from utils.exporter import (
    export_to_csv,
    export_to_excel,
    export_to_pdf,
    export_to_image,
    export_to_json,
    export_to_html,
)


def main():
    # 1. Train ML model on synthetic_feedback.csv and copy to root data/
    learner = PreferenceLearner()
    stats = learner.train_from_feedback_rows([], include_synthetic_baseline=True)
    print(f"[ML] Trained model: {stats}")

    backend_synth = learner.synthetic_csv_path
    root_data_dir = os.path.join(ROOT_DIR, "data")
    os.makedirs(root_data_dir, exist_ok=True)
    root_synth = os.path.join(root_data_dir, "synthetic_feedback.csv")
    if os.path.exists(backend_synth) and os.path.abspath(backend_synth) != os.path.abspath(root_synth):
        shutil.copyfile(backend_synth, root_synth)
    print(f"[ML] Verified synthetic_feedback.csv at {root_synth}")

    # 2. Load data/demo_courses.csv and solve with random_seed=42
    demo_csv_path = os.path.join(root_data_dir, "demo_courses.csv")
    with open(demo_csv_path, "r", encoding="utf-8") as f:
        csv_text = f.read()

    parsed = parse_schedule_csv(csv_text)
    predictor = PreferencePredictor()
    courses = parsed["courses"]
    faculty = parsed["faculty"]
    venues = parsed["venues"]
    slots = parsed["slots"]
    config = parsed["config"]

    ml_prefs_map = {}
    for idx, fac in enumerate(faculty):
        fac["id"] = idx + 1
        prefs = predictor.predict_for_teacher(fac)
        fac["preferences"] = prefs
        ml_prefs_map[fac["name"]] = prefs

    for idx, c in enumerate(courses):
        c["id"] = idx + 1
    for idx, v in enumerate(venues):
        v["id"] = idx + 1
    for idx, s in enumerate(slots):
        s["id"] = idx + 1

    solver = TimetableSolver(time_limit_seconds=5, random_seed=42, config=config)
    solver.add_variables(courses=courses, faculty=faculty, venues=venues, slots=slots)
    solver.add_constraints([])
    ok, status_str, _ = solver.solve(timeout_seconds=5)
    assert ok, f"Demo solve failed: {status_str} - {solver.infeasibility_explanation}"
    entries = solver.get_solution()
    print(
        f"[Solver] Solved demo_courses.csv: status={status_str}, "
        f"solve_time_ms={solver.solver_time_ms}, sessions={len(entries)}"
    )

    metadata = {
        "schedule_id": 1,
        "generated_at": "2026-10-12T09:00:00+00:00",
        "section_title": "AI 2024 - Section A",
        "total_courses": len(entries),
        "total_teachers": len(faculty),
        "fairness_score": calculate_fairness_score(entries, faculty),
        "preference_satisfaction": calculate_preference_satisfaction(entries, ml_prefs_map),
        "config": config,
    }

    out_dir = os.path.join(root_data_dir, "demo_output")
    os.makedirs(out_dir, exist_ok=True)

    # Save multi-views JSON snapshot
    all_views = generate_multi_views(entries, metadata)
    import json
    with open(os.path.join(out_dir, "demo_all_views.json"), "w", encoding="utf-8") as f:
        json.dump(all_views, f, indent=2)

    # Save all 5 views x 7 formats
    for view_name in sorted(VALID_VIEWS):
        csv_bytes = export_to_csv(entries, view_type=view_name, metadata=metadata)
        with open(os.path.join(out_dir, f"demo_{view_name}.csv"), "wb") as f:
            f.write(csv_bytes)

        xlsx_bytes = export_to_excel(entries, metadata=metadata, view_type=view_name)
        with open(os.path.join(out_dir, f"demo_{view_name}.xlsx"), "wb") as f:
            f.write(xlsx_bytes)

        pdf_bytes = export_to_pdf(entries, metadata=metadata, view_type=view_name)
        with open(os.path.join(out_dir, f"demo_{view_name}.pdf"), "wb") as f:
            f.write(pdf_bytes)

        png_bytes = export_to_image(entries, img_format="PNG", view_type=view_name, metadata=metadata)
        with open(os.path.join(out_dir, f"demo_{view_name}.png"), "wb") as f:
            f.write(png_bytes)

        jpg_bytes = export_to_image(entries, img_format="JPEG", view_type=view_name, metadata=metadata)
        with open(os.path.join(out_dir, f"demo_{view_name}.jpg"), "wb") as f:
            f.write(jpg_bytes)

        json_bytes = export_to_json(entries, metadata=metadata, view_type=view_name)
        with open(os.path.join(out_dir, f"demo_{view_name}.json"), "wb") as f:
            f.write(json_bytes)

        html_bytes = export_to_html(entries, metadata=metadata, view_type=view_name)
        with open(os.path.join(out_dir, f"demo_{view_name}.html"), "wb") as f:
            f.write(html_bytes)

    print(f"[Export] Pre-generated 35 backup files (5 views x 7 formats) in {out_dir}")


if __name__ == "__main__":
    main()
