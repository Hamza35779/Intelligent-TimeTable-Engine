# University Timetable Generator & Intelligent Engine

[![Build Android APK](https://github.com/Hamza35779/Intelligent-TimeTable-Engine/actions/workflows/build-apk.yml/badge.svg)](https://github.com/Hamza35779/Intelligent-TimeTable-Engine/actions/workflows/build-apk.yml)
[![Release](https://img.shields.io/github/v/release/Hamza35779/Intelligent-TimeTable-Engine?color=emerald&label=Release)](https://github.com/Hamza35779/Intelligent-TimeTable-Engine/releases/tag/v1.0.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A constraint-based timetable optimization and university scheduling engine powered by **Google OR-Tools CP-SAT**, paired with **Random Forest ML** for faculty preference modeling, real-time visual drag-and-drop overrides, voice command control, and a native **Android APK** mobile app.

---

## 📱 Mobile App (Android APK)

The project includes a native Android mobile application built with **Capacitor 8**, featuring responsive timetable exploration, native microphone access for voice scheduling, and offline asset loading.

- **Direct Download**: [intelligent-timetable.apk (v1.0.0)](https://github.com/Hamza35779/Intelligent-TimeTable-Engine/releases/download/v1.0.0/intelligent-timetable.apk) (~3.93 MB)
- **GitHub Release**: [v1.0.0 Release Notes](https://github.com/Hamza35779/Intelligent-TimeTable-Engine/releases/tag/v1.0.0)

### Installing on Android
1. Download `intelligent-timetable.apk` to your phone or tablet.
2. Tap the file in your downloads folder.
3. Enable *"Install from unknown sources"* if prompted.
4. Open **Intelligent Timetable** to view master schedules, faculty rosters, and voice controls on the go.

### Building the APK Yourself
- **Cloud CI/CD (GitHub Actions)**: Pushing changes to `main` or pushing any version tag (`git tag v1.0.1 && git push origin v1.0.1`) automatically runs `.github/workflows/build-apk.yml`, compiles the debug APK, and attaches it to the release.
- **Local Build**:
  - Run `scripts/build-apk.bat` (requires JDK 21 and Android SDK).
  - Or open `frontend/android` in **Android Studio** and click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

---

## What It Does

Upload a CSV of teachers and courses → the solver generates a conflict-free, fair schedule in under 5 seconds → view it as an interactive university-style timetable grid → interact via voice or drag-and-drop → export as CSV, XLSX, PDF, JSON, or HTML.

### Key Highlights
- **Mathematical Zero Conflicts**: Hard mathematical constraints ensure no teacher, student cohort, or venue is ever double-booked.
- **Interactive Visual Grid**: Real-time drag-and-drop slot manipulation with instant clash halo warnings if a registrar moves a class into a conflicting slot.
- **Voice-Activated Scheduling**: Hands-free natural speech commands for room inquiries, teacher lookups, and schedule navigation.
- **Multi-Role Perspectives**: Dedicated views for University Registrars (Master View), Faculty (Teacher View), and Students (Cohort View).
- **Format Flexibility**: Instant export to Excel (.xlsx), CSV, printable PDF tables, and JSON.

---

## Quick Start (Local Development)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux / macOS

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API Base: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Web App: `http://localhost:3000`

### 3. Docker (Full Stack)

```bash
docker compose up --build
```

---

## How To Use

1. **Navigate to `/build`** (Easy Builder interface).
2. **Add Faculty**: Type teacher names or import a batch roster.
3. **Add Courses**: Specify credit hours (1–6), instructor, and delivery format (Lecture or Lab).
4. **Set Schedule Parameters**: Choose working days (Mon–Fri), time slots, and room inventory.
5. **Click Generate**: Google OR-Tools CP-SAT solves the exact constraint satisfaction problem in seconds.
6. **Interact & Refine**: Use the drag-and-drop grid or voice commands to review or manually adjust assignments.
7. **Export & Share**: Download ready-to-print PDFs or formatted Excel sheets.

Alternatively, upload a CSV file with:
```csv
teacher_name,course_name,credit_hours
Dr. Sarah Ahmed,Artificial Intelligence,3
Dr. Sarah Ahmed,Deep Learning,3
Prof. Kamran Siddiqui,Operating Systems,4
Dr. Ayesha Tariq,Database Systems,4
```
*Optional columns: `course_code`, `student_group`, `room_type`*

---

## Constraints Engine

### Hard Constraints (Never Violated)
- **Teacher Exclusivity**: No instructor can teach two sessions simultaneously.
- **Venue Exclusivity**: No room or lab can host multiple sessions concurrently.
- **Cohort Integrity**: No student group has simultaneous conflicting classes.
- **Lunch Protection**: Reserved mid-day break periods (e.g., 12:00–13:30).
- **Daily Workload Cap**: Maximum daily contact hours strictly enforced per teacher.

### Soft Constraints (Optimized via Objective Function)
- **Workload Fairness**: Balanced distribution across days to prevent teacher burnout.
- **Faculty Preferences**: Time-of-day affinity learned using scikit-learn Random Forest regression.
- **Curriculum Compactness**: Minimized idle gaps between classes for students.
- **Room Stability**: Minimized venue switches for consecutive sessions of the same course.

---

## Academic Benchmark (ITC-2007 Track 3 CB-CTT)

The solver is benchmarked against the standard academic **ITC-2007 Track 3 (Curriculum-Based Course Timetabling)** competition instances (`comp01` through `comp21`).

### Independent Verification Architecture
To ensure objective rigor, the system uses an **independent solution checker** (`benchmarks/itc2007/checker.py`) that strictly recounts every hard violation and soft cost directly from the generated schedule. **The solver's own internal status claims are never trusted; only the independent checker's metrics are reported.**

- **Hard Constraints (Target: 0 violations)**:
  - `Lectures`: All required lectures scheduled in valid periods and rooms.
  - `Conflicts`: No teacher or curriculum cohort overlaps in any period.
  - `Availability`: No lectures assigned to unavailable time slots.
  - `RoomOccupation`: At most one lecture per room in any time slot.
- **Soft Constraints (Official ITC-2007 Penalty Weights)**:
  - `RoomCapacity` ($w = 1$): Penalty of 1 per student exceeding room capacity.
  - `MinWorkingDays` ($w = 5$): Penalty of 5 for each day short of minimum teaching days.
  - `CurriculumCompactness` ($w = 2$): Penalty of 2 for isolated lectures in a curriculum day.
  - `RoomStability` ($w = 1$): Penalty of 1 for each distinct room used beyond the first.

### Running the Benchmark

```bash
# 1. Fetch official competition instances and PDF documentation
python scripts/fetch_itc2007.py

# 2. Run benchmark on selected instances (e.g. comp01, comp05, comp10)
python benchmarks/itc2007/run_benchmark.py --instances comp01,comp05,comp10 --time-limit 30 --seed 42 --out benchmarks/itc2007/results

# 3. Run independent checker & parser unit tests
pytest benchmarks/itc2007/tests/ -v
```

### Benchmark Results (Independent Checker Recount)

| Instance | Status | Solve Time | Hard Violations (Lec/Conf/Avail/Room) | Total Hard | Cap ($w=1$) | MinDays ($w=5$) | Compact ($w=2$) | Stab ($w=1$) | Total Soft Cost |
|---|---|---|---|---|---|---|---|---|---|
| **comp01** | `FEASIBLE` | 2.53s | 0 / 0 / 0 / 0 | **0** | 4 | 0 | 122 | 48 | **174** |
| **comp05** | `FEASIBLE` | 7.50s | 0 / 0 / 0 / 0 | **0** | 0 | 15 | 1548 | 48 | **1611** |
| **comp10** | `FEASIBLE` | 31.60s | 0 / 0 / 0 / 0 | **0** | 0 | 0 | 590 | 197 | **787** |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Optimization Solver** | Google OR-Tools CP-SAT (Constraint Programming) |
| **Backend Framework** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy |
| **Machine Learning** | scikit-learn (Random Forest preference regression) |
| **Frontend Web** | Next.js 14, React 18, TypeScript, TailwindCSS, Lucide Icons |
| **Mobile Runtime** | Capacitor 8 (Android SDK 34, JDK 21) |
| **Database** | SQLite (development), PostgreSQL / Supabase supported |
| **Exports** | ReportLab (PDF), OpenPyXL (Excel), CSV, JSON, HTML |
| **CI / CD** | GitHub Actions (Automated testing & APK releases) |

---

## Testing

```bash
# Backend test suite (31 tests covering solver, endpoints, ML pipeline, exports)
cd backend
pytest -v

# ITC-2007 benchmark unit tests
pytest benchmarks/itc2007/tests/ -v
```

---

## License

This project is licensed under the [MIT License](LICENSE).
