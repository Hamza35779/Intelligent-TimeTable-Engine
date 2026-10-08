'use client';

import { useState } from 'react';
import { CustomConstraint } from '../types';
import { Sliders, PlusCircle, Check } from 'lucide-react';

interface ConstraintFormProps {
  onSubmit: (data: Omit<CustomConstraint, 'id'>) => Promise<boolean>;
  onCancel?: () => void;
}

export default function ConstraintForm({ onSubmit, onCancel }: ConstraintFormProps) {
  const [type, setType] = useState<'hard' | 'soft'>('hard');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState(1.0);
  const [preferMorning, setPreferMorning] = useState(false);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const constraintData: Record<string, any> = {
      prefer_morning: preferMorning,
      max_hours_per_day: maxHoursPerDay,
    };

    const success = await onSubmit({
      type,
      name,
      description,
      weight: type === 'soft' ? weight : 1.0,
      constraint_data: constraintData,
    });

    setSubmitting(false);
    if (success) {
      setName('');
      setDescription('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <Sliders className="w-5 h-5 text-emerald-400" />
        <h3 className="text-white font-bold text-base">Create Timetable Constraint</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Constraint Type</label>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setType('hard')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                type === 'hard'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hard (Strict Rule)
            </button>
            <button
              type="button"
              onClick={() => setType('soft')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                type === 'soft'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Soft (Optimized Preference)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Constraint Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Morning Lecture Priority"
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief explanation of policy..."
          className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
        />
      </div>

      {type === 'soft' && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <label className="font-semibold text-slate-300">Optimization Weight (Penalty / Reward Factor)</label>
            <span className="font-mono text-emerald-400 font-bold">{weight.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !name}
          className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition"
        >
          <Check className="w-4 h-4" />
          <span>{submitting ? 'Saving...' : 'Save Constraint'}</span>
        </button>
      </div>
    </form>
  );
}
