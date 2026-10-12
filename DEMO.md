# FYP Evaluation Demo Script & Supervisor Q&A (`DEMO.md`)

## 1. One-Command Demo Launch

### Option A: Local PowerShell Script (Recommended for Fast Live Demo)
```powershell
.\start_demo.ps1
```
This starts:
- FastAPI Backend on `http://127.0.0.1:8000` (Swagger UI at `http://127.0.0.1:8000/docs`)
- Next.js Frontend on `http://localhost:3000`

### Option B: Docker Compose
```bash
docker-compose up --build
```

### Zero-Risk Offline Backup
If the presentation laptop experiences port conflicts or lag during the viva:
1. Open **`demo_backup.mp4`** in the repository root for a pre-rendered walkthrough of the solved schedule and all 5 views.
2. Open **`data/demo_output/`**, which contains all **35 pre-generated files** (`5 views × 7 formats`: `.csv`, `.xlsx`, `.pdf`, `.png`, `.jpg`, `.json`, `.html`) produced with fixed `random_seed=42`.

---

## 2. Three-Minute Timed Live Demo Script

### `0:00 – 0:30` | Problem Statement & Supervisor Input Format
- **Action**: Open `data/demo_courses.csv` alongside `http://localhost:3000`.
- **Talking Points**:
  - *"Our engine accepts the exact 3-column CSV specified in the brief: `teacher_name`, `course_name`, and `credit_hours` (with optional `student_group` and `room_type`)."*
  - *"Our demo dataset has 6 teachers and 12 courses with mixed credit hours (2, 3, and 4 CH), totaling 35 weekly contact hours."*
  - *"Each credit hour maps to 1 contact hour per week and is automatically split into sessions of at most 2 hours placed on different days (for example, a 3-credit course becomes a 2h session and a 1h session on separate days)."*

### `0:30 – 1:15` | Upload & CP-SAT Constraint Solving
- **Action**: Click **"Run Demo (12 Courses, Seed 42)"** (or upload `data/demo_courses.csv`).
- **Talking Points**:
  - *"Google OR-Tools CP-SAT solves the 35 contact hours across 5 rooms (`Room 1` to `Room 5`) and Monday–Friday (`09:00–17:00`) in ~1.4 seconds, returning `OPTIMAL` status, solve time in milliseconds, and the objective value."*
  - *"Hard constraints are modeled using CP-SAT interval variables (`AddNoOverlap`): zero teacher overlaps, zero room overlaps, zero student-group overlaps, a protected `12:00–14:00` lunch window with zero classes, a 30-minute minimum gap between a teacher's sessions on the same day, and a 6-hour daily teaching cap."*
  - *"If we pass an impossible dataset—such as 1 teacher assigned 50 credit hours in a 40-hour week—the solver returns `INFEASIBLE` with the exact diagnostic explanation (`Teacher Dr. Overloaded needs 50 contact hours but only has 30 free hours available`)."*

### `1:15 – 2:00` | Inspecting the 5 Audience Views
- **Action**: Switch through the 5 view tabs (`Master`, `Teacher`, `Student`, `Support Staff`, `Canteen`) on `/schedule/{id}`.
- **Talking Points**:
  - *"All 5 views are pure functions of the single solved schedule—the solver never re-runs when switching views:"*
    1. **Master View**: Complete university timetable across all days, time slots, rooms, teachers, courses, and student groups.
    2. **Teacher View**: Per-teacher schedule tables showing assigned sessions, total weekly hours, and days taught.
    3. **Student View**: Per-group tables (`BS-AI-4A`, `BS-CS-4A`, etc.) with explicit `Break / Free Period` and `12:00–14:00 LUNCH BREAK` rows.
    4. **Support Staff View**: Per-day, per-hour active room counts (`active_rooms / total_rooms`) and `Busy / Moderate / Quiet` activity labels for maintenance and security teams.
    5. **Canteen View**: Per-day, per-hour estimated diner counts clearly labeled `(Estimate)` based on scheduled student group occupancy during the `12:00–14:00` lunch rush and adjacent transition hours.

### `2:00 – 2:30` | Conversational Chatbot & 7-Format Export
- **Action**: In the AI Schedule Assistant panel, click or type: `"Give me teacher and student schedules in PDF and Excel"`, then click **Generate Requested Views & Formats** and download `PDF`, `XLSX`, and `PNG`.
- **Talking Points**:
  - *"The chatbot extracts structured JSON `{views, formats, view_filters}` using Gemini (`GEMINI_MODEL`) when `GEMINI_API_KEY` is configured, and automatically falls back to a deterministic keyword parser (`mode: keyword_fallback`) when offline."*
  - *"Notice the badge explicitly displays `mode: keyword_fallback` (or `mode: gemini`). If a user asks for an unsupported view or format, it rejects the request with HTTP 400."*
  - *"Every view exports cleanly to all 7 formats: `CSV`, `XLSX` (multi-sheet with a `Metrics` tab), landscape `PDF`, wrapped `PNG`/`JPG` images, `JSON`, and `HTML`."*

