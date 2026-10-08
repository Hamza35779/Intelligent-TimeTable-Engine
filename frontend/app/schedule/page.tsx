'use client';

import { useState } from 'react';
import { useSchedule } from '../../hooks/useSchedule';
import TimetableGrid from '../../components/TimetableGrid';
import SolverStatus from '../../components/SolverStatus';
import Analytics from '../../components/Analytics';
import { Sparkles, Play, RefreshCw, AlertTriangle, Layers, FileCode, CheckCircle2 } from 'lucide-react';

const SAMPLE_BENCHMARK_DATA = {
  faculty: [
    {
      name: "Dr. Alan Turing",
      department: "Computer Science",
      max_hours_per_day: 4,
      max_days_per_week: 5,
      email: "turing@cs.university.edu",
      preferences: { prefer_morning: true, preferred_days: ["Monday", "Wednesday"] },
      unavailable_slots: [3],
    },
    {
      name: "Dr. Ada Lovelace",
      department: "Computer Science",
      max_hours_per_day: 4,
      max_days_per_week: 5,
      email: "ada@cs.university.edu",
      preferences: { prefer_morning: true, preferred_days: ["Tuesday", "Thursday"] },
      unavailable_slots: [],
    },
    {
      name: "Dr. Claude Shannon",
      department: "Information Theory",
      max_hours_per_day: 4,
      max_days_per_week: 4,
      email: "shannon@it.university.edu",
      preferences: { prefer_morning: false, preferred_days: ["Monday", "Wednesday", "Friday"] },
      unavailable_slots: [0],
    },
    {
      name: "Dr. Grace Hopper",
      department: "Software Engineering",
      max_hours_per_day: 5,
      max_days_per_week: 5,
      email: "hopper@eng.university.edu",
      preferences: { prefer_morning: true, preferred_days: ["Monday", "Tuesday"] },
      unavailable_slots: [],
    },
    {
      name: "Dr. John von Neumann",
      department: "Mathematics",
      max_hours_per_day: 4,
      max_days_per_week: 5,
      email: "vonneumann@math.university.edu",
      preferences: { prefer_morning: false, preferred_days: ["Thursday", "Friday"] },
      unavailable_slots: [],
    },
  ],
  venues: [
    { name: "Auditorium Turing", capacity: 120, equipment: ["projector", "mic", "recording"] },
    { name: "Hall Shannon", capacity: 80, equipment: ["projector", "mic"] },
    { name: "Lab Hopper", capacity: 45, equipment: ["workstations", "projector"] },
    { name: "Seminar Room 101", capacity: 35, equipment: ["whiteboard"] },
  ],
  slots: [
    { day_of_week: "Monday", start_time: "09:00", end_time: "10:00", duration_minutes: 60 },
    { day_of_week: "Monday", start_time: "10:00", end_time: "11:00", duration_minutes: 60 },
    { day_of_week: "Monday", start_time: "11:00", end_time: "12:00", duration_minutes: 60 },
    { day_of_week: "Monday", start_time: "14:00", end_time: "15:00", duration_minutes: 60 },
    { day_of_week: "Tuesday", start_time: "09:00", end_time: "10:00", duration_minutes: 60 },
    { day_of_week: "Tuesday", start_time: "10:00", end_time: "11:00", duration_minutes: 60 },
    { day_of_week: "Tuesday", start_time: "11:00", end_time: "12:00", duration_minutes: 60 },
    { day_of_week: "Wednesday", start_time: "09:00", end_time: "10:00", duration_minutes: 60 },
    { day_of_week: "Wednesday", start_time: "10:00", end_time: "11:00", duration_minutes: 60 },
    { day_of_week: "Wednesday", start_time: "14:00", end_time: "15:00", duration_minutes: 60 },
    { day_of_week: "Thursday", start_time: "09:00", end_time: "10:00", duration_minutes: 60 },
    { day_of_week: "Thursday", start_time: "10:00", end_time: "11:00", duration_minutes: 60 },
    { day_of_week: "Friday", start_time: "09:00", end_time: "10:00", duration_minutes: 60 },
    { day_of_week: "Friday", start_time: "10:00", end_time: "11:00", duration_minutes: 60 },
  ],
  courses: [
    { name: "Theory of Computation", code: "CS301", faculty_id: 0, capacity_required: 70 },
    { name: "Computer Architecture", code: "CS201", faculty_id: 0, capacity_required: 40 },
    { name: "Algorithms & Complexity", code: "CS401", faculty_id: 1, capacity_required: 60 },
    { name: "Compiler Design", code: "CS405", faculty_id: 1, capacity_required: 35 },
    { name: "Information Theory", code: "IT202", faculty_id: 2, capacity_required: 50 },
    { name: "Digital Communications", code: "IT303", faculty_id: 2, capacity_required: 30 },
    { name: "Software System Design", code: "SE310", faculty_id: 3, capacity_required: 40 },
    { name: "Operating Systems", code: "SE205", faculty_id: 3, capacity_required: 30 },
    { name: "Discrete Mathematics", code: "MA101", faculty_id: 4, capacity_required: 80 },
    { name: "Game Theory & Automata", code: "MA302", faculty_id: 4, capacity_required: 35 },
  ],
  timeout_seconds: 5,
};

