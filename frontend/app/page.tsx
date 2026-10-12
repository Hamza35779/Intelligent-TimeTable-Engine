'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Activity,
  Play,
  RefreshCw,
} from 'lucide-react';
import CsvUploader from '../components/CsvUploader';
import ChatBot from '../components/ChatBot';
import MLStatus from '../components/MLStatus';
import { TimetableResponse } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HomePage() {
  const router = useRouter();
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);
  const [runningDemo, setRunningDemo] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setHealthLoading(true);
      try {
        const [healthRes, schedulesRes] = await Promise.all([
          fetch(`${API_BASE}/health`).catch(() => null),
          fetch(`${API_BASE}/schedules`).catch(() => null),
        ]);

        if (healthRes && healthRes.ok) {
          setHealth(await healthRes.json());
        }
        if (schedulesRes && schedulesRes.ok) {
          setRecentSchedules(await schedulesRes.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setHealthLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleCsvGenerated = (data: TimetableResponse) => {
    router.push(`/schedule/${data.schedule_id}`);
  };

  const handleRunDemo = async () => {
    setRunningDemo(true);
    try {
      const res = await fetch(`${API_BASE}/demo/run`, { method: 'POST' });
      if (res.ok) {
        const data: TimetableResponse = await res.json();
        router.push(`/schedule/${data.schedule_id}`);
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningDemo(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>OR-Tools CP-SAT + Random Forest ML + Conversational AI</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Conversational, ML-driven university timetabling in{' '}
            <span className="text-emerald-400">&lt;5 seconds</span>.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Upload your 3-column course CSV (<span className="font-mono text-slate-300">teacher_name, course_name, credit_hours</span>) or chat with the AI Assistant to generate conflict-free schedules with 5 tailored audience views (Master, Teacher, Student, Support Staff, Canteen Staff) and 7 simultaneous export formats.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleRunDemo}
              disabled={runningDemo}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
            >
              {runningDemo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Running Demo (Seed 42)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Demo (12 Courses, Seed 42)</span>
                </>
              )}
            </button>
            <Link
              href="/schedule"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Launch Timetable Workspace</span>
            </Link>
            <Link
              href="/constraints"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-sm border border-slate-800 transition"
            >
              <span>Manage Constraints</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive CSV Uploader + Conversational AI Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-6">
          <CsvUploader onScheduleGenerated={handleCsvGenerated} />
          <MLStatus />
        </div>
        <div className="lg:col-span-7">
          <ChatBot
            scheduleId={recentSchedules[0]?.id}
            onScheduleGenerated={(data) => {
              setRecentSchedules((prev) => [
                {
                  id: data.schedule_id,
                  generated_at: data.generated_at,
                  status: data.status,
                  total_courses_scheduled: data.stats.total_courses_scheduled,
                  solver_time_ms: data.stats.solver_time_ms,
                },
                ...prev.filter((item) => item.id !== data.schedule_id),
              ]);
            }}
          />
        </div>
      </div>

      {/* Engine Status & Features Grid (Live from /health - No hardcoded strings) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Live System Health (/health)</h3>
          <p className="text-slate-400 text-xs mb-3">
            Status:{' '}
            <span
              className={`font-mono font-bold ${
                health?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {healthLoading ? 'checking...' : health?.status ?? 'unreachable'}
            </span>
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3 font-mono">
            <div>
              Database:{' '}
              <span className="text-slate-200">
                {healthLoading
                  ? '...'
                  : health?.database?.reachable
                  ? 'reachable'
                  : 'unreachable'}
              </span>
            </div>
            <div>
              OR-Tools:{' '}
              <span className="text-slate-200">
                {healthLoading
                  ? '...'
                  : health?.ortools?.importable
                  ? `v${health.ortools.version}`
                  : 'unavailable'}
              </span>
            </div>
            <div>
              ML Model File:{' '}
              <span className="text-slate-200">
                {healthLoading ? '...' : String(Boolean(health?.ml_model_present))}
              </span>
            </div>
            <div>
              Gemini API Key:{' '}
              <span className="text-slate-200">
                {healthLoading
                  ? '...'
                  : health?.gemini_configured
                  ? 'configured (gemini)'
                  : 'not set (keyword_fallback)'}
              </span>
            </div>
            <div>
              Redis:{' '}
              <span className="text-slate-200">
                {healthLoading ? '...' : health?.redis ?? 'not_configured'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">5-Audience Multi-View Output</h3>
          <p className="text-slate-400 text-xs mb-3">
            Pure-function projections from one solved CP-SAT schedule for Master, Teacher, Student (with explicit breaks), Support Staff, and Canteen (labeled Estimates).
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>CSV, XLSX, PDF, PNG, JPG, JSON, HTML</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Credit-Hour Session Splitting</h3>
          <p className="text-slate-400 text-xs mb-3">
            Splits multi-credit courses into &le;2h weekly contact sessions across distinct days, protecting 12:00&ndash;14:00 lunch and enforcing teacher break gaps.
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <div>
              Solver Time Limit: <span className="text-slate-200 font-mono">5.0s default</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Timetable Runs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-bold text-base">Recent Schedules Generated</h3>
          </div>
          <Link
            href="/schedule"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
          >
            <span>Generate New</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentSchedules.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No timetables generated yet. Click &quot;Run Demo (12 Courses, Seed 42)&quot; or upload a CSV above.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {recentSchedules.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-3 rounded-lg transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-sm font-semibold text-white">Timetable #{item.id}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.generated_at).toLocaleString()} &bull;{' '}
                      {item.total_courses_scheduled} sessions
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">
                    {Number(item.solver_time_ms || 0).toFixed(1)} ms
                  </span>
                  <Link
                    href={`/schedule/${item.id}`}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  >
                    View Views &amp; Export
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
