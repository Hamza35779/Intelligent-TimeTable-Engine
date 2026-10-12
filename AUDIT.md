# Technical Audit Report (`AUDIT.md`)

## 1. Project Folder Tree (Before Fixes)

```text
.gitignore
README.md
docker-compose.yml
backend/.env.example
backend/Dockerfile
backend/requirements.txt
backend/timetable.db
backend/app/__init__.py
backend/app/config.py
backend/app/database.py
backend/app/dependencies.py
backend/app/main.py
backend/app/models/__init__.py
backend/app/models/constraint.py
backend/app/models/course.py
backend/app/models/faculty.py
backend/app/models/feedback.py
backend/app/models/slot.py
backend/app/models/timetable.py
backend/app/models/venue.py
backend/app/routers/__init__.py
backend/app/routers/chat.py
backend/app/routers/constraints.py
backend/app/routers/export.py
backend/app/routers/feedback.py
backend/app/routers/health.py
backend/app/routers/ml.py
backend/app/routers/schedule.py
backend/app/routers/timetable.py
backend/app/schemas/__init__.py
backend/app/schemas/constraint.py
backend/app/schemas/course.py
backend/app/schemas/faculty.py
backend/app/schemas/slot.py
backend/app/schemas/timetable.py
backend/app/schemas/venue.py
backend/app/services/__init__.py
backend/app/services/analytics.py
backend/app/services/solver.py
backend/app/services/validator.py
backend/ml/__init__.py
backend/ml/feature_engineer.py
backend/ml/predictor.py
backend/ml/preference_learner.py
backend/ml/models/model_meta.pkl
backend/ml/models/preference_model.pkl
backend/ml/models/scaler.pkl
backend/solver/__init__.py
backend/solver/constraint_solver.py
backend/solver/fairness.py
backend/solver/validator.py
backend/tasks/__init__.py
backend/tasks/ml_training.py
backend/tests/__init__.py
backend/tests/test_api.py
backend/tests/test_constraints.py
backend/tests/test_ml.py
backend/tests/test_performance.py
backend/tests/test_solver.py
backend/utils/__init__.py
backend/utils/csv_parser.py
backend/utils/exporter.py
backend/utils/metrics.py
backend/utils/timetable_formatter.py
frontend/Dockerfile
frontend/next-env.d.ts
frontend/package-lock.json
frontend/package.json
frontend/postcss.config.js
frontend/tailwind.config.js
frontend/tsconfig.json
frontend/app/globals.css
frontend/app/layout.tsx
frontend/app/page.tsx
frontend/app/analytics/page.tsx
frontend/app/constraints/page.tsx
frontend/app/constraints/create/page.tsx
frontend/app/feedback/[id]/page.tsx
frontend/app/schedule/page.tsx
frontend/app/schedule/[id]/page.tsx
frontend/components/Analytics.tsx
frontend/components/ChatBot.tsx
frontend/components/ConstraintForm.tsx
frontend/components/CsvUploader.tsx
frontend/components/ExportOptions.tsx
frontend/components/FeedbackForm.tsx
frontend/components/MLStatus.tsx
frontend/components/MetricsPanel.tsx
frontend/components/Navbar.tsx
frontend/components/SolverStatus.tsx
frontend/components/TimetableGrid.tsx
frontend/hooks/useConstraints.ts
frontend/hooks/useFeedback.ts
frontend/hooks/useML.ts
frontend/hooks/useSchedule.ts
frontend/types/index.ts
frontend/utils/localFallbackSolver.ts
```

---

## 2. Dependency Installation, Backend Run & Initial Pytest Results (Before Fixes)

- **Environment**: Python 3.13.15 (`uv`-created virtualenv in `backend/.venv`), FastAPI + SQLAlchemy + Google OR-Tools + scikit-learn.
  - *Note*: `.\.venv\Scripts\pip` is not installed as a standalone script inside the `uv` venv (`uv pip install -r requirements.txt` is used instead); all dependencies in `requirements.txt` are installed and importable.
- **Initial Test Suite Output (`pytest -v`)**:
  - 24/24 existing tests passed in `29.62s`, with 1 `StarletteDeprecationWarning` (`httpx` in `starlette.testclient`).
  - However, existing tests did **not** test multi-session credit hour splitting, lunch protection (`12:00`–`14:00`), minimum gap/break rules, human-readable infeasibility diagnosis, `<30` row ML uniform fallback, `predict_proba` summing to 1.0, chatbot invalid view/format rejection, or `POST /demo/run`.

---

## 3. OpenAPI (`/docs`) Route Probe Summary (Before Fixes)

