#!/usr/bin/env python3
"""
ITC-2007 Track 3 (Curriculum-Based Course Timetabling) Benchmark Runner.

Solves selected benchmark instances using CP-SAT and evaluates every candidate timetable
with the independent solution checker. The solver's own internal claims are never trusted;
only the independent checker's violation counts and penalty costs are reported.

Outputs:
  - <out>/results.csv
  - <out>/results.md
  - <out>/run_log.txt
"""

from __future__ import annotations

import argparse
import csv
import datetime
import os
import sys
import time
from pathlib import Path
from typing import List, Optional

# Ensure project root is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from benchmarks.itc2007.adapter import solve_itc_instance
from benchmarks.itc2007.checker import CheckReport, check_solution
from benchmarks.itc2007.parser import Instance, Solution, parse_instance


def resolve_instance_path(name: str, instances_dir: Path) -> Path:
    """Resolve an instance name like 'comp01' or 'comp01.ctt' to an existing path."""
    if os.path.exists(name):
        return Path(name)
    cand1 = instances_dir / name
    if cand1.exists():
        return cand1
    cand2 = instances_dir / f"{name}.ctt"
    if cand2.exists():
        return cand2
    raise FileNotFoundError(f"Instance '{name}' not found in {instances_dir}")


def run_benchmark(
    instance_names: List[str],
    time_limit: int = 30,
    seed: int = 42,
    out_dir: Path = Path("benchmarks/itc2007/results"),
    instances_dir: Path = Path("benchmarks/itc2007/instances"),
) -> List[CheckReport]:
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "run_log.txt"
    csv_path = out_dir / "results.csv"
    md_path = out_dir / "results.md"

    reports: List[CheckReport] = []
    run_records = []

    with open(log_path, "w", encoding="utf-8") as log_f:
        def log(msg: str):
            print(msg)
            log_f.write(msg + "\n")
            log_f.flush()

        log(f"============================================================")
        log(f"ITC-2007 Track 3 Benchmark Evaluation")
        log(f"Timestamp: {datetime.datetime.now().isoformat()}")
        log(f"Instances: {', '.join(instance_names)}")
        log(f"Time limit per instance: {time_limit}s | Random Seed: {seed}")
        log(f"Output directory: {out_dir.resolve()}")
        log(f"Rule: Solver claims discarded. Only independent checker metrics reported.")
        log(f"============================================================\n")

        for inst_name in instance_names:
            try:
                inst_path = resolve_instance_path(inst_name, instances_dir)
            except FileNotFoundError as err:
                log(f"[ERROR] {err}")
                continue

            log(f">> Loading and solving instance: {inst_path.stem} ({inst_path.name})")
            inst: Instance = parse_instance(inst_path)
            log(f"   Courses: {len(inst.courses)}, Rooms: {len(inst.rooms)}, Curricula: {len(inst.curricula)}, Periods: {inst.total_periods}")

            t0 = time.perf_counter()
            sol, stats = solve_itc_instance(inst, time_limit_seconds=time_limit, random_seed=seed)
            solve_duration = round(time.perf_counter() - t0, 3)

            # Never rely on solver's own 'status' for verification
            if sol is None:
                log(f"   Solver returned NO solution within {time_limit}s limit (status={stats.get('status')})")
                # Run checker against empty solution to recount missing lectures/penalties
                report = check_solution(inst, Solution([]))
            else:
                log(f"   Solver returned {len(sol.assignments)} lecture assignments in {solve_duration}s")
                # Evaluate strictly via independent checker
                report = check_solution(inst, sol)

            reports.append(report)
            log(report.summary_table())
            log("")

            run_records.append({
                "Instance": inst_path.stem,
                "Status": "FEASIBLE" if report.is_feasible else "INFEASIBLE",
                "SolveTime_s": solve_duration,
                "TotalLectures": report.total_lectures_required,
                "LecturesScheduled": report.total_lectures_scheduled,
                "LecturesViol": report.lectures_violations,
                "ConflictsViol": report.conflicts_violations,
                "AvailViol": report.availability_violations,
                "RoomOccupViol": report.room_occupation_violations,
                "TotalHardViol": report.total_hard_violations,
                "CapacityCost": report.room_capacity_cost,
                "MinDaysCost": report.min_working_days_cost,
                "CompactCost": report.curriculum_compactness_cost,
                "RoomStabCost": report.room_stability_cost,
                "TotalSoftCost": report.total_soft_cost,
            })

    # Write CSV
    if run_records:
        fieldnames = list(run_records[0].keys())
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(run_records)

    # Write Markdown Summary Table
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# ITC-2007 Track 3 (CB-CTT) Benchmark Results\n\n")
        f.write(f"Generated at: `{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`  \n")
        f.write(f"Parameters: `time_limit={time_limit}s`, `seed={seed}`  \n\n")
        f.write("> **Independent Verification Notice**: All hard violation counts and soft costs below were recounted strictly from the output files by the independent checker. Solver self-reported claims are ignored.\n\n")

        f.write("| Instance | Status | Time (s) | Hard Violations (Lectures/Conflicts/Avail/Rooms) | Total Hard | Cap (w=1) | MinDays (w=5) | Compact (w=2) | Stab (w=1) | Total Soft Cost |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|\n")

        for r in run_records:
            hard_breakdown = f"{r['LecturesViol']} / {r['ConflictsViol']} / {r['AvailViol']} / {r['RoomOccupViol']}"
            f.write(
                f"| **{r['Instance']}** | `{r['Status']}` | {r['SolveTime_s']}s | {hard_breakdown} | **{r['TotalHardViol']}** | {r['CapacityCost']} | {r['MinDaysCost']} | {r['CompactCost']} | {r['RoomStabCost']} | **{r['TotalSoftCost']}** |\n"
            )

        f.write("\n## Metric Key\n")
        f.write("- **Status**: `FEASIBLE` if Total Hard Violations == 0, else `INFEASIBLE`.\n")
        f.write("- **Hard Constraints**: Lectures Scheduled, Teacher/Curriculum Non-Conflict, Course Availability, Room Non-Overbooking.\n")
        f.write("- **Soft Costs**: Room Capacity ($w=1$), Minimum Working Days ($w=5$), Curriculum Compactness ($w=2$), Room Stability ($w=1$).\n")

    return reports


def main():
    parser = argparse.ArgumentParser(description="ITC-2007 Track 3 Timetabling Benchmark Runner")
    parser.add_argument(
        "--instances",
        type=str,
        default="comp01,comp05,comp10",
        help="Comma-separated list of instance names (e.g. comp01,comp05,comp10)",
    )
    parser.add_argument(
        "--time-limit",
        type=int,
        default=30,
        help="Per-instance solver time limit in seconds (default: 30)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for solver repeatability (default: 42)",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="benchmarks/itc2007/results",
        help="Output directory for results table and logs",
    )
    parser.add_argument(
        "--instances-dir",
        type=str,
        default="benchmarks/itc2007/instances",
        help="Directory containing official .ctt instance files",
    )

    args = parser.parse_args()
    inst_list = [x.strip() for x in args.instances.split(",") if x.strip()]
    run_benchmark(
        instance_names=inst_list,
        time_limit=args.time_limit,
        seed=args.seed,
        out_dir=Path(args.out),
        instances_dir=Path(args.instances_dir),
    )


if __name__ == "__main__":
    main()
