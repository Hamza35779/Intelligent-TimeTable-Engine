# ITC-2007 Track 3 (CB-CTT) Benchmark Results

Generated at: `2026-10-19 02:12:56`  
Parameters: `time_limit=30s`, `seed=42`  

> **Independent Verification Notice**: All hard violation counts and soft costs below were recounted strictly from the output files by the independent checker. Solver self-reported claims are ignored.

| Instance | Status | Time (s) | Hard Violations (Lectures/Conflicts/Avail/Rooms) | Total Hard | Cap (w=1) | MinDays (w=5) | Compact (w=2) | Stab (w=1) | Total Soft Cost |
|---|---|---|---|---|---|---|---|---|---|
| **comp01** | `FEASIBLE` | 2.528s | 0 / 0 / 0 / 0 | **0** | 4 | 0 | 122 | 48 | **174** |
| **comp05** | `FEASIBLE` | 7.5s | 0 / 0 / 0 / 0 | **0** | 0 | 15 | 1548 | 48 | **1611** |
| **comp10** | `FEASIBLE` | 31.602s | 0 / 0 / 0 / 0 | **0** | 0 | 0 | 590 | 197 | **787** |

## Metric Key
- **Status**: `FEASIBLE` if Total Hard Violations == 0, else `INFEASIBLE`.
- **Hard Constraints**: Lectures Scheduled, Teacher/Curriculum Non-Conflict, Course Availability, Room Non-Overbooking.
- **Soft Costs**: Room Capacity ($w=1$), Minimum Working Days ($w=5$), Curriculum Compactness ($w=2$), Room Stability ($w=1$).
