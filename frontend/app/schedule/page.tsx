'use client';

import { useState, useEffect } from 'react';
import { useSchedule } from '../../hooks/useSchedule';
import TimetableGrid from '../../components/TimetableGrid';
import SolverStatus from '../../components/SolverStatus';
import Analytics from '../../components/Analytics';
import CsvUploader from '../../components/CsvUploader';
import ChatBot from '../../components/ChatBot';
import MetricsPanel from '../../components/MetricsPanel';
import ExportOptions from '../../components/ExportOptions';
import FeedbackForm from '../../components/FeedbackForm';
import {
  UNIVERSITY_SECTION_PRESETS,
  solveLocally,
} from '../../utils/localFallbackSolver';
import { Sparkles, Play, RefreshCw, AlertTriangle, Layers, FileCode } from 'lucide-react';

const SAMPLE_BENCHMARK_DATA = UNIVERSITY_SECTION_PRESETS['AI 2023'];

export default function SchedulePage() {
  const {
    loading,
    error,
    currentSchedule,
    setCurrentSchedule,
    generateSchedule,
    rescheduleConflicts,
  } = useSchedule();
  const [selectedPresetName, setSelectedPresetName] = useState<string>('AI 2023');
  const [datasetJson, setDatasetJson] = useState(JSON.stringify(SAMPLE_BENCHMARK_DATA, null, 2));
  const [activeTab, setActiveTab] = useState<
    'views' | 'grid' | 'export' | 'feedback' | 'analytics' | 'editor'
  >('views');
  const [rescheduleSlotId, setRescheduleSlotId] = useState<number>(0);
  const [rescheduling, setRescheduling] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<number | undefined>(1);

  // Initialize with the AI 2023 University Sheet on first render so the user immediately sees the schedule
  useEffect(() => {
    if (!currentSchedule) {
      const initial = solveLocally(UNIVERSITY_SECTION_PRESETS['AI 2023']);
      setCurrentSchedule(initial);
      setActiveScheduleId(initial.schedule_id);
    }
  }, [currentSchedule, setCurrentSchedule]);

  const effectiveScheduleId = currentSchedule?.schedule_id || activeScheduleId || 1;

  const handleRunSolver = async () => {
    try {
      const parsedData = JSON.parse(datasetJson);
      const res = await generateSchedule(parsedData);
      if (res?.schedule_id) {
        setActiveScheduleId(res.schedule_id);
      }
      setActiveTab('views');
    } catch (err: any) {
      alert('Invalid JSON input: ' + err.message);
    }
  };

  const handleSelectSectionPreset = (sectionName: string) => {
    setSelectedPresetName(sectionName);
    const preset = UNIVERSITY_SECTION_PRESETS[sectionName] || SAMPLE_BENCHMARK_DATA;
    setDatasetJson(JSON.stringify(preset, null, 2));
    const generated = solveLocally(preset);
    setCurrentSchedule(generated);
    setActiveScheduleId(generated.schedule_id);
  };

  const handleTestReschedule = async () => {
    if (!currentSchedule) return;
    setRescheduling(true);
    try {
      await rescheduleConflicts({
        timetable_id: currentSchedule.schedule_id,
        unseated_slot_ids: [rescheduleSlotId],
        timeout_seconds: 5,
      });
      alert(`Rescheduled around conflict at slot ${rescheduleSlotId}. Minimal disruption applied.`);
    } catch (e: any) {
      alert('Reschedule error: ' + e.message);
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            <span>Autonomous Schedule & University Sheet Studio</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Official 9-Slot Horizontal University Timetable Sheets with Merged Lab/Lecture Spans & Course Legend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            <select
              value={selectedPresetName}
              onChange={(e) => handleSelectSectionPreset(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
            >
              {Object.keys(UNIVERSITY_SECTION_PRESETS).map((sec) => (
                <option key={sec} value={sec} className="bg-slate-900 text-white">
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunSolver}
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Solving Constraints...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Solve & Generate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Top Row: CSV Uploader + AI Chatbot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <CsvUploader
            onScheduleGenerated={(data) => {
              setCurrentSchedule(data);
              setActiveScheduleId(data.schedule_id);
              setActiveTab('views');
            }}
          />
        </div>
        <div className="lg:col-span-7">
          <ChatBot
            scheduleId={effectiveScheduleId}
            onScheduleGenerated={(data) => {
              setCurrentSchedule(data);
              setActiveScheduleId(data.schedule_id);
              setActiveTab('views');
            }}
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs flex items-center space-x-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div className="font-mono">{error}</div>
        </div>
      )}

      {/* Results View & Solver Status */}
      {effectiveScheduleId && (
        <div className="space-y-6">
          {currentSchedule && <SolverStatus stats={currentSchedule.stats} />}

          {/* Reschedule Simulation Toolbar */}
          {currentSchedule && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Real-Time Conflict Rescheduling:
                </span>
                <span className="text-xs text-slate-400">
                  Simulate room maintenance or unexpected slot cancellation
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={rescheduleSlotId}
                  onChange={(e) => setRescheduleSlotId(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value={0}>Simulate Slot #1 Outage (Monday 08:30-09:20)</option>
                  <option value={1}>Simulate Slot #2 Outage (Monday 09:20-10:10)</option>
                  <option value={4}>Simulate Slot #5 Outage (Tuesday 09:20-10:10)</option>
                </select>
                <button
                  onClick={handleTestReschedule}
                  disabled={rescheduling}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition"
                >
                  {rescheduling ? 'Rescheduling...' : 'Apply Delta Reschedule'}
                </button>
              </div>
            </div>
          )}

          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            {[
              { id: 'views', label: 'University Sheet & Multi-View' },
              { id: 'grid', label: 'Printable Official Sheet' },
              { id: 'export', label: 'Multi-Format Export (7 Formats)' },
              { id: 'feedback', label: 'Teacher Feedback & ML' },
              ...(currentSchedule ? [{ id: 'analytics', label: 'Optimization Analytics' }] : []),
              { id: 'editor', label: 'Raw JSON Config' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'views' && (
            <MetricsPanel
              scheduleId={effectiveScheduleId}
              analytics={currentSchedule?.analytics}
              conflictCount={currentSchedule?.stats?.conflict_count ?? 0}
            />
          )}

          {activeTab === 'export' && <ExportOptions scheduleId={effectiveScheduleId} />}

          {activeTab === 'feedback' && <FeedbackForm scheduleId={effectiveScheduleId} />}

          {activeTab === 'grid' && currentSchedule && (
            <TimetableGrid
              entries={currentSchedule.schedule}
              sectionTitle={currentSchedule.analytics?.section_title || selectedPresetName}
              scheduleId={effectiveScheduleId}
            />
          )}

          {activeTab === 'analytics' && currentSchedule?.analytics && (
            <Analytics analyticsData={currentSchedule.analytics} />
          )}

          {activeTab === 'editor' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <textarea
                value={datasetJson}
                onChange={(e) => setDatasetJson(e.target.value)}
                rows={18}
                className="w-full bg-slate-950 font-mono text-xs text-emerald-400/90 p-4 rounded-xl border border-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
