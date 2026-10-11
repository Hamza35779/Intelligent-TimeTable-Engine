# Intelligent Autonomous Timetable Engine v2.0

A production-ready, conversational university timetable optimization engine combining **Google OR-Tools CP-SAT**, **Machine Learning Preference Prediction (`scikit-learn`)**, **Conversational AI**, **5-Audience Multi-View Generation**, and **7-Format Simultaneous Export**.

---

## Core Capabilities

1. **OR-Tools CP-SAT Constraint Solver (`<5s` SLA)**
   - Enforces zero room, teacher, and student group double-booking (`AddAllDifferent` + domain reduction).
   - Protects mandatory lunch breaks (`12:00 - 14:00` / `BREAK` slots).
   - Multi-objective optimization balancing workload fairness (`0-100`) and ML-predicted teacher time-of-day preferences.
   - Real-time delta rescheduling around unexpected room/slot outages.

2. **Machine Learning Teacher Preference Learner (`scikit-learn`)**
   - Extracts 6 behavioral features per teacher (`morning_ratio`, `afternoon_ratio`, `evening_ratio`, `avg_daily_hours`, `consecutive_classes`, `free_days`).
   - Trains a `RandomForestClassifier` with `StandardScaler` on teacher feedback ratings (`1-5` stars + preferred time slots).
   - Automatically triggers background model retraining via Celery / FastAPI tasks once feedback thresholds are reached.

3. **Conversational AI Scheduling Assistant**
   - Understands natural language requests such as:
     > *"Create schedules for teachers, students, and canteen staff, and export as PDF and Excel"*
   - Extracts target audience views (`master`, `teacher`, `student`, `staff`, `canteen`), time preferences, lunch protections, and export formats, then generates one-click download links for every combination.

4. **5-Audience Multi-View Output**
   - **Master University View**: Complete room, faculty, course, and slot matrix.
   - **Teacher Schedule View**: Individualized teaching rosters, daily hours, and assigned rooms.
   - **Student Schedule View**: Chronological class schedule with automatic lunch break blocks.
   - **Support Staff View**: Hourly active room counts, busy/moderate/quiet status, and maintenance windows.
   - **Canteen Staff View**: Expected student & staff dining volume, rush windows, and prep alerts.

5. **Simultaneous 7-Format Export**
   - Export any audience view as **CSV**, **Excel (`.xlsx`)**, **PDF**, **PNG**, **JPG**, **JSON**, or **HTML**.

---

## Tech Stack

- **Backend**: Python 3.9+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Constraint Solver**: Google OR-Tools (`ortools` CP-SAT)
- **Machine Learning**: `scikit-learn` (Random Forest), `pandas`, `numpy`, `joblib`
- **Exporters**: `openpyxl` (Excel), `reportlab` (PDF), `Pillow` (PNG/JPG)
- **Async / Queue**: Celery, Redis
- **Frontend**: Next.js 14, React 18, TailwindCSS, Lucide Icons

---

## Quick Start

### 1. Docker Compose (Full Stack + Postgres + Redis + Celery)

```bash
docker-compose up --build
```

- **Frontend UI**: `http://localhost:3000`
- **FastAPI Backend**: `http://localhost:8000`
- **Swagger OpenAPI Docs**: `http://localhost:8000/docs`

### 2. Local Development

#### Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Run Tests (20 Unit, ML, Solver & API Tests)
```bash
cd backend
.\.venv\Scripts\pytest -v
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/schedule/generate` | Run CP-SAT + ML preference solver on JSON payload |
| `POST` | `/schedule/upload-csv` | Upload CSV dataset and generate optimal schedule |
| `GET`  | `/schedule/{id}/table` | Get clean tabular rows for a generated schedule |
| `GET`  | `/schedule/{id}/views` | Get all 5 tailored audience views (`master`, `teacher`, `student`, `staff`, `canteen`) |
| `POST` | `/feedback/{schedule_id}` | Submit 1-5 star teacher feedback & trigger ML check |
| `GET`  | `/ml/model-stats` | View Random Forest accuracy, feature importances & sample count |
| `POST` | `/ml/retrain` | Trigger ML model retraining on accumulated teacher feedback |
| `GET`  | `/export/{schedule_id}?format=pdf&view=canteen` | Export any view in `csv`, `xlsx`, `pdf`, `png`, `jpg`, `json`, or `html` |
| `POST` | `/chat/start` | Start conversational AI scheduling session |
| `POST` | `/chat/{id}/message` | Send natural language request & receive multi-view/multi-format exports |
