'use client';

import { useState, useEffect } from 'react';
import { CustomConstraint } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const DEFAULT_CONSTRAINTS: CustomConstraint[] = [
  {
    id: 1,
    type: 'hard',
    name: 'No Overlapping Faculty or Venue Slots',
    description: 'Strict zero-conflict enforcement across Slots 1–9 (08:30–16:00)',
    weight: 10,
  },
  {
    id: 2,
    type: 'hard',
    name: '3-Consecutive Slot Lab Block',
    description: '1 CH Lab courses span 3 consecutive 50-minute slots (e.g., Slots 1–3 or Slots 7–9)',
    weight: 10,
  },
  {
    id: 3,
    type: 'soft',
    name: 'ML Teacher Morning/Afternoon Preference',
    description: 'Weight slots using Random Forest predicted faculty time preferences',
    weight: 8,
  },
];

export function useConstraints() {
  const [constraints, setConstraints] = useState<CustomConstraint[]>(DEFAULT_CONSTRAINTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConstraints = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      const res = await fetch(`${API_BASE}/constraints`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setConstraints(data);
        }
      }
    } catch {
      clearTimeout(timer);
    } finally {
      setLoading(false);
    }
  };

  const createConstraint = async (payload: Omit<CustomConstraint, 'id'>) => {
    const newItem: CustomConstraint = { ...payload, id: Date.now() };
    setConstraints((prev) => [newItem, ...prev]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      await fetch(`${API_BASE}/constraints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      clearTimeout(timer);
    }
    return true;
  };

  const deleteConstraint = async (id: number) => {
    setConstraints((prev) => prev.filter((c) => c.id !== id));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      await fetch(`${API_BASE}/constraints/${id}`, {
        method: 'DELETE',
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      clearTimeout(timer);
    }
    return true;
  };

  useEffect(() => {
    fetchConstraints();
  }, []);

  return {
    constraints,
    loading,
    error,
    refresh: fetchConstraints,
    createConstraint,
    deleteConstraint,
  };
}
