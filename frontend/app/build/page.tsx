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
} from 'lucide-react';
import { TimetableResponse } from '../../types';
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
  rooms: string[];
}

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_ROOMS = ['Room 101', 'Room 102', 'Room 201', 'Lab 1', 'Lab 2'];

const SAMPLE_TEACHERS: Teacher[] = [
  { id: 't-1', name: 'Dr. Sarah Ahmed' },
  { id: 't-2', name: 'Prof. Kamran Siddiqui' },
  { id: 't-3', name: 'Dr. Ayesha Tariq' },
  { id: 't-4', name: 'Mr. Bilal Raza' },
  { id: 't-5', name: 'Dr. Usman Farooq' },
  { id: 't-6', name: 'Ms. Hina Noor' },
];

const SAMPLE_COURSES: CourseItem[] = [
  {
    id: 'c-1',
    name: 'Artificial Intelligence',
    code: 'CS301',
    creditHours: 3,
    teacherName: 'Dr. Sarah Ahmed',
    type: 'Lecture',
    studentGroup: 'BS-AI-4A',
  },
  {
    id: 'c-2',
    name: 'Deep Learning Lab',
    code: 'CS405L',
    creditHours: 3,
    teacherName: 'Dr. Sarah Ahmed',
    type: 'Lab',
    studentGroup: 'BS-AI-6A',
  },
  {
    id: 'c-3',
    name: 'Operating Systems',
    code: 'CS202',
    creditHours: 4,
    teacherName: 'Prof. Kamran Siddiqui',
    type: 'Lecture',
    studentGroup: 'BS-CS-4A',
  },
  {
    id: 'c-4',
    name: 'Computer Networks',
    code: 'CS304',
    creditHours: 3,
    teacherName: 'Prof. Kamran Siddiqui',
    type: 'Lecture',
    studentGroup: 'BS-CS-6A',
  },
  {
    id: 'c-5',
    name: 'Database Systems',
    code: 'SE201',
    creditHours: 4,
    teacherName: 'Dr. Ayesha Tariq',
    type: 'Lecture',
    studentGroup: 'BS-SE-4A',
  },
  {
    id: 'c-6',
    name: 'Data Mining',
    code: 'AI402',
    creditHours: 2,
    teacherName: 'Dr. Ayesha Tariq',
    type: 'Lecture',
    studentGroup: 'BS-AI-6A',
  },
  {
    id: 'c-7',
    name: 'Software Engineering',
    code: 'SE101',
    creditHours: 3,
    teacherName: 'Mr. Bilal Raza',
    type: 'Lecture',
    studentGroup: 'BS-SE-4A',
  },
  {
    id: 'c-8',
    name: 'Linear Algebra',
    code: 'MT102',
    creditHours: 3,
    teacherName: 'Dr. Usman Farooq',
    type: 'Lecture',
    studentGroup: 'BS-AI-4A',
  },
];

const CSV_TEMPLATE_CONTENT = `teacher_name,course_name,credit_hours,course_code,room_type,student_group
Dr. Sarah Ahmed,Artificial Intelligence,3,CS301,Lecture,BS-AI-4A
Dr. Sarah Ahmed,Deep Learning Lab,3,CS405L,Lab,BS-AI-6A
Prof. Kamran Siddiqui,Operating Systems,4,CS202,Lecture,BS-CS-4A
Prof. Kamran Siddiqui,Computer Networks,3,CS304,Lecture,BS-CS-6A
Dr. Ayesha Tariq,Database Systems,4,SE201,Lecture,BS-SE-4A
Dr. Ayesha Tariq,Data Mining,2,AI402,Lecture,BS-AI-6A
Mr. Bilal Raza,Software Engineering,3,SE101,Lecture,BS-SE-4A
Mr. Bilal Raza,Agile Development,2,SE302,Lecture,BS-SE-6A
Dr. Usman Farooq,Linear Algebra,3,MT102,Lecture,BS-AI-4A
Dr. Usman Farooq,Probability & Statistics,3,MT201,Lecture,BS-CS-4A
Ms. Hina Noor,Technical Writing,2,HU102,Lecture,BS-CS-6A
Ms. Hina Noor,Professional Ethics,2,HU201,Lecture,BS-SE-6A`;

