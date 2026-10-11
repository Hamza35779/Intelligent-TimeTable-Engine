'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface MLStats {
  model_version: number;
  trained_on: string;
  training_samples: number;
  model_accuracy: number;
  train_accuracy?: number;
  last_retrain: string;
  next_retrain: string;
}

export function useML() {
  const [stats, setStats] = useState<MLStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ml/model-stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const triggerRetrain = async () => {
    setRetraining(true);
    try {
      const res = await fetch(`${API_BASE}/ml/retrain`, { method: 'POST' });
      if (res.ok) {
        setTimeout(() => fetchStats(), 1200);
      }
    } finally {
      setRetraining(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, retraining, fetchStats, triggerRetrain };
}
