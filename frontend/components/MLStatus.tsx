'use client';

import { useML } from '../hooks/useML';
import { BrainCircuit, RefreshCw, Database, Award, AlertCircle } from 'lucide-react';

export default function MLStatus() {
  const { stats, loading, retraining, triggerRetrain } = useML();

  const cvMean = stats?.cv_accuracy?.mean ?? stats?.model_accuracy;
  const cvStd = stats?.cv_accuracy?.std ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold text-sm">Random Forest Preference Learner</h3>
              {stats?.is_synthetic_training_data !== false && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {stats?.training_data_label || 'SYNTHETIC TRAINING DATA'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              6-feature classifier (Morning / Afternoon / Evening) &bull; Source:{' '}
              <span className="font-mono text-slate-200">
                {stats?.preference_source || (loading ? 'loading...' : 'unavailable')}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={triggerRetrain}
          disabled={retraining}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-xs font-semibold rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
          <span>{retraining ? 'Retraining...' : 'Retrain Model'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Model Status</div>
          <div className="text-sm font-bold text-white font-mono mt-1">
            {loading
              ? 'Checking...'
              : stats?.model_present
              ? `v${stats.model_version}.0 Ready`
              : 'Not Trained'}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>5-Fold CV Accuracy</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
            {loading
              ? '...'
              : cvMean !== undefined
              ? `${(cvMean * 100).toFixed(1)}% ± ${(cvStd * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Samples (Real / Synth)</span>
            <Database className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-sm font-bold text-white font-mono mt-1">
            {loading
              ? '...'
              : stats
              ? `${stats.n_samples} (${stats.n_real_samples}R / ${stats.n_synthetic_samples}S)`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Fallback Rule</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-[11px] font-mono text-slate-300 mt-1">
            {stats && stats.n_real_samples < 30
              ? '<30 real rows (synthetic/uniform)'
              : 'Real feedback active'}
          </div>
        </div>
      </div>
    </div>
  );
}
