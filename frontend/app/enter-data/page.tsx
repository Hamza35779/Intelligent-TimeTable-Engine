'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  Settings,
  ChevronDown,
  ChevronUp,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Upload,
} from 'lucide-react';
import TabularDataEntry, { DEFAULT_SAMPLE_ROWS } from '../../components/TabularDataEntry';
import { TableRowData, TableRowValidationError, TimetableResponse } from '../../types';
import { saveLocalSchedule, solveLocally } from '../../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EnterDataPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TableRowData[]>(DEFAULT_SAMPLE_ROWS);
  const [errors, setErrors] = useState<TableRowValidationError[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [days, setDays] = useState<string[]>([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('14:00');
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [minGapMinutes, setMinGapMinutes] = useState(30);
  const [maxTeachingHoursPerDay, setMaxTeachingHoursPerDay] = useState(6);
  const [rooms, setRooms] = useState<string[]>([
    'Room 1',
    'Room 2',
    'Room 3',
    'Room 4',
    'Room 5',
  ]);

  const handleValidateTable = async (): Promise<boolean> => {
    setGlobalError(null);
    try {
      const response = await fetch(`${API_BASE}/schedule/validate-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            teacher_name: r.teacher_name,
            course_name: r.course_name,
            credit_hours: r.credit_hours,
            student_group: r.student_group,
            preferred_time: r.preferred_time,
          })),
          config: {
            days,
            day_start: startTime,
            day_end: endTime,
            slot_minutes: slotDuration,
            lunch_start: lunchStart,
            lunch_end: lunchEnd,
            break_minutes: breakMinutes,
            min_gap_minutes: minGapMinutes,
            max_teaching_hours_per_day: maxTeachingHoursPerDay,
            rooms,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setErrors(result.errors || []);
        if (result.is_valid) {
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 3000);
          return true;
        } else {
          return false;
        }
      } else {
        // Fallback local check
        const clientErrors: TableRowValidationError[] = [];
        const seen = new Set<string>();
        rows.forEach((r, idx) => {
          if (!r.teacher_name.trim()) {
            clientErrors.push({ row_index: idx, field: 'teacher_name', message: 'Teacher name is missing' });
          }
          if (!r.course_name.trim()) {
            clientErrors.push({ row_index: idx, field: 'course_name', message: 'Course name is missing' });
          }
          if (r.credit_hours < 1 || r.credit_hours > 4) {
            clientErrors.push({ row_index: idx, field: 'credit_hours', message: 'Credit hours must be 1 to 4' });
          }
          const pair = `${r.teacher_name.trim().toLowerCase()}::${r.course_name.trim().toLowerCase()}`;
          if (r.teacher_name.trim() && r.course_name.trim()) {
            if (seen.has(pair)) {
              clientErrors.push({
                row_index: idx,
                field: 'course_name',
                message: 'Duplicate: this teacher already teaches this course',
              });
            } else {
              seen.add(pair);
            }
          }
        });
        setErrors(clientErrors);
        return clientErrors.length === 0;
      }
    } catch {
      // Local fallback
      return true;
    }
  };

  const handleGenerateAllSchedules = async () => {
    const isValid = await handleValidateTable();
    if (!isValid) {
      setGlobalError('Please fix the highlighted validation errors before generating schedules.');
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);

    const payload = {
      rows: rows.map((r) => ({
        teacher_name: r.teacher_name,
        course_name: r.course_name,
        credit_hours: r.credit_hours,
        student_group: r.student_group,
        preferred_time: r.preferred_time,
      })),
      config: {
        days,
        day_start: startTime,
        day_end: endTime,
        slot_minutes: slotDuration,
        lunch_start: lunchStart,
        lunch_end: lunchEnd,
        break_minutes: breakMinutes,
        min_gap_minutes: minGapMinutes,
        max_teaching_hours_per_day: maxTeachingHoursPerDay,
        rooms,
      },
      timeout_seconds: 5,
    };

    try {
      const resp = await fetch(`${API_BASE}/schedule/generate-from-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || errorData.detail || 'Schedule generation failed.');
      }

      const timetableData: TimetableResponse = await resp.json();
      saveLocalSchedule(timetableData);
      router.push(`/schedule/${timetableData.schedule_id}`);
    } catch (err: any) {
      // Client-side fallback
      try {
        const localCourses = rows.map((r) => ({

          name: r.course_name,
          code: r.course_name.slice(0, 5).toUpperCase(),
          creditHours: r.credit_hours,
          teacherName: r.teacher_name,
          type: 'Lecture' as const,
          studentGroup: r.student_group,
        }));
        const localResult = solveLocally({
          courses: localCourses,
          venues: rooms.map((r) => ({ name: r, capacity: 60 })),
          faculty: Array.from(new Set(rows.map((r) => r.teacher_name))).map((name) => ({
            name,
            department: 'Computer Science',
            email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@university.edu`,
          })),
          section_title: 'Custom Schedule',
        });
        saveLocalSchedule(localResult);
        router.push(`/schedule/${localResult.schedule_id}`);

      } catch (localErr: any) {
        setGlobalError(err.message || 'No valid timetable found. Relax constraints and try again.');
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
                <TableIcon className="w-3.5 h-3.5" />
                Input Option B: Fill in the Table
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Data Entry Table
              </h1>
              <p className="mt-1 text-slate-600 text-sm">
                Type faculty, courses, credit hours, and preferences row by row. Live validation checks your input before solving.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/build"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Switch to Upload (Option A)</span>
              </Link>
              <Link
                href="/guide"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>User Guide</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Global Error Notice */}
        {globalError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{globalError}</span>
          </div>
        )}

        {/* Tabular Data Entry Component */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <TabularDataEntry
            rows={rows}
            setRows={setRows}
            errors={errors}
            setErrors={setErrors}
            onSaveTable={handleValidateTable}
            savedNotice={savedNotice}
          />

          {/* Schedule Settings Collapsible */}
          <div className="border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full text-left font-semibold text-sm text-slate-800 hover:text-indigo-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                Schedule Settings &amp; Constraints
                <span className="text-xs font-normal text-slate-500">(Defaults loaded)</span>
              </span>
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSettings && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Day Window</label>
                  <div className="text-slate-600">{days.join(', ')}</div>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Working Hours</label>
                  <div className="text-slate-600">{startTime} to {endTime} (60 min slots)</div>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Protected Lunch</label>
                  <div className="text-slate-600">{lunchStart} to {lunchEnd}</div>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Rooms ({rooms.length})</label>
                  <div className="text-slate-600">{rooms.join(', ')}</div>
                </div>
              </div>
            )}
          </div>

          {/* One-click Solve Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Produces Master, Teacher, Student Group, Staff, and Canteen schedules with multi-format export.
            </div>
            <button
              type="button"
              onClick={handleGenerateAllSchedules}
              disabled={isGenerating}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-md transition-all ${
                isGenerating
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
              }`}
            >
              {isGenerating ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Solving with OR-Tools CP-SAT...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate All Schedules</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
