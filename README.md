# Intelligent Timetable Generation Engine (OR-Tools CP-SAT + Random Forest ML)

This repository contains a university timetable generation engine built with **FastAPI**, **Google OR-Tools CP-SAT**, **scikit-learn (`RandomForestClassifier`)**, and **Next.js**. Given a course list CSV (`teacher_name, course_name, credit_hours`) and a schedule window configuration, the solver splits multi-credit courses into weekly contact sessions of at most 2 hours across distinct days, enforces hard conflict and lunch-break constraints using CP-SAT interval variables (`AddNoOverlap`), applies soft teacher time-of-day preferences learned from feedback, projects the solved schedule into 5 audience-specific views, and exports them in 7 file formats.

---

## 1. Quick Start (Tested from Clean Virtualenv)

### One-Command Startup (Windows PowerShell)
```powershell
.\start_demo.ps1
```
Or with Docker Compose:
```bash
docker-compose up --build
```

### Manual Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Swagger API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

### Manual Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
- Web UI: `http://localhost:3000`

### Running the Automated Test Suite
```powershell
cd backend
.\.venv\Scripts\pytest -v
```

---

## 2. Input CSV Format & Credit-Hours Mapping

### Required Columns
`courses.csv` requires only 3 columns (`student_group` and `room_type` are optional):
- `teacher_name` (required)
- `course_name` (required)
- `credit_hours` (required, integer `1..6`)
- `student_group` (optional; if omitted, defaults to one distinct group per course so sessions of the same course or section never overlap)
- `room_type` (optional; e.g., `Lecture` or `Lab`)

### 5-Row Example (`data/demo_courses.csv`)
```csv
teacher_name,course_name,credit_hours,student_group,room_type
Dr. Sarah Ahmed,Artificial Intelligence,3,BS-AI-4A,Lecture
Dr. Sarah Ahmed,Deep Learning,3,BS-AI-6A,Lab
Prof. Kamran Siddiqui,Operating Systems,4,BS-CS-4A,Lecture
Prof. Kamran Siddiqui,Computer Networks,3,BS-CS-6A,Lecture
Dr. Ayesha Tariq,Database Systems,4,BS-SE-4A,Lecture
```

### Credit-Hours Mapping Assumption
- **1 credit hour = 1 weekly contact hour.**
- A course's weekly contact hours equal its `credit_hours`.
- Multi-hour courses are automatically split into sessions of **at most 2 consecutive hours**, placed on **different days** of the week where possible:
  - `2 credit hours` $\rightarrow$ one `2h` session (`[2]`)
  - `3 credit hours` $\rightarrow$ two sessions: `2h + 1h` on different days (`[2, 1]`)
  - `4 credit hours` $\rightarrow$ two sessions: `2h + 2h` on different days (`[2, 2]`)

### Global Schedule Window Config (with Defaults)
| Parameter | Default | Description |
| :--- | :--- | :--- |
| `days` | `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]` | Active teaching days |
| `day_start` / `day_end` | `"09:00"` / `"17:00"` | Daily schedule window |
| `slot_minutes` | `60` | Base slot duration in minutes |
| `lunch_start` / `lunch_end` | `"12:00"` / `"14:00"` | Protected lunch window (no classes scheduled) |
| `break_minutes` | `15` | Required break after a 2-hour consecutive teaching block |
| `min_gap_minutes` | `30` | Minimum gap between a teacher's sessions on the same day |
| `max_teaching_hours_per_day` | `6` | Maximum daily contact hours per teacher |
| `rooms` | `["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"]` | Default room pool (overridable) |

---

## 3. Hard and Soft Constraints (OR-Tools CP-SAT)

| Constraint | Type | Implementation in `TimetableSolver` |
| :--- | :--- | :--- |
| **Exact Weekly Contact Hours** | **Hard** | Each course is expanded into sessions summing to `credit_hours`; every session must be assigned a valid placement. |
| **Multi-Session Day Spread** | **Hard** | `model.AddAllDifferent([day_vars[k] for k in course_sessions])` places sessions of the same course on distinct days. |
| **No Teacher Overlap + Min Gap** | **Hard** | `model.AddNoOverlap(teacher_intervals)` with session duration padded by `max(min_gap_minutes, break_minutes)`. |
| **No Room Overlap** | **Hard** | `model.AddNoOverlap(room_intervals)` using optional interval variables per room (`NewOptionalIntervalVar`). |
| **No Student Group Overlap** | **Hard** | `model.AddNoOverlap(group_intervals)` per `student_group`. |
| **Lunch Window Protection** | **Hard** | Slots overlapping `lunch_start..lunch_end` (`12:00-14:00`) are excluded from valid session placements. |
| **Schedule Window Bounds** | **Hard** | All sessions lie strictly within `day_start` (`09:00`) to `day_end` (`17:00`). |
| **Max Daily Teaching Hours** | **Hard** | Linear sum of a teacher's daily session hours $\le$ `max_teaching_hours_per_day` (`6h`). |
| **Teacher Time-of-Day Preference** | **Soft** | Weighted objective bonus for placing sessions in a teacher's preferred band (`Morning`, `Afternoon`, `Evening`). |
| **Minimal Reschedule Disruption** | **Soft** | When rescheduling (`/schedule/reschedule`), rewards keeping unaffected sessions in their prior slots. |

When a dataset is `INFEASIBLE` (e.g., 1 teacher assigned 50 credit hours in a 40-hour week), the solver returns HTTP `422` with `status: "INFEASIBLE"` and a human-readable diagnostic explanation (`"Teacher Dr. Overloaded needs 50 contact hours but only has 30 free hours available."`).