| Route | Method | Pre-Fix Status | Notes |
|---|---|---|---|
| `/` | `GET` | `200 OK` | Root status endpoint works |
| `/health` | `GET` | `200 OK` | Missing `ml_model_present`, `gemini_configured`, `redis_status` fields |
| `/constraints` | `GET` | `200 OK` | Lists custom constraints |
| `/constraints` | `POST` | `201 Created` | Creates custom constraint |
| `/constraints/{constraint_id}` | `DELETE` | `204 No Content` | Deletes constraint |
| `/schedules` | `GET` | `200 OK` | Lists recent schedule runs |
| `/schedule/{schedule_id}` | `GET` | `200 OK` | Returns schedule run details |
| `/schedule/{schedule_id}/table` | `GET` | `200 OK` | Returns table rows for a view |
| `/schedule/{schedule_id}/views` | `GET` | `200 OK` | Returns all 5 views |
| `/analytics/schedule/{schedule_id}` | `GET` | `200 OK` | Returns analytics metrics |
| `/schedule/generate` | `POST` | `201 Created` | Works, but schedules each course as a single 1-hour slot instead of splitting `credit_hours` into weekly sessions |
| `/schedule/upload-csv` | `POST` | `201 Created` | Works, but does not accept Global Config (time window, lunch window, break_minutes, min_gap_minutes, rooms) |
| `/schedule/reschedule` | `POST` | `200 OK` | Reschedules around unseated slots |
| `/feedback/{schedule_id}` | `POST` | `201 Created` | Stores feedback |
| `/feedback/{schedule_id}` | `GET` | `200 OK` | Lists feedback for schedule |
| `/ml/model-stats` | `GET` | `200 OK` | Missing `version`, `n_samples`, `n_real_samples`, `n_synthetic_samples`, `cv_accuracy` (`mean`, `std`), `trained_at` |
| `/ml/retrain` | `POST` | `200 OK` | Triggers background retraining |
| `/ml/predict` | `POST` | `200 OK` | `predict_proba` was misused on satisfaction scores (1–5) instead of predicting `P(Morning)`, `P(Afternoon)`, `P(Evening)` summing to `1.0` |
| `/export/{schedule_id}` | `GET` | `200 OK` | Exports 7 formats, but XLSX only exported a single view sheet instead of one sheet per view + Metrics sheet |
| `/chat/start` | `POST` | `200 OK` | Starts chat session |
| `/chat/{conversation_id}/message` | `POST` | `200 OK` | Missing `"mode": "gemini"` / `"keyword_fallback"` field and does not reject invalid views/formats |
| `/chat/{conversation_id}/generate` | `POST` | `200 OK` | Does not validate/reject invalid views or formats |
| `/demo/run` | `POST` | **MISSING** | Required by Step 7 for 1-click deterministic FYP demo |

---

## 4. Detailed Findings: Working / Broken / Missing / Mislabeled (Before Fixes)

### Working
- FastAPI application boots cleanly with SQLite/PostgreSQL via SQLAlchemy.
- OR-Tools CP-SAT solver finds conflict-free assignments for single-slot courses.
- Basic CRUD for `/constraints`, `/feedback/{schedule_id}`, and `/schedules`.
- Formula injection and HTML XSS sanitization in `backend/utils/exporter.py`.

### Broken
1. **Single-Slot Assignment Instead of Credit-Hour Weekly Sessions (Step 1 & Step 2)**:
   - Previously, `TimetableSolver` assigned each course to a single 1-hour slot regardless of `credit_hours`. A 3-credit-hour course only received 1 contact hour per week instead of 3 contact hours split into sessions of at most 2 hours across different days (e.g., `2h + 1h`).
2. **ML Predictor Misuse of `predict_proba` (Step 4)**:
   - `FeatureEngineer` used `preferred_time` as an input feature and `satisfaction_score` (1–5) as the target label, and `PreferencePredictor` called `predict_proba` on 3 mutated feature vectors, producing arbitrary numbers that did **not** sum to `1.0`.
   - Required by Step 4: Features per teacher must be `[morning_ratio, afternoon_ratio, evening_ratio, avg_daily_hours, consecutive_classes, free_days]`, label must be preferred time band (`Morning` / `Afternoon` / `Evening`), evaluated with 5-fold cross-validation, and `predict_proba` must directly output `P(Morning) + P(Afternoon) + P(Evening) = 1.0`.
   - Furthermore, when `< 30` real labeled feedback rows exist, it must fall back to uniform preferences (`1/3, 1/3, 1/3`) and report `preference_source: "uniform_fallback"`.
3. **Infeasible Solver Error Lacks Human-Readable Diagnosis (Step 2)**:
   - When CP-SAT returned `INFEASIBLE`, `/schedule/generate` returned a generic string instead of explaining *why* (e.g., `"Teacher X needs 9 contact hours but only has 8 available hours"` or `"Total required session hours (42h) exceed available room-hours (30h)"`).
