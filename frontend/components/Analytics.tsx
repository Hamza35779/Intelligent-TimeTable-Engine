'use client';

import { Users, Building2, CheckCircle2, TrendingUp, Zap, Award } from 'lucide-react';

interface AnalyticsProps {
  analyticsData: {
    faculty_workload?: Record<string, any>;
    venue_utilization?: Record<string, any>;
    preference_satisfaction_percentage?: number;
    time_slot_fill_rate_percentage?: number;
    conflicts_resolved_count?: number;
    solver_efficiency?: {
      solver_time_ms?: number;
      courses_scheduled_per_second?: number;
    };
  };
}

export default function Analytics({ analyticsData }: AnalyticsProps) {
  const facultyWorkload = analyticsData.faculty_workload || {};
  const venueUtilization = analyticsData.venue_utilization || {};
  const prefPct = analyticsData.preference_satisfaction_percentage ?? 100.0;
  const fillPct = analyticsData.time_slot_fill_rate_percentage ?? 0.0;
  const conflictsResolved = analyticsData.conflicts_resolved_count ?? 0;
  const efficiency = analyticsData.solver_efficiency || {};

  // Average venue utilization
  const venueEntries = Object.values(venueUtilization);
  const avgUtilization =
    venueEntries.length > 0
      ? (
          venueEntries.reduce((acc: number, v: any) => acc + (v.utilization_percentage || 0), 0) /
          venueEntries.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Preference Satisfaction
            </span>
            <Award className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">{prefPct}%</div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, prefPct)}%` }}
            />
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block">Soft constraints honored</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Avg Venue Utilization
            </span>
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">{avgUtilization}%</div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(avgUtilization))}%` }}
            />
          </div>
          <span className="text-[11px] text-blue-400 mt-2 block">Room efficiency optimized</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Time Slot Fill Rate
            </span>
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">{fillPct}%</div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, fillPct)}%` }}
            />
          </div>
          <span className="text-[11px] text-cyan-400 mt-2 block">Grid capacity utilized</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Solver Velocity
            </span>
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {efficiency.courses_scheduled_per_second ?? conflictsResolved} <span className="text-sm font-sans font-normal text-slate-400">c/sec</span>
          </div>
          <div className="text-[11px] text-amber-400 mt-4 block">
            Time: {(efficiency.solver_time_ms ?? 0).toFixed(1)} ms
          </div>
        </div>
      </div>

      {/* Detailed breakdown: Workload & Venues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faculty Workload Chart/List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Faculty Workload Distribution</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">{Object.keys(facultyWorkload).length} Faculty</span>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {Object.entries(facultyWorkload).map(([fid, data]: [string, any]) => (
              <div key={fid} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">{data.name}</span>
                  <span className="text-emerald-400 font-mono font-bold">{data.total_hours} hrs / week</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (data.total_hours / 20) * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                  {Object.entries(data.hours_per_day || {}).map(([day, hrs]: [string, any]) => (
                    <span key={day} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {day}: <strong className="text-slate-300 font-mono">{hrs}h</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Venue Utilization Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Room Utilization Breakdown</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">{Object.keys(venueUtilization).length} Venues</span>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {Object.entries(venueUtilization).map(([vid, data]: [string, any]) => (
              <div key={vid} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">{data.name}</span>
                  <span className="text-blue-400 font-mono font-bold">{data.utilization_percentage}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full"
                    style={{ width: `${Math.min(100, data.utilization_percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Slots booked: {data.total_slots_booked}</span>
                  <span>Total capacity: {data.total_available_slots}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
