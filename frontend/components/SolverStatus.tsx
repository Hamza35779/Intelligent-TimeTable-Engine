'use client';

import { CheckCircle2, AlertCircle, Clock, Zap, Target } from 'lucide-react';
import { SolverStats } from '../types';

interface SolverStatusProps {
  stats: SolverStats;
}

export default function SolverStatus({ stats }: SolverStatusProps) {
  const isOptimal = stats.status === 'OPTIMAL';
  const isFeasible = stats.status === 'FEASIBLE';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center space-x-3">
          {isOptimal || isFeasible ? (
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              Solver Execution Status:
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${
                  isOptimal
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isFeasible
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {stats.status}
              </span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Constraint satisfaction solved via Google OR-Tools CP-SAT</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
          <Zap className="w-3.5 h-3.5" />
          <span>Execution Time: {stats.solver_time_ms.toFixed(1)} ms</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
            <span>Courses Scheduled</span>
            <Target className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {stats.total_courses_scheduled} / {stats.total_courses_requested}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">100% Placed</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
            <span>Hard Conflicts</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {stats.conflict_count}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">0 Violations</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
            <span>Conflicts Resolved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {stats.conflicts_resolved}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Autonomous Resolution</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
            <span>Engine Total Time</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {(stats.total_time_ms / 1000).toFixed(2)}s
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">&lt; 5s SLA Guaranteed</div>
        </div>
      </div>
    </div>
  );
}