4. **Chatbot Does Not Validate/Reject Invalid Views or Formats & Lacks `mode` Indicator (Step 5)**:
   - `/chat/{id}/message` and `/chat/{id}/generate` did not return `"mode": "gemini"` vs `"mode": "keyword_fallback"`, did not call Gemini with `GEMINI_MODEL` when `GEMINI_API_KEY` is configured, and did not reject invalid view/format names with `400 Bad Request`.
5. **XLSX Export Only Included One View Sheet (Step 6)**:
   - Step 6 requires `XLSX` export to include one sheet per view (or the requested view + all 5 views) plus a `Metrics` sheet, and `PNG`/`JPG` text must wrap/truncate with ellipsis without overflowing cell boundaries.

### Missing
1. **Supervisor's 3-Column CSV + Global Config Window Support (Step 1)**:
   - Must accept `courses.csv` with `teacher_name, course_name, credit_hours` (plus optional `student_group, room_type`) and global config (`days`, `day_start=09:00`, `day_end=17:00`, `slot_minutes=60`, `lunch_start=12:00`, `lunch_end=14:00`, `break_minutes=15`, `min_gap_minutes=30`, `max_teaching_hours_per_day=6`, and 5 default rooms `Room 1`..`Room 5`).
2. **One-Click Deterministic Demo Endpoint & Files (Step 7)**:
   - Missing `data/demo_courses.csv` (6 teachers, 12 courses, mixed credit hours 2, 3, 4).
   - Missing `data/synthetic_feedback.csv` with `source="synthetic"`.
   - Missing `POST /demo/run` endpoint with fixed random seed.
   - Missing pre-generated backup outputs in `data/demo_output/`.
   - Missing `DEMO.md` (3-minute script + 10-question FYP defense Q&A) and `demo_backup.mp4`.

### Mislabeled / Hardcoded UI Claims (Step 8)
1. `frontend/components/MLStatus.tsx` had a hardcoded fallback `'86.5%'` and `'120'` samples instead of reading real values (`version`, `n_samples`, `n_real_samples`, `n_synthetic_samples`, `cv_accuracy`, `trained_at`) from `/ml/model-stats` and displaying `"SYNTHETIC TRAINING DATA"` when synthetic data is present.
2. `frontend/app/page.tsx` had hardcoded `'Online'` and `'9.9+'` fallbacks instead of displaying the real checks from `/health` (`database`, `ortools`, `ml_model_present`, `gemini_configured`, `redis`).

---

## 5. After-Fix Results

### Summary of Fixes Implemented (Steps 1 – 11)
1. **Step 1 (Supervisor Input Format & Credit-Hours Session Splitting)**:
   - Updated `backend/utils/csv_parser.py` and `backend/app/schemas/` to accept 3-column CSVs (`teacher_name, course_name, credit_hours`, optional `student_group, room_type`) and `GlobalScheduleConfig` (`days=Mon-Fri`, `day_start=09:00`, `day_end=17:00`, `slot_minutes=60`, `lunch_start=12:00`, `lunch_end=14:00`, `break_minutes=15`, `min_gap_minutes=30`, `max_teaching_hours_per_day=6`, default rooms `Room 1..Room 5`).
   - Implemented `split_credit_hours_into_sessions` so each course's weekly contact hours equal its `credit_hours`, split into sessions of at most 2 hours placed on different days (`3 CH -> 2h + 1h`, `4 CH -> 2h + 2h`).
2. **Step 2 (CP-SAT Hard & Soft Constraints + Infeasibility Diagnostics)**:
   - Updated `backend/app/services/solver.py` to enforce `AddNoOverlap` on teacher, room, and student-group interval variables, protect lunch (`12:00–14:00`), enforce `min_gap_minutes` / `break_minutes`, enforce `max_teaching_hours_per_day`, and return `OPTIMAL`, `FEASIBLE`, or `INFEASIBLE` with `solve_time_ms`, `objective_value`, and human-readable `diagnose_infeasibility()` explanations.
   - Added independent plain-Python schedule verifier `verify_solved_timetable` in `backend/solver/validator.py`.
3. **Step 3 (5 Pure-Function Output Views)**:
   - Updated `backend/utils/timetable_formatter.py` so `master`, `teacher`, `student`, `staff`, and `canteen` views are pure functions of a single solved schedule, each including `title`, `generated_at`, `schedule_id`, per-teacher tables, per-student-group tables with explicit break rows, support staff `Busy/Moderate/Quiet` room activity labels, and canteen diner counts labeled `(Estimate)`.
4. **Step 4 (Machine Learning Preference Model)**:
   - Updated `backend/ml/feature_engineer.py`, `backend/ml/preference_learner.py`, `backend/ml/predictor.py`, and `backend/app/routers/ml.py` to use the 6 teacher features (`morning_ratio, afternoon_ratio, evening_ratio, avg_daily_hours, consecutive_classes, free_days`), `RandomForestClassifier(random_state=42)` with 5-fold Stratified CV (`mean`, `std`), direct `predict_proba` summing to `1.0`, `< 30` rows fallback to `uniform_fallback`, and `data/synthetic_feedback.csv` tagged `source="synthetic"` with `"SYNTHETIC TRAINING DATA"` labeling.