### `2:30 – 3:00` | Teacher Feedback, ML Retraining & Honest Health Panel
- **Action**: Submit a 5-star feedback rating for `Dr. Sarah Ahmed` (`Morning`), click **Retrain Model** in the ML panel, and point to the **Live System Health (`/health`)** card.
- **Talking Points**:
  - *"Submitting feedback triggers `RandomForestClassifier(random_state=42)` retraining on 6 teacher features (`morning_ratio, afternoon_ratio, evening_ratio, avg_daily_hours, consecutive_classes, free_days`)."*
  - *"The ML card reports real 5-fold cross-validation accuracy (`94.2% ± 6.2%`), sample counts (`Real / Synthetic`), and displays the `SYNTHETIC TRAINING DATA` badge whenever fewer than 30 real feedback rows exist."*
  - *"The `/health` panel reports live checks for SQLite/PostgreSQL, OR-Tools version, ML model file presence, Gemini key status, and Redis status—with zero hardcoded numbers."*

---

## 3. Ten Likely Supervisor Questions & Honest Answers

1. **Q: How do you map course credit hours to timetable slots?**
   - **A:** We assume `1 credit hour = 1 weekly contact hour`. Multi-credit courses are split into sessions of at most 2 consecutive hours placed on distinct days (`3 CH -> 2h + 1h`, `4 CH -> 2h + 2h`). We enforce distinct days using `model.AddAllDifferent` on each course's session day variables.

2. **Q: Why did you use Google OR-Tools CP-SAT instead of a genetic algorithm or greedy heuristic?**
   - **A:** CP-SAT provides exact constraint propagation (`AddNoOverlap` on interval variables, `AddAllowedAssignments`, and `AddAllDifferent`) and proves either optimality (`OPTIMAL`), feasibility (`FEASIBLE`), or mathematical infeasibility (`INFEASIBLE`) within 1.4 seconds on our 12-course dataset.

3. **Q: How do you guarantee that no teacher, room, or student group is ever double-booked?**
   - **A:** Every session is modeled as a CP-SAT `IntervalVar` (or `OptionalIntervalVar` per room), and we call `model.AddNoOverlap` for each teacher, each room, and each student group. We also verify every solution with an independent plain-Python checker (`verify_solved_timetable` in `backend/solver/validator.py`) in our test suite.

4. **Q: How are the 15-minute break after 2 consecutive hours and the 30-minute minimum gap enforced?**
   - **A:** In `TimetableSolver`, each teacher's session interval duration is padded by `max(min_gap_minutes, break_minutes)` before passing the teacher's intervals to `AddNoOverlap`. This prevents a teacher from being assigned back-to-back sessions on the same day without a gap.

5. **Q: What happens if the input CSV is impossible to schedule?**
   - **A:** CP-SAT proves `INFEASIBLE`, and our diagnostic analyzer (`diagnose_infeasibility()`) inspects room capacities, total room-hours, per-teacher available free hours, and student group hours to return a specific human-readable message (e.g., *"Teacher Dr. Overloaded needs 50 contact hours but only has 30 free hours available"*).

6. **Q: Is the Random Forest model trained on real university data?**
   - **A:** For the cold-start demo, it is trained on 120 rows in `data/synthetic_feedback.csv` tagged `source="synthetic"`, and the UI explicitly labels it **`SYNTHETIC TRAINING DATA`**. If fewer than 30 total rows are provided without synthetic augmentation, the predictor falls back to uniform probabilities (`1/3, 1/3, 1/3`, `preference_source="uniform_fallback"`).

7. **Q: How does the ML model output probabilities, and how do those affect the solver?**
   - **A:** `RandomForestClassifier.predict_proba` outputs normalized probabilities for `Morning`, `Afternoon`, and `Evening` that sum to `1.0`. These probabilities are scaled into small integer soft-constraint weights (`5..20`) in the CP-SAT objective function so they guide slot selection without ever overriding hard constraints.

8. **Q: Does the AI Chatbot generate the schedule using an LLM?**
   - **A:** No. All scheduling is performed strictly by OR-Tools CP-SAT. The chatbot only extracts structured intent (`views`, `formats`, `view_filters`) from natural language using Gemini when `GEMINI_API_KEY` is set, or our deterministic keyword parser (`mode: "keyword_fallback"`) when offline.

9. **Q: Are the Canteen View diner numbers real measurements?**
   - **A:** No, and they are explicitly labeled `(Estimate)` in both the UI and exports. They are deterministic estimates computed from the scheduled student groups' sizes (`70%` expected during the `12:00–14:00` protected lunch window and `35%` during adjacent transition hours).

10. **Q: What are the main limitations of the current prototype?**
    - **A:** First, time slots use a uniform base grid (60 minutes default) rather than arbitrary mixed bell schedules. Second, the ML model starts with synthetic bootstrap data until 30+ real faculty ratings are collected. Third, Canteen and Support Staff views use occupancy heuristics rather than live IoT/POS sensor feeds.
