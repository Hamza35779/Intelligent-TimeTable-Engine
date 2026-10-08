'use client';

import { useState, useEffect } from 'react';
import { CustomConstraint } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useConstraints() {
  const [constraints, setConstraints] = useState<CustomConstraint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConstraints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/constraints`);
      if (!res.ok) throw new Error('Failed to fetch constraints');
      const data = await res.json();
      setConstraints(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createConstraint = async (payload: Omit<CustomConstraint, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/constraints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create constraint');
      await fetchConstraints();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteConstraint = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/constraints/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete constraint');
      setConstraints(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
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
