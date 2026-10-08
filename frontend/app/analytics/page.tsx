'use client';

import { useEffect, useState } from 'react';
import Analytics from '../../components/Analytics';
import { BarChart3, Calendar, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/schedules`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setSchedules(data);
        if (data.length > 0) {
          setSelectedScheduleId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      setLoading(true);
      fetch(`${API_BASE}/analytics/schedule/${selectedScheduleId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setAnalyticsData(data);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedScheduleId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <span>Optimization Analytics & Insights</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Real-time statistics on faculty workload balance, room capacity utilization, and constraint satisfaction.
          </p>
        </div>

        {schedules.length > 0 && (
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedScheduleId || ''}
              onChange={(e) => setSelectedScheduleId(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  Timetable #{s.id} ({s.total_courses_scheduled} courses)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs">Calculating metrics...</span>
        </div>
      ) : analyticsData ? (
        <Analytics analyticsData={analyticsData} />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No schedules available for analytics. Generate a schedule first to view live optimization insights.
        </div>
      )}
    </div>
  );
}