---

## 4. Five Pure-Function Audience Views

All 5 views are pure functions of a single solved schedule (`GET /schedule/{id}/views`) and include `title`, `generated_at`, and `schedule_id`:
1. **Master View (`master`)**: Complete university grid across days, time slots, rooms, teachers, courses, and student groups, with `12:00 - 14:00 (LUNCH BREAK)` explicitly marked.
2. **Teacher View (`teacher`)**: Per-teacher schedule tables (`teacher_tables`) listing assigned courses, days, start/end times, rooms, `total_hours`, and `days_taught`.
3. **Student View (`student`)**: Per-group schedule tables (`student_group_tables`) with class sessions and explicit `Break / Free Period` and `LUNCH BREAK (Protected Window)` rows.
4. **Support Staff View (`staff`)**: Per-day, per-hour active room counts, total rooms, utilization percentage, and activity labels (`Busy` $\ge 70\%$, `Moderate` $30\text{--}69\%$, `Quiet` $< 30\%$) for maintenance and security planning.
5. **Canteen View (`canteen`)**: Per-day, per-hour estimated diner counts (`(Estimate)`), clearly labeled as an occupancy heuristic (70% of students during `12:00-14:00` lunch window; 35% of students finishing class in adjacent transition hours).

---

## 5. Machine Learning Preference Learner (`RandomForestClassifier`)

- **6 Input Features per Teacher** (`backend/ml/feature_engineer.py`):
  1. `morning_ratio` (proportion of classes before 12:00)
  2. `afternoon_ratio` (proportion of classes 12:00–16:00)
  3. `evening_ratio` (proportion of classes after 16:00)
  4. `avg_daily_hours` (average teaching hours per active day)
  5. `consecutive_classes` (maximum consecutive teaching hours)
  6. `free_days` (number of teaching-free days per week)
- **Target Label**: Preferred time band (`Morning` = 0, `Afternoon` = 1, `Evening` = 2) derived from feedback rows where `rating >= 4`.
- **Training & Evaluation** (`backend/ml/preference_learner.py`):
  - Uses `RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)` and reports 5-fold Stratified Cross-Validation accuracy (`mean` and `std`) via `GET /ml/model-stats`.
  - Uses `model.predict_proba()` directly (`backend/ml/predictor.py`) so `P(Morning) + P(Afternoon) + P(Evening) = 1.0`.
- **Minimum Data Rule & Synthetic Data Transparency**:
  - If fewer than **30 labeled rows** are available, the predictor falls back to uniform preferences (`1/3, 1/3, 1/3`) and reports `preference_source: "uniform_fallback"`.
  - For cold-start demo runs, `data/synthetic_feedback.csv` (120 rows tagged `source="synthetic"`) is used and clearly labeled **`SYNTHETIC TRAINING DATA`** in `/ml/model-stats` and the UI badge.

---

## 6. Conversational AI Chatbot (Gemini + Keyword Fallback)

- **Endpoint**: `POST /chat/message` and `POST /chat/generate-schedules`
- **Dual-Mode Operation**:
  - When `GEMINI_API_KEY` is set in `.env` (using `GEMINI_MODEL`, default `gemini-2.5-flash`), the assistant uses Gemini structured JSON extraction to parse `{views, formats, view_filters}` and returns `"mode": "gemini"`.
  - When `GEMINI_API_KEY` is not set or the API is unreachable, it automatically uses a deterministic regex/keyword parser and returns `"mode": "keyword_fallback"`.
  - Ambiguous requests return `status: "clarification_needed"` with a clarifying question; unrecognized views or formats are rejected with HTTP `400`.

---

## 7. Multi-Format Export (7 Formats)

`GET /export/{schedule_id}?format=<fmt>&view=<view>` supports all 5 views and 7 formats:
- `csv` — UTF-8 CSV with schedule metadata header and formula-injection sanitization
- `xlsx` — Multi-sheet Excel workbook (`Master`, `Teacher`, `Student`, `Staff`, `Canteen`, plus a `Metrics` sheet)
- `pdf` — Landscape A4 printable timetable via ReportLab with title, schedule ID, and timestamp
- `png` / `jpg` — High-contrast Pillow timetable image with cell text wrapping and ellipsis (`...`) truncation
- `json` — Structured JSON containing metadata, tabular rows, and raw entries
- `html` — Standalone printable HTML table with XSS-escaped cells

---

## 8. Known Limitations

1. **Single-Slot Granularity**: The CP-SAT model schedules on a configurable base slot grid (`slot_minutes=60` default) and splits courses into 1h and 2h blocks; arbitrary 45-minute or 75-minute overlapping bell schedules are not modeled in the same run.
2. **Cold-Start Synthetic ML Data**: Until at least 30 real teacher feedback ratings (`rating >= 4`) are submitted via `POST /feedback/{schedule_id}`, the Random Forest model either trains on `data/synthetic_feedback.csv` (labeled `SYNTHETIC TRAINING DATA`) or falls back to uniform weights (`uniform_fallback`).
3. **Canteen Demand Heuristic**: The Canteen View diner numbers are deterministic estimates computed from scheduled student group sizes (`capacity_required`), not historical POS transaction logs.
4. **SQLite Default Storage**: Local runs default to `sqlite:///./timetable.db` so the project runs out-of-the-box without requiring a PostgreSQL server or Redis broker.
