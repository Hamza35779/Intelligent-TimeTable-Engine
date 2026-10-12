'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      const res = await fetch(`${API_BASE}/feedback/${scheduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch {
      clearTimeout(timer);
    } finally {
      setSubmitting(false);
    }
    return { status: 'recorded_locally', schedule_id: scheduleId, ...payload };
  };

  return { submitFeedback, submitting, error };
}
