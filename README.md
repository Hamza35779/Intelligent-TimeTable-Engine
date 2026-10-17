# University Timetable Generator

A constraint-based timetable optimization engine for universities, powered by **Google OR-Tools CP-SAT** solver with a **Random Forest ML** preference learner.

## What It Does

Upload a CSV of teachers and courses → the solver generates a conflict-free, fair schedule in under 5 seconds → view it as a university-style timetable sheet → export as CSV, XLSX, PDF, JSON, or HTML.

## Quick Start (Local Development)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### Docker (Both Services)

```bash
docker compose up --build
```

## How To Use

1. **Go to /build** — the Easy Builder page
2. **Add teachers** by typing names
3. **Add courses** with credit hours, assigned teacher, and type (lecture/lab)
4. **Click Generate** — OR-Tools CP-SAT finds the optimal schedule
5. **View the result** — university-style 9-slot timetable sheet with course legend
6. **Switch views** — Master, Teacher, Student perspectives
7. **Export** — CSV, XLSX, PDF, JSON, HTML

Or just **upload a CSV** with columns: `teacher_name, course_name, credit_hours`

## CSV Format

```csv
teacher_name,course_name,credit_hours
Dr. Sarah Ahmed,Artificial Intelligence,3
Dr. Sarah Ahmed,Deep Learning,3
Prof. Kamran Siddiqui,Operating Systems,4
Dr. Ayesha Tariq,Database Systems,4
```

Optional columns: `course_code`, `student_group`, `room_type`

## Architecture

- **Backend**: Python, FastAPI, SQLAlchemy (SQLite), Google OR-Tools CP-SAT
- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **ML**: scikit-learn RandomForest for teacher preference learning
- **Solver**: CP-SAT with hard constraints (no conflicts, lunch protection, max daily hours) and soft constraints (fairness, preferences)

## Credit Hours Mapping

- Each credit hour = 1 contact hour per week
- Sessions split into max 2-hour blocks on different days
- Example: 3-credit course → 2h session + 1h session on separate days

## Constraints

**Hard (never violated):**
- No teacher teaches two classes at once
- No room double-booked
- No student group overlap
- Lunch break protected (12:00–14:00)
- Max 6 teaching hours per teacher per day

**Soft (optimized):**
- Fair workload distribution across days
- Teacher time-of-day preferences (from ML model)
- Minimize idle gaps

## Tests

```bash
cd backend
pytest -v
```

31 tests covering solver correctness, API endpoints, ML pipeline, exports, and performance.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Solver | Google OR-Tools CP-SAT |
| Backend | Python 3.11+, FastAPI, SQLAlchemy |
| Database | SQLite (default), PostgreSQL (via DATABASE_URL) |
| ML | scikit-learn RandomForest |
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Export | CSV, XLSX (openpyxl), PDF (reportlab), JSON, HTML |
