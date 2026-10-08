'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Calendar, Clock, CheckCircle2, ShieldCheck, Zap, ArrowRight, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HomePage() {
  const [health, setHealth] = useState<any>(null);
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
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
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Autonomous Constraint Optimization Engine</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Autonomous, conflict-free university timetabling in <span className="text-emerald-400">&lt;5 seconds</span>.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Formulates faculty availability, venue capacities, slot constraints, and departmental preferences into an exact CP-SAT integer programming model powered by Google OR-Tools.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href="/schedule"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Timetable Generator</span>
            </Link>
            <Link
              href="/constraints"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-700 transition"
            >
              <span>Manage Constraints</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Engine Status & Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Engine Health & Solver</h3>
          <p className="text-slate-400 text-xs mb-3">
            Status: <span className="text-emerald-400 font-mono font-bold">{health?.status || 'Online'}</span>
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <div>Solver: <span className="text-slate-200 font-mono">{health?.solver?.engine || 'Google OR-Tools CP-SAT'}</span></div>
            <div>Version: <span className="text-slate-200 font-mono">{health?.solver?.version || '9.9+'}</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Zero-Conflict Guarantee</h3>
          <p className="text-slate-400 text-xs mb-3">
            100% satisfaction enforced for all hard constraints: double-bookings, capacities, and room availability.
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hard constraints mathematically proven</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Real-Time Rescheduling</h3>
          <p className="text-slate-400 text-xs mb-3">
            Autonomous delta re-computation preserves undisturbed schedules while resolving sudden emergencies.
          </p>
          <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <div>Response SLA: <span className="text-slate-200 font-mono">&lt; 5.0 seconds</span></div>
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
            No timetables generated yet. Click "Launch Timetable Generator" to create your first schedule.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {recentSchedules.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-3 rounded-lg transition">
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-sm font-semibold text-white">Timetable #{item.id}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.generated_at).toLocaleString()} &bull; {item.total_courses_scheduled} courses
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">{item.solver_time_ms.toFixed(1)} ms</span>
                  <Link
                    href={`/schedule/${item.id}`}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  >
                    View Grid
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