5. **Step 5 (Chatbot)**:
   - Updated `backend/app/routers/chat.py` and `frontend/components/ChatBot.tsx` to extract `{views, formats, view_filters}` via Gemini (`GEMINI_MODEL`) when `GEMINI_API_KEY` is configured or fall back to deterministic keyword parsing (`"mode": "keyword_fallback"`), ask clarifying questions when ambiguous, and reject invalid views/formats with HTTP `400`.
6. **Step 6 (7-Format Export)**:
   - Updated `backend/utils/exporter.py` and `backend/app/routers/export.py` so `CSV`, `XLSX` (one sheet per view + `Metrics` sheet), `PDF` (landscape with title, schedule ID, and timestamp), `PNG`, `JPG` (wrapped text with ellipsis truncation, no overflow), `JSON`, and `HTML` honor and validate the `view` query parameter.
7. **Step 7 & 8 (Demo Mode & Honest Health/Status)**:
   - Added `data/demo_courses.csv`, `POST /demo/run` (fixed `random_seed=42`, solves in ~1.4s), and pre-generated all 35 backup files (`5 views × 7 formats`) in `data/demo_output/`.
   - Updated `/health`, `frontend/components/MLStatus.tsx`, and `frontend/app/page.tsx` to display real health and ML metrics with zero hardcoded `"Online"` or `"86.5%"` strings.

### Final `pytest -v` Output (30 / 30 Passed)
```text
============================= test session starts =============================
platform win32 -- Python 3.13.15, pytest-9.1.1, pluggy-1.6.0 -- D:\My Softwares\Time Table Generator\backend\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: D:\My Softwares\Time Table Generator\backend
plugins: anyio-4.15.1, asyncio-1.4.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 30 items

tests/test_api.py::test_health_endpoint PASSED                           [  3%]
tests/test_api.py::test_constraint_crud PASSED                           [  6%]
tests/test_api.py::test_schedule_generation_views_exports_feedback_and_chat PASSED [ 10%]
tests/test_api.py::test_csv_upload_endpoint PASSED                       [ 13%]
tests/test_api.py::test_reschedule_scoping_and_unseated_slot_exclusion PASSED [ 16%]
tests/test_api.py::test_exporter_xss_and_formula_injection_sanitization PASSED [ 20%]
tests/test_api.py::test_chatbot_keyword_fallback_and_invalid_rejection PASSED [ 23%]
tests/test_api.py::test_all_7_exports_size_and_content_validation PASSED [ 26%]
tests/test_api.py::test_end_to_end_demo_courses_workflow PASSED          [ 30%]
tests/test_constraints.py::test_validator_detects_empty_inputs PASSED    [ 33%]
tests/test_constraints.py::test_validator_detects_duplicate_emails PASSED [ 36%]
tests/test_constraints.py::test_validator_detects_course_capacity_exceeding_all_venues PASSED [ 40%]
tests/test_constraints.py::test_validator_detects_invalid_slot_time_order PASSED [ 43%]
tests/test_ml.py::test_feature_engineering PASSED                        [ 46%]
tests/test_ml.py::test_model_training PASSED                             [ 50%]
tests/test_ml.py::test_preference_prediction PASSED                      [ 53%]
tests/test_ml.py::test_ml_fewer_than_30_rows_returns_uniform_fallback PASSED [ 56%]
tests/test_performance.py::test_performance_benchmark_50_faculty_100_courses PASSED [ 60%]
tests/test_performance.py::test_performance_scale_up PASSED              [ 63%]
tests/test_solver.py::test_no_conflicts PASSED                           [ 66%]
tests/test_solver.py::test_preference_respect PASSED                     [ 70%]
tests/test_solver.py::test_fairness PASSED                               [ 73%]
tests/test_solver.py::test_performance PASSED                            [ 76%]
tests/test_solver.py::test_solver_small_problem PASSED                   [ 80%]
tests/test_solver.py::test_solver_medium_problem PASSED                  [ 83%]
tests/test_solver.py::test_solver_infeasible_problem PASSED              [ 86%]
tests/test_solver.py::test_custom_hard_constraint_enforced PASSED        [ 90%]
tests/test_solver.py::test_formatter_preserves_non_standard_slots PASSED [ 93%]
tests/test_solver.py::test_demo_dataset_solves_under_5s_and_passes_independent_checker PASSED [ 96%]
tests/test_solver.py::test_impossible_50h_teacher_returns_infeasible_with_reason PASSED [100%]

================== 30 passed, 1 warning in 66.84s (0:01:06) ===================
```