// RFC 4180 compliant CSV parser to handle quoted commas, escaped quotes, and newlines
function parseRfcCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

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

  // Form State
  const [teachers, setTeachers] = useState<Teacher[]>(SAMPLE_TEACHERS);
  const [courses, setCourses] = useState<CourseItem[]>(SAMPLE_COURSES);

  // New Teacher Input
  const [newTeacherName, setNewTeacherName] = useState('');

  // New Course Inputs
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCreditHours, setNewCreditHours] = useState<number>(3);
  const [newAssignedTeacher, setNewAssignedTeacher] = useState<string>('Dr. Sarah Ahmed');
  const [newCourseType, setNewCourseType] = useState<'Lecture' | 'Lab'>('Lecture');
  const [newStudentGroup, setNewStudentGroup] = useState('');

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettings>({
    days: [...DEFAULT_DAYS],
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 50,
    lunchStart: '12:00',
    lunchEnd: '13:30',
    rooms: [...DEFAULT_ROOMS],
  });
  const [newRoomName, setNewRoomName] = useState('');

  // UI / Network State
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating Timetable...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Accessibility unique IDs
  const teacherInputId = useId();
  const courseNameId = useId();
  const courseCodeId = useId();
  const creditHoursId = useId();
  const teacherSelectId = useId();
  const courseTypeId = useId();
  const studentGroupId = useId();

  // Teacher Handlers
  const handleAddTeacher = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newTeacherName.trim();
    if (!name) return;

    if (teachers.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setErrorMessage(`Teacher "${name}" already exists.`);
      return;
    }

    const newT: Teacher = {
      id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
    };
    setTeachers((prev) => [...prev, newT]);
    setNewTeacherName('');
    setErrorMessage(null);

    // If no assigned teacher selected, select this one
    if (!newAssignedTeacher) {
      setNewAssignedTeacher(name);
    }
  };

  const handleRemoveTeacher = (id: string, name: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    // If deleted teacher was assigned to new course form, switch
    if (newAssignedTeacher === name) {
      const remaining = teachers.filter((t) => t.id !== id);
      setNewAssignedTeacher(remaining.length > 0 ? remaining[0].name : '');
    }
  };

  // Course Handlers
  const handleAddCourse = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cName = newCourseName.trim();
    if (!cName) {
      setErrorMessage('Please enter a course name.');
      return;
    }

    if (!newAssignedTeacher) {
      setErrorMessage('Please add and assign a teacher to this course.');
      return;
    }

    let code = newCourseCode.trim();
    if (!code) {
      // Auto-generate code from course name
      const words = cName.split(/\s+/).filter(Boolean);
      const prefix = words.map((w) => w[0].toUpperCase()).join('').substring(0, 3) || 'CRS';
      code = `${prefix}${200 + courses.length * 5}`;
    }

    const newC: CourseItem = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cName,
      code: code.toUpperCase(),
      creditHours: Number(newCreditHours),
      teacherName: newAssignedTeacher,
      type: newCourseType,
      studentGroup: newStudentGroup.trim() || undefined,
    };

    setCourses((prev) => [...prev, newC]);
    setNewCourseName('');
    setNewCourseCode('');
    setNewStudentGroup('');
    setErrorMessage(null);
  };

  const handleRemoveCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  // Schedule Settings Handlers
  const handleToggleDay = (day: string) => {
    setSettings((prev) => {
      const exists = prev.days.includes(day);
      if (exists) {
        if (prev.days.length <= 1) {
          setErrorMessage('At least one day must be selected.');
          return prev;
        }
        return { ...prev, days: prev.days.filter((d) => d !== day) };
      } else {
        return { ...prev, days: [...prev.days, day] };
      }
    });
  };

  const handleAddRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const room = newRoomName.trim();
    if (!room) return;
    if (settings.rooms.includes(room)) {
      setErrorMessage(`Room "${room}" is already in the list.`);
      return;
    }
    setSettings((prev) => ({ ...prev, rooms: [...prev.rooms, room] }));
    setNewRoomName('');
    setErrorMessage(null);
  };

  const handleRemoveRoom = (roomName: string) => {
    if (settings.rooms.length <= 1) {
      setErrorMessage('At least one room is required for scheduling.');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r !== roomName),
    }));
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable_builder_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // CSV Import
  const handleProcessCsvText = (csvText: string, filename: string) => {
    try {
      const rows = parseRfcCsv(csvText);
      if (rows.length < 2) {
        throw new Error('CSV must contain a header row and at least one course row.');
      }

      const headers = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
      const teacherIdx = headers.findIndex(
        (h) => h.includes('teacher') || h.includes('faculty') || h.includes('instructor')
      );
      const courseIdx = headers.findIndex(
        (h) => h.includes('course') || h.includes('subject') || h === 'title' || h === 'name'
      );
      const creditIdx = headers.findIndex(
        (h) => h.includes('credit') || h === 'hours' || h === 'chs'
      );
      const codeIdx = headers.findIndex((h) => h.includes('code'));
      const typeIdx = headers.findIndex((h) => h.includes('type'));
      const groupIdx = headers.findIndex((h) => h.includes('group') || h.includes('section'));

      if (teacherIdx === -1 || courseIdx === -1) {
        throw new Error(
          'Missing required columns. CSV must contain at least "teacher_name" and "course_name".'
        );
      }

      const newTeacherSet = new Set<string>();
      const parsedCourses: CourseItem[] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const teacher = (row[teacherIdx] || '').trim();
        const courseName = (row[courseIdx] || '').trim();
        if (!teacher || !courseName) continue;

        newTeacherSet.add(teacher);

        const creditStr = creditIdx !== -1 ? row[creditIdx] : '3';
        const creditParsed = parseInt(creditStr, 10);
        const creditHours = isNaN(creditParsed) ? 3 : Math.min(6, Math.max(1, creditParsed));

        const rawType = (typeIdx !== -1 ? row[typeIdx] : '').toLowerCase();
        const type: 'Lecture' | 'Lab' =
          rawType.includes('lab') || courseName.toLowerCase().includes('lab')
            ? 'Lab'
            : 'Lecture';

        const codeVal =
          codeIdx !== -1 && row[codeIdx]?.trim()
            ? row[codeIdx].trim().toUpperCase()
            : `CS${200 + r * 5}${type === 'Lab' ? 'L' : ''}`;

        const groupVal = groupIdx !== -1 && row[groupIdx]?.trim() ? row[groupIdx].trim() : undefined;

        parsedCourses.push({
          id: `c-csv-${Date.now()}-${r}`,
          name: courseName,
          code: codeVal,
          creditHours,
          teacherName: teacher,
          type,
          studentGroup: groupVal,
        });
      }

      if (parsedCourses.length === 0) {
        throw new Error('No valid course rows found in the CSV.');
      }

      // Merge teachers
      const teacherObjects: Teacher[] = Array.from(newTeacherSet).map((name, i) => ({
        id: `t-csv-${Date.now()}-${i}`,
        name,
      }));

      setTeachers(teacherObjects);
      setCourses(parsedCourses);
      if (teacherObjects.length > 0) {
        setNewAssignedTeacher(teacherObjects[0].name);
      }

      setSuccessNotice(
        `Imported ${parsedCourses.length} courses and ${teacherObjects.length} faculty members from ${filename}.`
      );
      setErrorMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV';
      setErrorMessage(msg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) handleProcessCsvText(text, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) handleProcessCsvText(text, file.name);
      };
      reader.readAsText(file);
    } else {
      setErrorMessage('Please drop a valid .csv file.');
    }
  };

  // Reset / Sample Preset
  const handleReset = () => {
    setTeachers([]);
    setCourses([]);
    setNewAssignedTeacher('');
    setErrorMessage(null);
    setSuccessNotice('Cleared all teachers and courses.');
  };

  const handleLoadSample = () => {
    setTeachers(SAMPLE_TEACHERS);
    setCourses(SAMPLE_COURSES);
    setNewAssignedTeacher(SAMPLE_TEACHERS[0].name);
    setSettings({
      days: [...DEFAULT_DAYS],
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 50,
      lunchStart: '12:00',
      lunchEnd: '13:30',
      rooms: [...DEFAULT_ROOMS],
    });
    setErrorMessage(null);
    setSuccessNotice('Loaded university sample dataset with 6 teachers and 8 courses.');
  };

  // 1-Click "Try Demo"
  const handleTryDemo = async () => {
    setIsGenerating(true);
    setLoadingMessage('Initializing university benchmark demo run...');
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/demo/run`, {
        method: 'POST',
      });

      if (res.ok) {
        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        router.push(`/schedule/${data.schedule_id}`);
        return;
      }
    } catch {
      // Backend offline fallback
    }

    // Seamless instant fallback
    try {
      const demoData = UNIVERSITY_SECTION_PRESETS['AI 2023'];
      const localSchedule = solveLocally(demoData);
      saveLocalSchedule(localSchedule);
      router.push(`/schedule/${localSchedule.schedule_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Demo generation failed';
      setErrorMessage(msg);
      setIsGenerating(false);
    }
  };

  // Generate Timetable Primary Action
  const handleGenerate = async () => {
    if (teachers.length === 0) {
      setErrorMessage('Please add at least one teacher before generating the timetable.');
      return;
    }
    if (courses.length === 0) {
      setErrorMessage('Please add at least one course before generating the timetable.');
      return;
    }
    if (settings.days.length === 0) {
      setErrorMessage('Please select at least one day in Schedule Settings.');
      return;
    }
    if (settings.rooms.length === 0) {
      setErrorMessage('Please add at least one room in Schedule Settings.');
      return;
    }

    setIsGenerating(true);
    setLoadingMessage('Running Google OR-Tools CP-SAT Constraint Solver...');
    setErrorMessage(null);

    // Build standard CSV from current form state
    const csvLines: string[] = [
      'teacher_name,course_name,credit_hours,course_code,room_type,student_group',
      ...courses.map((c) =>
        [
          escapeCsvCell(c.teacherName),
          escapeCsvCell(c.name),
          escapeCsvCell(c.creditHours),
          escapeCsvCell(c.code),
          escapeCsvCell(c.type),
          escapeCsvCell(c.studentGroup || c.code),
        ].join(',')
      ),
    ];
    const csvContent = csvLines.join('\n');

    const queryParams = new URLSearchParams({
      day_start: settings.startTime,
      day_end: settings.endTime,
      lunch_start: settings.lunchStart,
      lunch_end: settings.lunchEnd,
      slot_minutes: String(settings.slotDuration),
    });

    try {
      // 1. Send as multipart CSV to POST /schedule/upload-csv
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const formData = new FormData();
      formData.append('file', csvBlob, 'easy_builder_schedule.csv');

      const res = await fetch(`${API_BASE}/schedule/upload-csv?${queryParams.toString()}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        router.push(`/schedule/${data.schedule_id}`);
        return;
      } else {
        const errJson = await res.json().catch(() => null);
        const detailMsg =
          errJson?.detail?.message ||
          errJson?.detail?.explanation ||
          (typeof errJson?.detail === 'string' ? errJson.detail : null);
        if (detailMsg) {
          throw new Error(detailMsg);
        }
      }
    } catch (networkOrApiError: unknown) {
      // If the backend threw a real constraint error, display it
      const errStr =
        networkOrApiError instanceof Error
          ? networkOrApiError.message
          : String(networkOrApiError);

      if (errStr.includes('infeasible') || errStr.includes('validation')) {
        setErrorMessage(errStr);
        setIsGenerating(false);
        return;
      }

      // If backend was unreachable or offline, solve locally and route smoothly
      try {
        setLoadingMessage('Synthesizing instant constraint solution...');
        const localFaculty = teachers.map((t) => ({
          name: t.name,
          department: 'Computer Science',
          max_hours_per_day: 5,
          max_days_per_week: settings.days.length,
          email: `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@university.edu`,
          preferences: { prefer_morning: true, preferred_days: settings.days },
          unavailable_slots: [],
        }));

        const localVenues = settings.rooms.map((r) => ({
          name: r,
          capacity: 60,
        }));

        const localCourses = courses.map((c, idx) => {
          const fIdx = teachers.findIndex((t) => t.name === c.teacherName);
          return {
            name: c.name,
            code: c.code,
            faculty_id: fIdx >= 0 ? fIdx : 0,
            capacity_required: 50,
            duration_minutes: settings.slotDuration,
            credit_hours: c.creditHours,
          };
        });

        const fallbackPayload = {
          section_title: 'Custom Timetable',
          custom_only: true,
          faculty: localFaculty,
          venues: localVenues,
          courses: localCourses,
          timeout_seconds: 5,
        };

        const localResult = solveLocally(fallbackPayload);
        saveLocalSchedule(localResult);
        router.push(`/schedule/${localResult.schedule_id}`);
        return;
      } catch (localErr: unknown) {
        const msg = localErr instanceof Error ? localErr.message : 'Schedule generation failed';
        setErrorMessage(msg);
        setIsGenerating(false);
      }
    }
  };

  const totalCreditHours = courses.reduce((sum, c) => sum + c.creditHours, 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-emerald-400 transition">
          Home
        </Link>
        <span>/</span>
        <span className="text-slate-200">Easy Builder</span>
        <span>/</span>
        <Link href="/schedule" className="hover:text-emerald-400 transition">
          Schedules
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span>OR-TOOLS CP-SAT OPTIMIZATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Easy Timetable Builder
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Build your university timetable in minutes. Add teachers and courses, customize timings,
            or import a CSV to let the CP-SAT engine generate a conflict-free schedule.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition disabled:opacity-50"
            title="Run the pre-configured university demo timetable"
          >
            <Play className="w-3.5 h-3.5 fill-emerald-400" />
            <span>Try Demo</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Download blank CSV template with sample headers"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV Template</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Populate with sample university faculty and courses"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
            title="Clear all teachers and courses"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-300">Action Required</p>
            <p className="mt-0.5 font-mono">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{successNotice}</p>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Add Teachers */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">1. Faculty & Teachers</h2>
              <p className="text-xs text-slate-400">
                Add faculty members who will teach your scheduled courses.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-emerald-400 border border-slate-700">
            {teachers.length} {teachers.length === 1 ? 'Teacher' : 'Teachers'}
          </span>
        </div>

        {/* Teacher Input Form */}
        <form onSubmit={handleAddTeacher} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <label htmlFor={teacherInputId} className="sr-only">
              Teacher Full Name
            </label>
            <input
              id={teacherInputId}
              type="text"
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              placeholder="Enter teacher name (e.g. Dr. Sarah Ahmed, Prof. John Doe)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teacher</span>
          </button>
        </form>

        {/* Removable Chips */}
        <div>
          {teachers.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
              No teachers added yet. Type a name above or click &ldquo;Load Sample&rdquo; to start.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="inline-flex items-center space-x-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 transition group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-medium">{teacher.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTeacher(teacher.id, teacher.name)}
                    className="text-slate-500 hover:text-rose-400 transition ml-1"
                    title={`Remove ${teacher.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Add Courses */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">2. Courses & Assignments</h2>
              <p className="text-xs text-slate-400">
                Define the courses, credit hours, and assign them to your faculty.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-emerald-400 border border-slate-700">
              {totalCreditHours} CH
            </span>
          </div>
        </div>

        {/* Add Course Form */}
        <form onSubmit={handleAddCourse} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Course Name */}
            <div className="lg:col-span-2">
              <label htmlFor={courseNameId} className="block text-[11px] font-medium text-slate-400 mb-1">
                Course Name *
              </label>
              <input
                id={courseNameId}
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="e.g. Operating Systems"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Course Code */}
            <div>
              <label htmlFor={courseCodeId} className="block text-[11px] font-medium text-slate-400 mb-1">
                Course Code
              </label>
              <input
                id={courseCodeId}
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                placeholder="e.g. CS202"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition uppercase"
              />
            </div>

            {/* Credit Hours */}
            <div>
              <label htmlFor={creditHoursId} className="block text-[11px] font-medium text-slate-400 mb-1">
                Credit Hours
              </label>
              <select
                id={creditHoursId}
                value={newCreditHours}
                onChange={(e) => setNewCreditHours(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value={1}>1 Credit (1 hr/wk)</option>
                <option value={2}>2 Credits (2 hrs/wk)</option>
                <option value={3}>3 Credits (3 hrs/wk)</option>
                <option value={4}>4 Credits (4 hrs/wk)</option>
                <option value={5}>5 Credits (5 hrs/wk)</option>
                <option value={6}>6 Credits (6 hrs/wk)</option>
              </select>
            </div>

            {/* Assigned Teacher */}
            <div>
              <label htmlFor={teacherSelectId} className="block text-[11px] font-medium text-slate-400 mb-1">
                Assigned Teacher *
              </label>
              <select
                id={teacherSelectId}
                value={newAssignedTeacher}
                onChange={(e) => setNewAssignedTeacher(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {teachers.length === 0 ? (
                  <option value="">No teachers available</option>
                ) : (
                  teachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Type */}
            <div>
              <label htmlFor={courseTypeId} className="block text-[11px] font-medium text-slate-400 mb-1">
                Type
              </label>
              <select
                id={courseTypeId}
                value={newCourseType}
                onChange={(e) => setNewCourseType(e.target.value as 'Lecture' | 'Lab')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab (Consecutive)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="w-full sm:w-auto">
              <label htmlFor={studentGroupId} className="sr-only">
                Student Group
              </label>
              <input
                id={studentGroupId}
                type="text"
                value={newStudentGroup}
                onChange={(e) => setNewStudentGroup(e.target.value)}
                placeholder="Optional group (e.g. BS-CS-4A)"
                className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={teachers.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition shadow-lg shadow-emerald-500/10 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          </div>
        </form>

        {/* Courses Table */}
        <div className="pt-2">
          {courses.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
              No courses added yet. Complete the form above to add your first course.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Course Name</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Credit Hours</th>
                    <th className="py-2.5 px-3">Assigned Faculty</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Student Group</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {courses.map((course, idx) => (
                    <tr
                      key={course.id}
                      className="hover:bg-slate-800/30 transition text-slate-200"
                    >
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{course.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{course.code}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                          {course.creditHours} CH
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {course.teacherName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            course.type === 'Lab'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {course.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {course.studentGroup || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveCourse(course.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition"
                          title="Delete course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Schedule Settings (Collapsible) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-white font-semibold text-base">3. Schedule & Venue Settings</h2>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Optional
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {settingsOpen
                  ? 'Configure teaching days, daily operational hours, slot durations, lunch breaks, and rooms.'
                  : `${settings.days.length} Days (${settings.days[0]}–${
                      settings.days[settings.days.length - 1]
                    }) • ${settings.startTime}–${settings.endTime} • ${
                      settings.slotDuration
                    }m slots • Lunch: ${settings.lunchStart}–${settings.lunchEnd} • ${
                      settings.rooms.length
                    } Rooms`}
              </p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
            {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {settingsOpen && (
          <div className="pt-4 border-t border-slate-800 space-y-6">
            {/* Days Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Operating Days
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_WEEKDAYS.map((day) => {
                  const isChecked = settings.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        isChecked
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Start Time */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Day Start Time</span>
                </label>
                <input
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => setSettings((s) => ({ ...s, startTime: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Day End Time</span>
                </label>
                <input
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => setSettings((s) => ({ ...s, endTime: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Slot Duration */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Slot Duration
                </label>
                <select
                  value={settings.slotDuration}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, slotDuration: Number(e.target.value) }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value={45}>45 Minutes</option>
                  <option value={50}>50 Minutes (Standard)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={75}>75 Minutes</option>
                  <option value={90}>90 Minutes</option>
                </select>
              </div>

              {/* Lunch Start */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Lunch Break Start
                </label>
                <input
                  type="time"
                  value={settings.lunchStart}
                  onChange={(e) => setSettings((s) => ({ ...s, lunchStart: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Lunch End */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Lunch Break End
                </label>
                <input
                  type="time"
                  value={settings.lunchEnd}
                  onChange={(e) => setSettings((s) => ({ ...s, lunchEnd: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Rooms Management */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Available Classrooms & Venues ({settings.rooms.length})</span>
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {settings.rooms.map((room) => (
                  <span
                    key={room}
                    className="inline-flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300"
                  >
                    <span>{room}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRoom(room)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title={`Remove ${room}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddRoom} className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="New room name (e.g. NLSP 1)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition shrink-0"
                >
                  Add Room
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: CSV Import Card */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">4. Quick CSV Import</h2>
              <p className="text-xs text-slate-400">
                Upload existing spreadsheets with columns: teacher_name, course_name, credit_hours
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-slate-800 hover:border-emerald-500/50 bg-slate-950/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-emerald-400">
              <Upload className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Click to browse or drag & drop your courses CSV here
            </p>
            <p className="text-[11px] text-slate-500">
              Columns: <span className="font-mono text-slate-400">teacher_name, course_name, credit_hours</span> (optional: course_code, student_group, room_type)
            </p>
          </div>
        </div>
      </section>

      {/* Primary Generator Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <span>Ready to Optimize?</span>
            <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              CP-SAT
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {teachers.length} Faculty Members &bull; {courses.length} Courses &bull;{' '}
            {totalCreditHours} Contact Hours &bull; {settings.rooms.length} Rooms
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={isGenerating || courses.length === 0}
            onClick={handleGenerate}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-3 rounded-xl text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition shadow-xl shadow-emerald-500/20"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{loadingMessage}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Generate Timetable</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