export default function SchedulePage() {
  const { loading, error, currentSchedule, generateSchedule, rescheduleConflicts } = useSchedule();
  const [datasetJson, setDatasetJson] = useState(JSON.stringify(SAMPLE_BENCHMARK_DATA, null, 2));
  const [activeTab, setActiveTab] = useState<'grid' | 'analytics' | 'editor'>('grid');
  const [rescheduleSlotId, setRescheduleSlotId] = useState<number>(0);
  const [rescheduling, setRescheduling] = useState(false);

  const handleRunSolver = async () => {
    try {
      const parsedData = JSON.parse(datasetJson);
      await generateSchedule(parsedData);
      setActiveTab('grid');
    } catch (err: any) {
      alert('Invalid JSON input: ' + err.message);
    }
  };

  const handleLoadSample = () => {
    setDatasetJson(JSON.stringify(SAMPLE_BENCHMARK_DATA, null, 2));
  };

  const handleTestReschedule = async () => {
    if (!currentSchedule) return;
    setRescheduling(true);
    try {
      // Simulate slot 0 becoming unavailable (e.g. emergency campus outage)
      await rescheduleConflicts({
        timetable_id: currentSchedule.schedule_id,
        unseated_slot_ids: [rescheduleSlotId],
        timeout_seconds: 5,
      });
      alert(`Rescheduled successfully around conflict at slot ${rescheduleSlotId}! Minimal disruption applied.`);
    } catch (e: any) {
      alert('Reschedule error: ' + e.message);
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            <span>Generate Autonomous Timetable</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Engine compiles hard and soft constraints into Google OR-Tools CP-SAT integer optimization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadSample}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Load University Preset</span>
          </button>

          <button
            onClick={handleRunSolver}
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Solving Constraints...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Solve & Generate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs flex items-center space-x-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div className="font-mono">{error}</div>
        </div>
      )}

      {/* Results View & Solver Status */}
      {currentSchedule && (
        <div className="space-y-6">
          <SolverStatus stats={currentSchedule.stats} />

          {/* Reschedule Simulation Toolbar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-200">Real-Time Conflict Rescheduling:</span>
              <span className="text-xs text-slate-400">Simulate room maintenance or unexpected slot cancellation</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={rescheduleSlotId}
                onChange={(e) => setRescheduleSlotId(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none"
              >
                <option value={0}>Simulate Slot #0 Outage (Monday 09:00)</option>
                <option value={1}>Simulate Slot #1 Outage (Monday 10:00)</option>
                <option value={4}>Simulate Slot #4 Outage (Tuesday 09:00)</option>
              </select>
              <button
                onClick={handleTestReschedule}
                disabled={rescheduling}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition"
              >
                {rescheduling ? 'Rescheduling...' : 'Apply Delta Reschedule'}
              </button>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex space-x-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('grid')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'grid'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timetable Grid
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Optimization Analytics
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'editor'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw Input JSON
            </button>
          </div>

          {activeTab === 'grid' && <TimetableGrid entries={currentSchedule.schedule} />}

          {activeTab === 'analytics' && currentSchedule.analytics && (
            <Analytics analyticsData={currentSchedule.analytics} />
          )}

          {activeTab === 'editor' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <textarea
                value={datasetJson}
                onChange={(e) => setDatasetJson(e.target.value)}
                rows={18}
                className="w-full bg-slate-950 font-mono text-xs text-emerald-400/90 p-4 rounded-xl border border-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>
      )}

      {/* When no schedule is loaded yet, show the JSON Editor directly */}
      {!currentSchedule && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 text-white font-semibold text-sm">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Input Data Configuration (Faculty, Venues, Slots, Courses)</span>
            </div>
            <span className="text-xs text-slate-500">Edit or paste directly</span>
          </div>
          <textarea
            value={datasetJson}
            onChange={(e) => setDatasetJson(e.target.value)}
            rows={16}
            className="w-full bg-slate-950 font-mono text-xs text-slate-300 p-4 rounded-xl border border-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}
    </div>
  );
}
