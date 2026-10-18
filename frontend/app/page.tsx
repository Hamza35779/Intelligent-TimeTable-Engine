'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Layers,
  Clock,
  Play,
  ArrowRight,
  Users,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  ShieldCheck,
  Bot,
  UserCheck,
  Sliders,
  Award,
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
      setDemoError('Could not connect to backend server. Running local demo simulation...');
      // Fallback redirect to schedule 1
      setTimeout(() => {
        router.push('/schedule/1');
      }, 700);
    } finally {
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
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 p-8 sm:p-14 lg:p-20 shadow-sm text-center">
        {/* Subtle radial gradient backgrounds like TimetableMaster */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-96"
          style={{
            background:
              'radial-gradient(50% 55% at 15% 0%, rgba(79,70,229,0.10) 0%, rgba(255,255,255,0) 70%), radial-gradient(45% 50% at 85% 5%, rgba(234,88,12,0.08) 0%, rgba(255,255,255,0) 70%)',
          }}
        />

        <div className="relative max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Intelligent Timetable Engine &bull; University &amp; School Scheduling</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08]">
            Timetables that hold up <br className="hidden sm:inline" />
            <span className="text-indigo-600">for the whole university.</span>
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Give it teachers and courses via <strong>CSV/Excel upload</strong> or <strong>screen table entry</strong>.
            CP-SAT generates one conflict-free timetable and produces separate schedules for Administration, Teachers,
            Classes, Staff, and the Canteen.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/build"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base rounded-full shadow-sm hover:shadow transition-all"
            >
              <span>Build Schedule</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/enter-data"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-base rounded-full border border-indigo-200 transition-all shadow-sm"
            >
              <span>Data Entry Table</span>
            </Link>

            <Link
              href="/guide"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-base rounded-full border border-slate-300 hover:border-slate-400 transition-all shadow-sm"
            >
              <span>User Guide</span>
            </Link>
            <button

              type="button"
              onClick={handleRunDemo}
              disabled={isRunningDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base rounded-full border border-slate-900 transition-all shadow-sm"
            >
              {isRunningDemo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Computing Timetable...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-indigo-400" />
                  <span>Run Instant Demo</span>
                </>
              )}
            </button>
          </div>


          <p className="text-xs text-slate-400 pt-1">
            Zero installation required. Google OR-Tools CP-SAT + Scikit-Learn ML engine.
          </p>

          {demoError && (
            <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{demoError}</span>
            </div>
          )}
        </div>
      </section>

      {/* Platform Metrics Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-indigo-600 font-display">100%</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">Conflict-Free Guarantee</div>
          <div className="text-xs text-slate-500 mt-0.5">OR-Tools CP-SAT hard intervals</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-slate-900 font-display">&lt; 5s</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">Solve Execution</div>
          <div className="text-xs text-slate-500 mt-0.5">Instant mathematical optimization</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-slate-900 font-display">5 Views</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">Multi-Audience Output</div>
          <div className="text-xs text-slate-500 mt-0.5">Master, Teacher, Student, Staff, Canteen</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-slate-900 font-display">7 Formats</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">Universal Export</div>
          <div className="text-xs text-slate-500 mt-0.5">PDF, Excel, CSV, PNG, JSON, HTML</div>
        </div>
      </section>

      {/* Core Platform Modules (Inspired by TimetableMaster 6 Modules) */}
      <section className="space-y-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Across The Platform
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Everything your institution needs, in one place.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-2">
            Build the schedule with exact university constraints, then manage covers, workloads,
            and exports on top of the same data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module 1: Timetables */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Class-Based Timetables</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Automatic conflict resolution for multi-credit courses. Splits 3-credit courses into
                balanced 2h + 1h sessions with protected lunch intervals and rest breaks.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Zero teacher double-booking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Room capacity &amp; lab matching</span>
              </li>
            </ul>
          </div>

          {/* Module 2: Substitutes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Smart Substitute Management</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                When faculty are absent, TimetableMaster ranks available cover professors based on
                free periods, weekly workload balance, and department relevance.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/substitutes"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                <span>Open Substitute Finder</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Module 3: AI Assistant */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">AI Schedule Copilot</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Natural-language assistance for timetable queries. Ask who is available at 10 AM,
                diagnose why a schedule won&apos;t fit, or trigger simultaneous multi-view exports.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/assistant"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                <span>Chat with AI Copilot</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Module 4: Multi-Audience Views */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">One Timetable, Five Views</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Every stakeholder receives a tailored view: Master grid for Dean, individual
                schedules for teachers, cohort tables for students, plus staff &amp; canteen rush
                views.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Synchronized from single solve</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Zero discrepancies between views</span>
              </li>
            </ul>
          </div>

          {/* Module 5: ML Teacher Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Machine Learning Preferences</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Random Forest classifier learns faculty morning/afternoon preferences from feedback
                history and applies soft penalties without compromising hard constraints.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>5-fold cross validation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Fair workload spread across days</span>
              </li>
            </ul>
          </div>

          {/* Module 6: Universal Export */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Universal Formats &amp; Print</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Export presentation-grade schedules ready for physical notice boards and digital
                sharing in Excel (.xlsx), PDF, CSV, PNG, and JSON.
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Formula injection sanitized</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Official university header format</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Comparison Table: Spreadsheets vs TimetableMaster */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-sm">
        <div className="max-w-2xl mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            The Difference
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Against how most institutions do it today
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 pr-6">Workflow</th>
                <th className="py-3 pr-6 text-slate-500">Spreadsheets &amp; Manual Work</th>
                <th className="py-3 text-indigo-600 font-extrabold">TimetableMaster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <tr>
                <td className="py-4 pr-6 font-semibold text-slate-900">Generating the Schedule</td>
                <td className="py-4 pr-6 text-slate-500">Weeks of tedious trial-and-error</td>
                <td className="py-4 font-semibold text-indigo-600">Computed in &lt; 5 seconds via CP-SAT</td>
              </tr>
              <tr>
                <td className="py-4 pr-6 font-semibold text-slate-900">Clashes &amp; Double-Booking</td>
                <td className="py-4 pr-6 text-slate-500">Found after publication by confused faculty</td>
                <td className="py-4 font-semibold text-indigo-600">Mathematically impossible (Hard constraints)</td>
              </tr>
              <tr>
                <td className="py-4 pr-6 font-semibold text-slate-900">Teacher Substitutions</td>
                <td className="py-4 pr-6 text-slate-500">Morning phone calls and WhatsApp scrambles</td>
                <td className="py-4 font-semibold text-indigo-600">Instant ranked covers by free slots &amp; load</td>
              </tr>
              <tr>
                <td className="py-4 pr-6 font-semibold text-slate-900">Multi-Audience Views</td>
                <td className="py-4 pr-6 text-slate-500">Manually copy-pasting into 50+ separate sheets</td>
                <td className="py-4 font-semibold text-indigo-600">Instant pure views derived from one solve</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Schedules Section */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Recent Schedules</h2>
              <p className="text-xs text-slate-500">Previously solved university timetable runs</p>
            </div>
          </div>

          <Link
            href="/schedule"
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold transition"
          >
            <span>All Schedules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoadingSchedules ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-slate-900 font-semibold text-base">No schedules yet</div>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Get started by creating your first timetable with the Builder or click Run Demo.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/build"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Build Schedule</span>
              </Link>
              <button
                type="button"
                onClick={handleRunDemo}
                disabled={isRunningDemo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-200 transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current text-indigo-600" />
                <span>Run Demo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 px-3 rounded-xl transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        Timetable #{schedule.id}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border ${
                          schedule.status === 'OPTIMAL'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {schedule.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(schedule.generated_at)} &bull;{' '}
                      <span className="text-slate-700 font-medium">
                        {schedule.total_courses_scheduled} contact sessions
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 transition"
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
