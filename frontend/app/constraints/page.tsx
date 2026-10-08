'use client';

import Link from 'next/link';
import { useConstraints } from '../../hooks/useConstraints';
import { Sliders, Plus, Trash2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export default function ConstraintsListPage() {
  const { constraints, loading, deleteConstraint, refresh } = useConstraints();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>Optimization Constraints</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Configure hard guarantees (zero violations) and soft preference weights for the CP-SAT engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/constraints/create"
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Constraint</span>
          </Link>
        </div>
      </div>

      {/* Constraints Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {constraints.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Sliders className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-white font-semibold text-sm">No custom constraints configured</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Default mathematical guarantees (no double bookings, capacity limits, availability) are always actively enforced.
            </p>
            <Link
              href="/constraints/create"
              className="inline-flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Constraint</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {constraints.map((c) => (
              <div key={c.id} className="py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/20 px-3 rounded-xl transition">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        c.type === 'hard'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {c.type}
                    </span>
                    <h4 className="text-sm font-bold text-white">{c.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400">{c.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center gap-4">
                  {c.type === 'soft' && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                      Weight: {c.weight.toFixed(1)}x
                    </span>
                  )}
                  <button
                    onClick={() => c.id && deleteConstraint(c.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Delete constraint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
