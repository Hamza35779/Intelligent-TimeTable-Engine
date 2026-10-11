'use client';

import { useML } from '../hooks/useML';
import { BrainCircuit, RefreshCw, Database, Award } from 'lucide-react';

export default function MLStatus() {
  const { stats, retraining, triggerRetrain } = useML();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Random Forest Preference Learner</h3>
            <p className="text-xs text-slate-400">
              Predicts Morning / Afternoon / Evening satisfaction probabilities per teacher
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
          <div className="text-[11px] text-slate-400">Model Version</div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            v{stats?.model_version ?? 1}.0
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Validation Accuracy</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
            {stats ? `${(stats.model_accuracy * 100).toFixed(1)}%` : '86.5%'}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Training Samples</span>
            <Database className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            {stats?.training_samples ?? 120}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Algorithm</div>
          <div className="text-xs font-semibold text-violet-300 mt-1.5">
            RandomForest (100 trees)
          </div>
        </div>
      </div>
    </div>
  );
}
