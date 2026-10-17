'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Database,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { getAllLocalSchedules } from '../../utils/localFallbackSolver';

interface ScheduleSummary {
  id: number;
  generated_at: string;
  status: string;
  solver_status?: string;
  solver_time_ms?: number;
  total_courses_scheduled?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ScheduleListPage() {
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsFallback(false);

    try {
      const response = await fetch(`${API_BASE}/schedules`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data: ScheduleSummary[] = await response.json();
      setSchedules(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch schedules';
      setError(message);

      // Fallback to local storage schedules
      const localData = getAllLocalSchedules();
      if (localData && localData.length > 0) {
        const mappedLocal: ScheduleSummary[] = localData.map((item) => ({
          id: item.schedule_id,
          generated_at: item.generated_at,
          status: item.status,
          solver_status: item.stats?.status,
          solver_time_ms: item.stats?.solver_time_ms,
          total_courses_scheduled: item.stats?.total_courses_scheduled,
        }));
        setSchedules(mappedLocal);
        setIsFallback(true);
      } else {
        setSchedules([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 sm:p-8 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Timetable Runs
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            View, inspect, and export all generated academic schedules and audience perspectives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSchedules}
            disabled={loading}
            className="p-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50 transition"
            title="Refresh schedules"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <Link
            href="/build"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Build New Schedule</span>
          </Link>
        </div>
      </div>

      {/* Offline Fallback Banner */}
      {isFallback && (
        <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <Database className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            API server unreachable. Showing schedules cached locally in browser storage.
          </span>
        </div>
      )}

      {/* Error Banner when no items are available */}
      {error && schedules.length === 0 && !loading && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <div className="flex-1">
            <span className="font-semibold">Unable to connect to backend:</span> {error}
          </div>
          <button
            onClick={fetchSchedules}
            className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm">Loading schedules...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && schedules.length === 0 && !error && (
        <div className="text-center py-16 px-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No schedules generated yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Run the CP-SAT constraint solver or import a CSV to create your first conflict-free schedule.
            </p>
          </div>
          <div>
            <Link
              href="/build"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Launch Timetable Builder</span>
            </Link>
          </div>
        </div>
      )}

      {/* Schedule List Cards */}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schedules.map((schedule) => {
            const statusUpper = (schedule.solver_status || schedule.status || 'OPTIMAL').toUpperCase();
            const isOptimal = statusUpper.includes('OPTIMAL');
            const isFeasible = statusUpper.includes('FEASIBLE');

            return (
              <Link
                key={schedule.id}
                href={`/schedule/${schedule.id}`}
                className="group block bg-white border border-slate-200/80 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="text-xs font-mono text-indigo-600 font-bold">
                      Run #{schedule.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      Timetable #{schedule.id}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isOptimal
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isFeasible
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{statusUpper}</span>
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Generated:</span>
                    </span>
                    <span className="text-slate-700 font-medium">
                      {new Date(schedule.generated_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {schedule.total_courses_scheduled !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Contact Sessions:</span>
                      <span className="text-slate-900 font-bold font-mono">
                        {schedule.total_courses_scheduled}
                      </span>
                    </div>
                  )}

                  {schedule.solver_time_ms !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Solver Runtime:</span>
                      <span className="text-slate-700 font-mono">
                        {Number(schedule.solver_time_ms).toFixed(1)} ms
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 transition">
                  <span>Open Multi-View Matrix</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
