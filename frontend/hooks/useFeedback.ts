'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface FeedbackPayload {
  teacher_id?: number;
  teacher_name?: string;
  satisfaction_score: number;
  preferred_time: string;
  avoid_time?: string;
  workload_satisfaction: number;
  comments?: string;
}

export function useFeedback() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async (scheduleId: number, payload: FeedbackPayload) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/feedback/${scheduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitFeedback, submitting, error };
}
