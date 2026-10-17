'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Clock,
  Play,
  ArrowRight,
  Users,
  Cpu,
  CalendarCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { TimetableResponse, ScheduleSummary } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HomePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const res = await fetch(`${API_BASE}/schedules`);
      if (res.ok) {
        const data: ScheduleSummary[] = await res.json();
        setSchedules(data);
      } else {
        setSchedules([]);
      }
    } catch {
      setSchedules([]);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleRunDemo = async () => {
    setIsRunningDemo(true);
    setDemoError(null);
    try {
      const res = await fetch(`${API_BASE}/demo/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Demo failed with status: ${res.status}`);
      }

      const data: TimetableResponse = await res.json();
      router.push(`/schedule/${data.schedule_id}`);
    } catch (err) {
      console.error(err);
      setDemoError('Failed to run demo schedule. Please ensure the backend server is running.');
      setIsRunningDemo(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <section className="relative rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-8 sm:p-12 lg:p-16 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Automated University Timetabling</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            University Timetable <span className="text-emerald-400">Generator</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Generate conflict-free, optimal university schedules in seconds. Powered by Google
            OR-Tools CP-SAT constraint programming to balance faculty availability, student
            cohorts, and room capacities effortlessly.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/build"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-emerald-500/20 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Build Schedule</span>
            </Link>

            <button
              type="button"
              onClick={handleRunDemo}
              disabled={isRunningDemo}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm sm:text-base border border-slate-700 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isRunningDemo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Running Demo...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-emerald-400" />
                  <span>Run Demo</span>
                </>
              )}
            </button>
          </div>

          {demoError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{demoError}</span>
            </div>
          )}
        </div>
      </section>

      {/* How it Works */}
      <section className="space-y-6">
        <div className="text-center sm:text-left space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How It Works</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Three simple steps to generate a complete academic timetable with zero conflicts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="relative rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:bg-emerald-500/20 transition">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 1</span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">Add Teachers &amp; Courses</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Add your faculty members, departments, and course details manually or upload a
                simple 3-column CSV spreadsheet in seconds.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:bg-emerald-500/20 transition">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 2</span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">Click Generate</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                The Google OR-Tools CP-SAT solver analyzes constraints, time slots, and room
                capacities to compute the mathematically optimal schedule.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:bg-emerald-500/20 transition">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 3</span>
              <h3 className="text-lg font-bold text-white mt-1 mb-2">View &amp; Export</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Explore tailored perspectives for teachers, students, and administration, and
                export your finished schedule to PDF, Excel, or CSV.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Schedules */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Recent Schedules</h2>
              <p className="text-xs text-slate-400">Previously generated timetable runs</p>
            </div>
          </div>

          <Link
            href="/schedule"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition"
          >
            <span>All Schedules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoadingSchedules ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Loading schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-slate-300 font-semibold text-base">No schedules yet</div>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Get started by creating your first timetable with the Easy Builder or click Run Demo.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/build"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Build Schedule</span>
              </Link>
              <button
                type="button"
                onClick={handleRunDemo}
                disabled={isRunningDemo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                <span>Run Demo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/50 px-3 rounded-xl transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        Timetable #{schedule.id}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        {schedule.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {formatDate(schedule.generated_at)} &bull;{' '}
                      <span className="text-slate-300 font-medium">
                        {schedule.total_courses_scheduled} sessions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pl-5 sm:pl-0">
                  <span className="text-xs font-mono text-slate-400">
                    {Number(schedule.solver_time_ms || 0).toFixed(1)} ms
                  </span>
                  <Link
                    href={`/schedule/${schedule.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  >
                    <span>View Schedule</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
