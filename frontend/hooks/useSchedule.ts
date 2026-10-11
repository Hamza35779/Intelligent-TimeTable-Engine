'use client';

import { useState } from 'react';
import { TimetableResponse, ScheduleRunDetail } from '../types';
import {
  solveLocally,
  saveLocalSchedule,
  getLocalSchedule,
} from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useSchedule() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<TimetableResponse | null>(null);

  const generateSchedule = async (payload: any): Promise<TimetableResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/schedule/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg =
          errorData.detail?.message || errorData.detail || 'Failed to generate timetable';
        throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
      }

      const data: TimetableResponse = await response.json();
      saveLocalSchedule(data);
      setCurrentSchedule(data);
      return data;
    } catch (err: any) {
      // If backend server is unreachable, seamlessly solve in-browser
      if (err instanceof TypeError || String(err.message).includes('fetch')) {
        const localData = solveLocally(payload);
        setCurrentSchedule(localData);
        return localData;
      }
      setError(err.message || 'An unexpected error occurred during scheduling');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const rescheduleConflicts = async (payload: any): Promise<TimetableResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/schedule/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.detail?.message || errorData.detail || 'Rescheduling failed';
        throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
      }

      const data: TimetableResponse = await response.json();
      saveLocalSchedule(data);
      setCurrentSchedule(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Rescheduling encountered an error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getScheduleById = async (id: number): Promise<ScheduleRunDetail | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/schedule/${id}`);
      if (!response.ok) {
        throw new Error(`Schedule ${id} not found`);
      }
      return await response.json();
    } catch (err: any) {
      const local = getLocalSchedule(id);
      if (local) {
        return {
          id: local.schedule_id,
          generated_at: local.generated_at,
          status: local.status,
          solver_status: local.stats.status,
          solver_time_ms: local.stats.solver_time_ms,
          total_time_ms: local.stats.total_time_ms,
          total_courses_scheduled: local.stats.total_courses_scheduled,
          conflict_count: local.stats.conflict_count,
          conflicts_resolved: local.stats.conflicts_resolved,
          metrics: local.analytics || {},
          entries: local.schedule,
        };
      }
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    currentSchedule,
    setCurrentSchedule,
    generateSchedule,
    rescheduleConflicts,
    getScheduleById,
  };
}
