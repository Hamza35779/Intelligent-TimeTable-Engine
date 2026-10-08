# Intelligent Autonomous Timetable Generation Engine

A production-grade, constraint-based university timetable optimization engine that autonomously generates conflict-free schedules in **< 5 seconds** using **Google OR-Tools CP-SAT**.

---

## Architecture & Tech Stack

```
                          ┌───────────────────────────┐
                          │   Next.js 14 Dashboard    │
                          │   (React / TailwindCSS)   │
                          └─────────────┬─────────────┘
                                        │ REST / JSON
                                        ▼
                          ┌───────────────────────────┐
                          │      FastAPI Gateway      │
                          │   (Pydantic Validation)   │
                          └──────┬─────────────┬──────┘
                                 │             │
                    ┌────────────▼──┐       ┌──▼────────────┐
                    │  CP-SAT Model │       │  PostgreSQL   │
                    │   (OR-Tools)  │       │ (SQLAlchemy)  │
                    └───────────────┘       └───────────────┘
```

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2
- **Constraint Solver:** Google OR-Tools CP-SAT (Constraint Programming - Satisfiability)
- **Database:** PostgreSQL (with SQLite zero-config automatic local fallback)
- **Frontend:** Next.js 14, React 18, TailwindCSS, Lucide Icons
- **Deployment:** Docker, Docker Compose
- **Async & Caching:** Redis

---

## Key Features

1. **<5s Solver Performance:** Solves 50 faculty, 20 venues, 100 courses in milliseconds with guaranteed mathematical optimality.
2. **Strict Hard Constraints (Zero Violations):**
   - No faculty double-booking across any slot.
   - No venue double-booking.
   - Respect room capacity ($VenueCapacity \ge CourseCapacityRequired$).
   - Respect faculty unavailability & maximum daily teaching hours limit.
   - Respect venue operational hours.
3. **Multi-Objective Soft Optimization:**
   - Honors faculty preferences (morning vs. afternoon slots, preferred days).
   - Minimizes auditorium seat waste (tightest room capacity fit).
   - Equalizes faculty teaching workload distribution.
4. **Real-Time Delta Rescheduling:**
   - Minimizes disruption during campus emergencies (room maintenance, faculty sickness).
   - Preserves unaffected lecture slots while autonomously rerouting conflicted sessions.
5. **Interactive Next.js Dashboard:**
   - Interactive timetable grid color-coded by faculty.
   - Day-of-week and faculty filters.
   - One-click CSV and Print export.
   - Real-time optimization analytics (workload distribution, room utilization, SLA indicators).

---

## Quickstart Guide

### Option 1: Run with Docker Compose (Recommended)

```bash
# Clone and enter the repository
git clone <repo_url>
cd "Time Table Generator"

# Start database, redis, backend, and frontend
docker-compose up --build
```

- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

### Option 2: Local Development Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns solver status, engine version, and uptime |
| `POST` | `/schedule/generate` | Autonomous timetable generation (<5s) |
| `POST` | `/schedule/reschedule` | Delta reschedule around sudden conflicts |
| `GET` | `/schedule/{id}` | Full timetable details, assignments & metrics |
| `GET` | `/analytics/schedule/{id}` | Workload distribution & room utilization |
| `POST` | `/constraints` | Create custom hard/soft constraint |
| `GET` | `/constraints` | List all registered constraints |
| `DELETE` | `/constraints/{id}` | Delete a constraint |

Interactive Swagger documentation is available at `/docs`.

---

## Mathematical Constraint Formulation

The problem is formulated as a binary integer program:

Let:
- $C$ = set of courses
- $V$ = set of venues
- $S$ = set of time slots
- $F$ = set of faculty members
- $x_{c, v, s} \in \{0, 1\}$ = 1 if course $c$ is assigned to venue $v$ at slot $s$, 0 otherwise.

### Hard Constraints:
1. **Course Assignment:** Each course is assigned exactly once:
   $$\sum_{v \in V} \sum_{s \in S} x_{c, v, s} = 1 \quad \forall c \in C$$

2. **Venue Conflict:** At most one course per venue and slot:
   $$\sum_{c \in C} x_{c, v, s} \le 1 \quad \forall v \in V, \forall s \in S$$

3. **Faculty Conflict:** At most one course per faculty member and slot:
   $$\sum_{c \in C : \text{faculty}(c) = f} \sum_{v \in V} x_{c, v, s} \le 1 \quad \forall f \in F, \forall s \in S$$

4. **Capacity Pruning:** Variable $x_{c, v, s}$ is pruned if $\text{capacity}(v) < \text{capacity\_required}(c)$.

5. **Daily Workload Limit:** For each faculty $f$ and each day $d$:
   $$\sum_{c : \text{faculty}(c) = f} \sum_{v \in V} \sum_{s \in S_d} x_{c, v, s} \le \text{max\_hours\_per\_day}(f)$$

---

## Running the Automated Test Suite

```bash
cd backend
pytest tests/ -v
```

Tests include:
- `test_solver.py`: Small and medium benchmarks, infeasibility proofs.
- `test_constraints.py`: Comprehensive input constraint validation.
- `test_api.py`: Full REST lifecycle integration tests.
- `test_performance.py`: Scale benchmark verifying solve time <5 seconds.
