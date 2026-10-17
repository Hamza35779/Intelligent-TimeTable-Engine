'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Database,
  Layers,
  LayoutGrid,
} from 'lucide-react';
import MetricsPanel from '../../../components/MetricsPanel';
import TimetableGrid from '../../../components/TimetableGrid';
import ExportOptions from '../../../components/ExportOptions';
import { TimetableEntry } from '../../../types';
import {
  getLocalSchedule,
  saveLocalSchedule,
  mapTimeToSlotIndex,
} from '../../../utils/localFallbackSolver';

interface ApiScheduleEntry {
  course_name: string;
  course_code: string;
  faculty_name: string;
  venue_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  credit_hours: number;
}

interface ScheduleDetail {
  id: number;
  generated_at: string;
  status: string;
  solver_status: string;
  solver_time_ms: number;
  total_courses_scheduled: number;
  entries: ApiScheduleEntry[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function mapToTimetableEntries(rawEntries: unknown[]): TimetableEntry[] {
  const facultyMap = new Map<string, number>();
  const venueMap = new Map<string, number>();
  const courseMap = new Map<string, number>();

  return rawEntries.map((raw, index) => {
    const item = raw as Partial<TimetableEntry> & Partial<ApiScheduleEntry>;
    const courseName = item.course_name || `Course ${index + 1}`;
    const courseCode = item.course_code || `C${index + 1}`;
    const facultyName = item.faculty_name || 'Faculty Member';
    const venueName = item.venue_name || 'Room 101';
    const dayOfWeek = item.day_of_week || 'Monday';
    const startTime = item.start_time || '08:30';
    const endTime = item.end_time || '09:20';
    const creditHours = item.credit_hours ?? 3;

    if (!facultyMap.has(facultyName)) {
      facultyMap.set(facultyName, facultyMap.size + 1);
    }
    if (!venueMap.has(venueName)) {
      venueMap.set(venueName, venueMap.size + 1);
    }
    if (!courseMap.has(courseCode)) {
      courseMap.set(courseCode, courseMap.size + 1);
    }

    return {
      id: item.id ?? index + 1,
      course_id: item.course_id ?? courseMap.get(courseCode) ?? index + 1,
      course_name: courseName,
      course_code: courseCode,
      faculty_id: item.faculty_id ?? facultyMap.get(facultyName) ?? index + 1,
      faculty_name: facultyName,
      venue_id: item.venue_id ?? venueMap.get(venueName) ?? index + 1,
      venue_name: venueName,
      slot_id: item.slot_id ?? mapTimeToSlotIndex(startTime),
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      credit_hours: creditHours,
      elective_compulsory: item.elective_compulsory,
      remarks: item.remarks,
    };
  });
}

export default function ScheduleDetailPage() {
  const params = useParams();
  const scheduleId = Number(params?.id);

  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'audience' | 'grid'>('audience');

  const fetchSchedule = useCallback(async () => {
    if (!scheduleId || isNaN(scheduleId)) {
      setError('Invalid schedule ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsFallback(false);

    try {
      const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Schedule #${scheduleId} not found on server (HTTP ${response.status})`);
      }

      const data: ScheduleDetail = await response.json();
      const mappedEntries = mapToTimetableEntries(data.entries || []);

      setSchedule(data);
      setEntries(mappedEntries);

      // Save to localStorage so components and exports can leverage cached schedule
      saveLocalSchedule({
        schedule_id: data.id,
        status: data.status,
        generated_at: data.generated_at,
        stats: {
          status: data.solver_status || 'OPTIMAL',
          solver_time_ms: data.solver_time_ms || 0,
          total_time_ms: data.solver_time_ms || 0,
          total_courses_scheduled: data.total_courses_scheduled || mappedEntries.length,
          total_courses_requested: data.total_courses_scheduled || mappedEntries.length,
          conflict_count: 0,
          conflicts_resolved: data.total_courses_scheduled || mappedEntries.length,
        },
        schedule: mappedEntries,
        analytics: {
          section_title: `Schedule #${data.id}`,
        },
      });
    } catch (err: unknown) {
      // Fall back to localStorage
      const local = getLocalSchedule(scheduleId);
      if (local && local.schedule && local.schedule.length > 0) {
        const localMapped = mapToTimetableEntries(local.schedule);
        const fallbackSchedule: ScheduleDetail = {
          id: local.schedule_id,
          generated_at: local.generated_at,
          status: local.status,
          solver_status: local.stats?.status || 'OPTIMAL',
          solver_time_ms: local.stats?.solver_time_ms || 0,
          total_courses_scheduled: local.stats?.total_courses_scheduled || localMapped.length,
          entries: localMapped.map((e) => ({
            course_name: e.course_name,
            course_code: e.course_code,
            faculty_name: e.faculty_name,
            venue_name: e.venue_name,
            day_of_week: e.day_of_week,
            start_time: e.start_time,
            end_time: e.end_time,
            credit_hours: e.credit_hours ?? 3,
          })),
        };
        setSchedule(fallbackSchedule);
        setEntries(localMapped);
        setIsFallback(true);
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch schedule';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Loading Schedule #{scheduleId}...</span>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to schedules</span>
        </Link>

        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Schedule Not Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {error || `Unable to locate timetable schedule with ID #${scheduleId}.`}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={fetchSchedule}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-full transition"
            >
              Try Again
            </button>
            <Link
              href="/schedule"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full transition shadow-sm"
            >
              Return to Schedules
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const solverStatusUpper = (schedule.solver_status || schedule.status || 'OPTIMAL').toUpperCase();
  const isOptimal = solverStatusUpper.includes('OPTIMAL');
  const isFeasible = solverStatusUpper.includes('FEASIBLE');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Back Link & View Tabs */}
      <div className="flex items-center justify-between">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to schedules</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('audience')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === 'audience'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Audience Views</span>
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === 'grid'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Official University Sheet</span>
          </button>
        </div>
      </div>

      {/* Schedule Header Card */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Timetable Run #{schedule.id}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Generated {new Date(schedule.generated_at).toLocaleString()}</span>
                  {isFallback && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <Database className="w-3 h-3" />
                      (offline local cache)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Badge & Key Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                isOptimal
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isFeasible
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{solverStatusUpper}</span>
            </div>

            {/* Courses Scheduled Count */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-500">Contact Sessions:</span>
              <span className="font-mono font-bold text-slate-900">
                {schedule.total_courses_scheduled}
              </span>
            </div>

            {/* Solver Time */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-500">CP-SAT Solve Time:</span>
              <span className="font-mono font-bold text-slate-900">
                {Number(schedule.solver_time_ms || 0).toFixed(1)} ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher: MetricsPanel handles Master View, Teacher View, Student View, etc. */}
      {activeTab === 'audience' && (
        <MetricsPanel
          scheduleId={schedule.id}
          entries={entries}
          analytics={{ section_title: `Schedule #${schedule.id}` }}
        />
      )}

      {/* Alternative Printable Official Sheet View */}
      {activeTab === 'grid' && (
        <TimetableGrid
          entries={entries}
          sectionTitle={`Schedule #${schedule.id}`}
          scheduleId={schedule.id}
        />
      )}

      {/* Export Section: Buttons for CSV, XLSX, PDF, JSON, HTML */}
      <div className="space-y-2 pt-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Download &amp; Export Formats
        </h2>
        <ExportOptions scheduleId={schedule.id} />
      </div>
    </div>
  );
}
