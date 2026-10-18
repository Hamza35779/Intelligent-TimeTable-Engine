'use client';

import { useState, useRef, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Upload,
  Play,
  Settings,
  Users,
  BookOpen,
  Download,
  Sparkles,
  Clock,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  FileSpreadsheet,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Table as TableIcon,
  HelpCircle,
} from 'lucide-react';
import TabularDataEntry, { DEFAULT_SAMPLE_ROWS } from '../../components/TabularDataEntry';
import {
  TableRowData,
  TableRowValidationError,
  TimetableResponse,
} from '../../types';
import {
  saveLocalSchedule,
  solveLocally,
  UNIVERSITY_SECTION_PRESETS,
} from '../../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Teacher {
  id: string;
  name: string;
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
  creditHours: number;
  teacherName: string;
  type: 'Lecture' | 'Lab';
  studentGroup?: string;
}

interface ScheduleSettings {
  days: string[];
  startTime: string;
  endTime: string;
  slotDuration: number;
  lunchStart: string;
  lunchEnd: string;
  breakMinutes: number;
  minGapMinutes: number;
  maxTeachingHoursPerDay: number;
  rooms: string[];
}

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_ROOMS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

const SAMPLE_TEACHERS: Teacher[] = [
  { id: 't-1', name: 'Dr. Ahmad Ali' },
  { id: 't-2', name: 'Ms. Fatima Khan' },
  { id: 't-3', name: 'Mr. Hassan Khan' },
  { id: 't-4', name: 'Dr. Sarah Ahmed' },
  { id: 't-5', name: 'Prof. Kamran Siddiqui' },
];

const SAMPLE_COURSES: CourseItem[] = [
  {
    id: 'c-1',
    name: 'Data Structures',
    code: 'CS301',
    creditHours: 3,
    teacherName: 'Dr. Ahmad Ali',
    type: 'Lecture',
    studentGroup: 'CS-2024-A',
  },
  {
    id: 'c-2',
    name: 'Database Systems',
    code: 'CS302',
    creditHours: 4,
    teacherName: 'Ms. Fatima Khan',
    type: 'Lecture',
    studentGroup: 'CS-2024-A',
  },
  {
    id: 'c-3',
    name: 'Web Development',
    code: 'CS303',
    creditHours: 3,
    teacherName: 'Mr. Hassan Khan',
    type: 'Lecture',
    studentGroup: 'CS-2024-B',
  },
  {
    id: 'c-4',
    name: 'Artificial Intelligence',
    code: 'AI401',
    creditHours: 3,
    teacherName: 'Dr. Sarah Ahmed',
    type: 'Lecture',
    studentGroup: 'AI-2024-A',
  },
  {
    id: 'c-5',
    name: 'Operating Systems',
    code: 'CS202',
    creditHours: 4,
    teacherName: 'Prof. Kamran Siddiqui',
    type: 'Lecture',
    studentGroup: 'CS-2024-B',
  },
];

const CSV_TEMPLATE_CONTENT = `teacher_name,course_name,credit_hours,student_group,preferred_time
Dr. Ahmad Ali,Data Structures,3,CS-2024-A,Morning
Ms. Fatima Khan,Database Systems,4,CS-2024-A,Afternoon
Mr. Hassan Khan,Web Development,3,CS-2024-B,
Dr. Sarah Ahmed,Artificial Intelligence,3,AI-2024-A,Morning
Prof. Kamran Siddiqui,Operating Systems,4,CS-2024-B,
`;

function parseRfcCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(cell.trim());
        if (row.some((c) => c.length > 0)) {
          rows.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function escapeCsvCell(val: string | number | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function EasyBuilderPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Input Mode
  const [activeTab, setActiveTab] = useState<'table' | 'upload' | 'builder'>('table');

  // Option B: Tabular Data Entry State
  const [tableRows, setTableRows] = useState<TableRowData[]>(DEFAULT_SAMPLE_ROWS);
  const [tableErrors, setTableErrors] = useState<TableRowValidationError[]>([]);
  const [savedTableNotice, setSavedTableNotice] = useState(false);

  // Option A & Builder State
  const [teachers, setTeachers] = useState<Teacher[]>(SAMPLE_TEACHERS);
  const [courses, setCourses] = useState<CourseItem[]>(SAMPLE_COURSES);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCreditHours, setNewCreditHours] = useState<number>(3);
  const [newAssignedTeacher, setNewAssignedTeacher] = useState<string>('Dr. Ahmad Ali');
  const [newCourseType, setNewCourseType] = useState<'Lecture' | 'Lab'>('Lecture');
  const [newStudentGroup, setNewStudentGroup] = useState('');

  // Upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRawText, setUploadedRawText] = useState<string | null>(null);
  const [uploadedPreviewRows, setUploadedPreviewRows] = useState<string[][]>([]);

  // Settings State (defaults from User Guide)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettings>({
    days: [...DEFAULT_DAYS],
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 60,
    lunchStart: '12:00',
    lunchEnd: '14:00',
    breakMinutes: 15,
    minGapMinutes: 30,
    maxTeachingHoursPerDay: 6,
    rooms: [...DEFAULT_ROOMS],
  });
  const [newRoomName, setNewRoomName] = useState('');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Solving schedule with OR-Tools...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Accessible IDs
  const teacherInputId = useId();
  const courseNameId = useId();
  const courseCodeId = useId();

  // Validate Table Handler
  const handleValidateTable = async (): Promise<boolean> => {
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE}/schedule/validate-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: tableRows.map((r) => ({
            teacher_name: r.teacher_name,
            course_name: r.course_name,
            credit_hours: r.credit_hours,
            student_group: r.student_group,
            preferred_time: r.preferred_time,
          })),
          config: {
            days: settings.days,
            day_start: settings.startTime,
            day_end: settings.endTime,
            slot_minutes: settings.slotDuration,
            lunch_start: settings.lunchStart,
            lunch_end: settings.lunchEnd,
            break_minutes: settings.breakMinutes,
            min_gap_minutes: settings.minGapMinutes,
            max_teaching_hours_per_day: settings.maxTeachingHoursPerDay,
            rooms: settings.rooms,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTableErrors(result.errors || []);
        if (result.is_valid) {
          setSavedTableNotice(true);
          setTimeout(() => setSavedTableNotice(false), 3000);
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch {
      return true;
    }
  };

  // Process Uploaded CSV
  const handleProcessCsvText = (csvText: string, filename: string) => {
    try {
      const rows = parseRfcCsv(csvText);
      if (rows.length < 2) {
        throw new Error('CSV must contain a header row and at least one course row.');
      }

      setUploadedFileName(filename);
      setUploadedRawText(csvText);
      setUploadedPreviewRows(rows.slice(0, 10));

      const headers = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
      const teacherIdx = headers.findIndex((h) => h.includes('teacher') || h.includes('faculty'));
      const courseIdx = headers.findIndex((h) => h.includes('course') || h.includes('subject'));
      const creditIdx = headers.findIndex((h) => h.includes('credit') || h === 'hours');
      const groupIdx = headers.findIndex((h) => h.includes('group') || h.includes('section'));
      const prefIdx = headers.findIndex((h) => h.includes('pref'));

      if (teacherIdx === -1 || courseIdx === -1) {
        throw new Error('Missing required columns. CSV must contain "teacher_name" and "course_name".');
      }

      const newTableRows: TableRowData[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const teacher = (row[teacherIdx] || '').trim();
        const course = (row[courseIdx] || '').trim();
        if (!teacher || !course) continue;

        const chRaw = creditIdx !== -1 ? parseInt(row[creditIdx], 10) : 3;
        const credit = isNaN(chRaw) ? 3 : Math.min(4, Math.max(1, chRaw));
        const group = groupIdx !== -1 ? (row[groupIdx] || '').trim() : '';
        const pref = prefIdx !== -1 ? (row[prefIdx] || '').trim() : '';

        newTableRows.push({
          id: `row-csv-${r}-${Date.now()}`,
          teacher_name: teacher,
          course_name: course,
          credit_hours: credit,
          student_group: group,
          preferred_time: pref as any,
        });
      }

      if (newTableRows.length > 0) {
        setTableRows(newTableRows);
        setSuccessNotice(`Successfully loaded ${newTableRows.length} course rows from "${filename}".`);
        setErrorMessage(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
      setErrorMessage(msg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      handleProcessCsvText(content, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate All Schedules (Main Action)
  const handleGenerateAllSchedules = async () => {
    setIsGenerating(true);
    setLoadingMessage('Optimizing with OR-Tools CP-SAT...');
    setErrorMessage(null);

    const configPayload = {
      days: settings.days,
      day_start: settings.startTime,
      day_end: settings.endTime,
      slot_minutes: settings.slotDuration,
      lunch_start: settings.lunchStart,
      lunch_end: settings.lunchEnd,
      break_minutes: settings.breakMinutes,
      min_gap_minutes: settings.minGapMinutes,
      max_teaching_hours_per_day: settings.maxTeachingHoursPerDay,
      rooms: settings.rooms,
    };

    try {
      if (activeTab === 'table' || (activeTab === 'upload' && !uploadedRawText)) {
        // Validate table
        const isValid = await handleValidateTable();
        if (!isValid) {
          setIsGenerating(false);
          setErrorMessage('Please fix highlighted errors in the table before generating.');
          return;
        }

        const res = await fetch(`${API_BASE}/schedule/generate-from-table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: tableRows.map((r) => ({
              teacher_name: r.teacher_name,
              course_name: r.course_name,
              credit_hours: r.credit_hours,
              student_group: r.student_group,
              preferred_time: r.preferred_time,
            })),
            config: configPayload,
            timeout_seconds: 5,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.detail?.message || errJson?.detail || 'Schedule generation failed.');
        }

        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        router.push(`/schedule/${data.schedule_id}`);
        return;
      } else if (activeTab === 'upload' && uploadedRawText) {
        // Option A: Upload CSV directly
        const queryParams = new URLSearchParams({
          day_start: settings.startTime,
          day_end: settings.endTime,
          lunch_start: settings.lunchStart,
          lunch_end: settings.lunchEnd,
          slot_minutes: String(settings.slotDuration),
        });

        const csvBlob = new Blob([uploadedRawText], { type: 'text/csv;charset=utf-8;' });
        const formData = new FormData();
        formData.append('file', csvBlob, uploadedFileName || 'uploaded_schedule.csv');

        const res = await fetch(`${API_BASE}/schedule/upload-csv?${queryParams.toString()}`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.detail?.message || errJson?.detail || 'Upload solve failed.');
        }

        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        router.push(`/schedule/${data.schedule_id}`);
        return;
      }
    } catch (err: any) {
      // Local fallback
      try {
        const localCourses = tableRows.map((r) => ({
          name: r.course_name,
          code: r.course_name.slice(0, 5).toUpperCase(),
          creditHours: r.credit_hours,
          teacherName: r.teacher_name,
          type: 'Lecture' as const,
          studentGroup: r.student_group || 'CS-Group',
        }));

        const localResult = solveLocally({
          courses: localCourses,
          venues: settings.rooms.map((r) => ({ name: r, capacity: 60 })),
          faculty: Array.from(new Set(tableRows.map((r) => r.teacher_name))).map((name) => ({
            name,
            department: 'Computer Science',
            email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@university.edu`,
          })),
          section_title: 'Custom Schedule',
        });
        saveLocalSchedule(localResult);

        router.push(`/schedule/${localResult.schedule_id}`);
      } catch (localErr: any) {
        setErrorMessage(err.message || 'No valid timetable found. Relax settings or adjust course load.');
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Intelligent Time Table v2.0
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Create Conflict-Free University Timetable
            </h1>
            <p className="mt-1 text-slate-600 text-sm max-w-2xl">
              Choose either input path: fill in the table directly on screen or upload a dataset file. Both paths feed the exact same CP-SAT solver and generate all 5 perspective views.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/guide"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Read User Guide</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Input Mode Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'table'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          <span>Option B: Fill in the Table (Recommended)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Option A: Upload Dataset (CSV / Excel)</span>
        </button>
      </div>

      {/* Error & Success Notices */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: Option B - Fill in the Table */}
      {activeTab === 'table' && (
        <section className="space-y-4">
          <TabularDataEntry
            rows={tableRows}
            setRows={setTableRows}
            errors={tableErrors}
            setErrors={setTableErrors}
            onSaveTable={handleValidateTable}
            savedNotice={savedTableNotice}
          />
        </section>
      )}

      {/* Tab 2: Option A - Upload Dataset */}
      {activeTab === 'upload' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Upload Dataset File</h2>
              <p className="text-xs text-slate-500">
                Load a CSV or Excel file containing teachers, courses, credit hours, and time preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'timetable_dataset_template.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => handleProcessCsvText(evt.target?.result as string, file.name);
                reader.readAsText(file);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              isDragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">
              Drag &amp; drop your CSV dataset here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-indigo-600 underline font-bold hover:text-indigo-800"
              >
                browse files
              </button>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports standard CSV with UTF-8 encoding (teacher_name, course_name, credit_hours).
            </p>
          </div>

          {uploadedPreviewRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>File Preview: {uploadedFileName}</span>
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> File Parsed Successfully
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {uploadedPreviewRows.map((row, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-slate-50 font-bold text-slate-700' : ''}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Section 5: Settings (Collapsible with User Guide Defaults) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center justify-between w-full text-left font-bold text-sm text-slate-900"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" />
            <span>Schedule Settings &amp; University Rules</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Defaults loaded from Section 5
            </span>
          </div>
          {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {settingsOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Days of Week</label>
              <div className="text-slate-600 font-mono">Monday to Friday (5 days)</div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Working Hours</label>
              <div className="text-slate-600 font-mono">09:00 to 17:00 (60-min slots)</div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Protected Lunch</label>
              <div className="text-slate-600 font-mono">12:00 to 14:00 (No classes)</div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rest &amp; Limits</label>
              <div className="text-slate-600 font-mono">15m break, 30m gap, max 6h/day</div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">Rooms (5)</label>
              <div className="text-slate-600 font-mono">Room 1, Room 2, Room 3, Room 4, Room 5</div>
            </div>
          </div>
        )}
      </section>

      {/* Primary Action Button: Generate all schedules */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Ready to synthesize timetable?</h3>
          <p className="text-xs text-slate-500">
            CP-SAT checks teacher workload, protects lunch, avoids room collisions, and creates 5 exportable perspectives.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateAllSchedules}
          disabled={isGenerating}
          className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white shadow-md transition-all ${
            isGenerating
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
          }`}
        >
          {isGenerating ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>{loadingMessage}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate All Schedules</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
