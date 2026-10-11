'use client';

import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { MessageSquarePlus, Star, CheckCircle2, Sparkles } from 'lucide-react';

interface FeedbackFormProps {
  scheduleId: number;
  facultyNames?: string[];
  onFeedbackSubmitted?: () => void;
}

export default function FeedbackForm({
  scheduleId,
  facultyNames,
  onFeedbackSubmitted,
}: FeedbackFormProps) {
  const { submitFeedback, submitting, error } = useFeedback();
  const [teacherName, setTeacherName] = useState(
    facultyNames && facultyNames.length > 0 ? facultyNames[0] : 'Dr. Alan Turing'
  );
  const [satisfactionScore, setSatisfactionScore] = useState(5);
  const [preferredTime, setPreferredTime] = useState('Morning');
  const [avoidTime, setAvoidTime] = useState('Evening');
  const [workloadSatisfaction, setWorkloadSatisfaction] = useState(4);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submitFeedback(scheduleId, {
      teacher_id: 1,
      teacher_name: teacherName,
      satisfaction_score: satisfactionScore,
      preferred_time: preferredTime,
      avoid_time: avoidTime,
      workload_satisfaction: workloadSatisfaction,
      comments,
    });
    if (res) {
      setSubmitted(true);
      setComments('');
      if (onFeedbackSubmitted) onFeedbackSubmitted();
      setTimeout(() => setSubmitted(false), 5000);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <MessageSquarePlus className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-white font-bold text-base">Teacher Feedback & ML Preference Loop</h3>
            <p className="text-xs text-slate-400">
              Your feedback trains the Random Forest model to optimize future schedules
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Auto-Retrains ML
        </span>
      </div>

      {submitted && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            Feedback recorded! The Random Forest preference model has been queued for background retraining.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Teacher Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Faculty Member Name
          </label>
          <input
            type="text"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Q1: Overall Satisfaction (1-5) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Q1: Overall Schedule Satisfaction (1–5)
          </label>
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setSatisfactionScore(score)}
                className={`flex-1 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${
                  satisfactionScore >= score
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>{score}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Preferred Time */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Q2: Ideal Teaching Window
          </label>
          <select
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="Morning">Morning (8am – 12pm)</option>
            <option value="Afternoon">Afternoon (2pm – 5pm)</option>
            <option value="Evening">Evening (5pm – 7pm)</option>
          </select>
        </div>

        {/* Q3: Time to Avoid */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Q3: Time Slot to Avoid
          </label>
          <select
            value={avoidTime}
            onChange={(e) => setAvoidTime(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="Evening">Evening</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Morning">Morning</option>
            <option value="None">No Restriction</option>
          </select>
        </div>

        {/* Q4: Workload Satisfaction (1-5) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Q4: Workload Distribution Rating (1–5)
          </label>
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setWorkloadSatisfaction(score)}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                  workloadSatisfaction === score
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* Q5: Free Text Comments */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Q5: Additional Notes
          </label>
          <input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g., Prefer fewer gaps on Wednesdays"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition"
        >
          {submitting ? 'Submitting & Training...' : 'Submit Feedback & Update ML Model'}
        </button>
      </div>
    </form>
  );
}
