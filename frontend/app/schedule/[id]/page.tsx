'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSchedule } from '../../../hooks/useSchedule';
import TimetableGrid from '../../../components/TimetableGrid';
import SolverStatus from '../../../components/SolverStatus';
import Analytics from '../../../components/Analytics';
import MetricsPanel from '../../../components/MetricsPanel';
import ExportOptions from '../../../components/ExportOptions';
import FeedbackForm from '../../../components/FeedbackForm';
import ChatBot from '../../../components/ChatBot';
import { ScheduleRunDetail } from '../../../types';
import { ArrowLeft, RefreshCw, AlertCircle, Calendar } from 'lucide-react';

export default function ViewScheduleDetailPage() {
  const params = useParams();
  const scheduleId = Number(params?.id);
  const { getScheduleById, loading, error } = useSchedule();
  const [scheduleData, setScheduleData] = useState<ScheduleRunDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'views' | 'grid' | 'export' | 'feedback' | 'analytics'>('views');

  useEffect(() => {
    if (scheduleId) {
      getScheduleById(scheduleId).then((data) => {
        if (data) setScheduleData(data);
      });
    }
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm">Loading Timetable #{scheduleId}...</span>
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </Link>
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-white font-bold">Timetable Not Found</h3>
          <p className="text-xs text-slate-400">{error || `No timetable found with ID ${scheduleId}.`}</p>
        </div>
      </div>
    );
  }

  const solverStats = {
    status: scheduleData.solver_status || scheduleData.status.toUpperCase(),
    solver_time_ms: scheduleData.solver_time_ms,
    total_time_ms: scheduleData.total_time_ms,
    total_courses_scheduled: scheduleData.total_courses_scheduled,
    total_courses_requested: scheduleData.total_courses_scheduled,
    conflict_count: scheduleData.conflict_count,
    conflicts_resolved: scheduleData.conflicts_resolved,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Timetable #{scheduleData.id}</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Generated: {new Date(scheduleData.generated_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'views', label: '5-Audience Multi-View' },
            { id: 'grid', label: 'Timetable Grid' },
            { id: 'export', label: 'Export (7 Formats)' },
            { id: 'feedback', label: 'Teacher Feedback' },
            { id: 'analytics', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <SolverStatus stats={solverStats} />

      {activeTab === 'views' && (
        <MetricsPanel
          scheduleId={scheduleData.id}
          analytics={scheduleData.metrics}
          conflictCount={scheduleData.conflict_count}
        />
      )}

      {activeTab === 'grid' && <TimetableGrid entries={scheduleData.entries} />}

      {activeTab === 'export' && <ExportOptions scheduleId={scheduleData.id} />}

      {activeTab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
            <FeedbackForm
              scheduleId={scheduleData.id}
              facultyNames={Array.from(new Set(scheduleData.entries.map((e) => e.faculty_name)))}
            />
          </div>
          <div className="lg:col-span-6">
            <ChatBot scheduleId={scheduleData.id} />
          </div>
        </div>
      )}

      {activeTab === 'analytics' && <Analytics analyticsData={scheduleData.metrics || {}} />}
    </div>
  );
}
