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
    name: 'Database Systems',
    code: 'CS204',
    creditHours: 3,
    teacherName: 'Dr. Ayesha Tariq',
    type: 'Lecture',
    studentGroup: 'BS-CS-4B',
  },
  {
    id: 'c-5',
    name: 'Computer Networks Lab',
    code: 'CS306L',
    creditHours: 2,
    teacherName: 'Mr. Bilal Raza',
    type: 'Lab',
    studentGroup: 'BS-SE-5A',
  },
  {
    id: 'c-6',
    name: 'Software Engineering',
    code: 'SE101',
    creditHours: 3,
    teacherName: 'Dr. Usman Farooq',
    type: 'Lecture',
    studentGroup: 'BS-SE-3A',
  },
  {
    id: 'c-7',
    name: 'Web Technologies',
    code: 'CS308',
    creditHours: 3,
    teacherName: 'Ms. Hina Noor',
    type: 'Lecture',
    studentGroup: 'BS-CS-6A',
  },
  {
    id: 'c-8',
    name: 'Data Structures & Algorithms',
    code: 'CS201',
    creditHours: 4,
    teacherName: 'Prof. Kamran Siddiqui',
    type: 'Lecture',
    studentGroup: 'BS-CS-3A',
  },
];

const CSV_TEMPLATE_CONTENT = `teacher_name,course_name,credit_hours,course_code,room_type,student_group
Dr. Sarah Ahmed,Artificial Intelligence,3,CS301,Lecture,BS-AI-4A
Dr. Sarah Ahmed,Deep Learning Lab,3,CS405L,Lab,BS-AI-6A
Prof. Kamran Siddiqui,Operating Systems,4,CS202,Lecture,BS-CS-4A
Dr. Ayesha Tariq,Database Systems,3,CS204,Lecture,BS-CS-4B
Mr. Bilal Raza,Computer Networks Lab,2,CS306L,Lab,BS-SE-5A
Dr. Usman Farooq,Software Engineering,3,SE101,Lecture,BS-SE-3A
Ms. Hina Noor,Web Technologies,3,CS308,Lecture,BS-CS-6A
Prof. Kamran Siddiqui,Data Structures & Algorithms,4,CS201,Lecture,BS-CS-3A
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
  const creditHoursId = useId();
  const teacherSelectId = useId();
  const courseTypeId = useId();
  const studentGroupId = useId();

  // Teacher Handlers
  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTeacherName.trim();
    if (!trimmed) return;

    if (teachers.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`Teacher "${trimmed}" is already added.`);
      return;
    }

    const newTeacher: Teacher = {
      id: `t-${Date.now()}`,
      name: trimmed,
    };

    setTeachers((prev) => [...prev, newTeacher]);
    if (!newAssignedTeacher) {
      setNewAssignedTeacher(trimmed);
    }
    setNewTeacherName('');
    setErrorMessage(null);
  };

  const handleRemoveTeacher = (id: string, name: string) => {
    const isAssigned = courses.some((c) => c.teacherName === name);
    if (isAssigned) {
      const confirmRemove = window.confirm(
        `Teacher "${name}" is assigned to one or more courses. Removing them will leave those courses unassigned. Continue?`
      );
      if (!confirmRemove) return;
    }

    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setCourses((prev) =>
      prev.map((c) => (c.teacherName === name ? { ...c, teacherName: 'Unassigned' } : c))
    );
    if (newAssignedTeacher === name) {
      const remaining = teachers.filter((t) => t.id !== id);
      setNewAssignedTeacher(remaining[0]?.name || '');
    }
  };

  // Course Handlers
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = newCourseName.trim();
    if (!nameTrimmed) {
      setErrorMessage('Please enter a course name.');
      return;
    }
    if (!newAssignedTeacher) {
      setErrorMessage('Please assign a teacher to this course.');
      return;
    }

    const code =
      newCourseCode.trim() ||
      nameTrimmed
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 5) ||
      'CRS';

    const newCourse: CourseItem = {
      id: `c-${Date.now()}`,
      name: nameTrimmed,
      code,
      creditHours: newCreditHours,
      teacherName: newAssignedTeacher,
      type: newCourseType,
      studentGroup: newStudentGroup.trim() || undefined,
    };

    setCourses((prev) => [...prev, newCourse]);
    setNewCourseName('');
    setNewCourseCode('');
    setNewStudentGroup('');
    setErrorMessage(null);
  };

  const handleRemoveCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleLoadSample = () => {
    setTeachers(SAMPLE_TEACHERS);
    setCourses(SAMPLE_COURSES);
    setSettings({
      days: [...DEFAULT_DAYS],
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 50,
      lunchStart: '12:00',
      lunchEnd: '13:30',
      rooms: [...DEFAULT_ROOMS],
    });
    setSuccessNotice('Loaded sample university dataset with 6 faculty & 8 courses.');
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear all teachers and courses?')) {
      setTeachers([]);
      setCourses([]);
      setSuccessNotice('Cleared all teachers and courses.');
    }
  };

  // Settings Handlers
  const handleToggleDay = (day: string) => {
    setSettings((prev) => {
      const exists = prev.days.includes(day);
      if (exists) {
        if (prev.days.length <= 1) {
          setErrorMessage('At least one operating day must be selected.');
          return prev;
        }
        return { ...prev, days: prev.days.filter((d) => d !== day) };
      } else {
        return { ...prev, days: [...prev.days, day] };
      }
    });
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const rName = newRoomName.trim();
    if (!rName) return;
    if (settings.rooms.includes(rName)) {
      setErrorMessage(`Room "${rName}" already exists.`);
      return;
    }
    setSettings((prev) => ({
      ...prev,
      rooms: [...prev.rooms, rName],
    }));
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
        const type: 'Lecture' | 'Lab' = rawType.includes('lab') ? 'Lab' : 'Lecture';

        const code =
          codeIdx !== -1 && row[codeIdx]
            ? row[codeIdx].trim()
            : courseName
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 5);

        const studentGroup = groupIdx !== -1 ? row[groupIdx].trim() : undefined;

        parsedCourses.push({
          id: `c-imp-${r}-${Date.now()}`,
          name: courseName,
          code: code || `CRS-${r}`,
          creditHours,
          teacherName: teacher,
          type,
          studentGroup,
        });
      }

      if (parsedCourses.length === 0) {
        throw new Error('No valid course rows found in CSV.');
      }

      const combinedTeachers: Teacher[] = Array.from(newTeacherSet).map((name, i) => ({
        id: `t-imp-${i}-${Date.now()}`,
        name,
      }));

      setTeachers(combinedTeachers);
      setCourses(parsedCourses);
      setSuccessNotice(
        `Imported ${parsedCourses.length} courses with ${combinedTeachers.length} teachers from "${filename}".`
      );
      setErrorMessage(null);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      handleProcessCsvText(content, file.name);
    };
    reader.readAsText(file);
  };

  // Demo Runner
  const handleTryDemo = async () => {
    setIsGenerating(true);
    setLoadingMessage('Running Google OR-Tools CP-SAT Demo...');
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/demo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        router.push(`/schedule/${data.schedule_id}`);
        return;
      }
    } catch {
      // offline fallback
    }

    try {
      const firstPresetKey = Object.keys(UNIVERSITY_SECTION_PRESETS)[0] || 'AI 2023';
      const presetData = UNIVERSITY_SECTION_PRESETS[firstPresetKey];
      const localResult = solveLocally({
        faculty: presetData.faculty,
        venues: presetData.venues,
        slots: presetData.slots,
        courses: presetData.courses,
        preset_entries: presetData.preset_entries,
        section_title: presetData.section_title || 'AI 2023',
      });
      saveLocalSchedule(localResult);
      router.push(`/schedule/${localResult.schedule_id}`);
    } catch {
      setErrorMessage('Could not initialize demo run.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Primary Generator
  const handleGenerate = async () => {
    if (courses.length === 0) {
      setErrorMessage('Please add at least one course before generating.');
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
      const errStr =
        networkOrApiError instanceof Error
          ? networkOrApiError.message
          : String(networkOrApiError);

      if (errStr.includes('infeasible') || errStr.includes('validation')) {
        setErrorMessage(errStr);
        setIsGenerating(false);
        return;
      }

      // Offline solver fallback
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
            student_group: c.studentGroup || 'Section A',
            room_type: c.type,
          };
        });

        const fallbackSlots = [
          { day_of_week: 'Monday', start_time: '08:30', end_time: '09:20' },
          { day_of_week: 'Monday', start_time: '09:25', end_time: '10:15' },
          { day_of_week: 'Tuesday', start_time: '08:30', end_time: '09:20' },
          { day_of_week: 'Tuesday', start_time: '09:25', end_time: '10:15' },
          { day_of_week: 'Wednesday', start_time: '08:30', end_time: '09:20' },
          { day_of_week: 'Thursday', start_time: '08:30', end_time: '09:20' },
          { day_of_week: 'Friday', start_time: '08:30', end_time: '09:20' },
        ];

        const localSol = solveLocally({
          faculty: localFaculty,
          venues: localVenues,
          slots: fallbackSlots,
          courses: localCourses,
          section_title: 'Custom Schedule',
        });
        saveLocalSchedule(localSol);
        router.push(`/schedule/${localSol.schedule_id}`);
      } catch (e) {
        setErrorMessage(`Generation failed: ${errStr}`);
        setIsGenerating(false);
      }
    }
  };

  const totalCreditHours = courses.reduce((sum, c) => sum + c.creditHours, 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition">
          Home
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">Timetable Builder</span>
        <span>/</span>
        <Link href="/schedule" className="hover:text-indigo-600 transition">
          Schedules
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step-By-Step Setup Wizard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Timetable Builder
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Configure your bell timings, teachers, and courses. The Google OR-Tools CP-SAT engine
            will construct a conflict-free schedule with exact credit-hour contact rules.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={isGenerating}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition shadow-xs disabled:opacity-50"
            title="Run the pre-configured university demo timetable"
          >
            <Play className="w-3.5 h-3.5 fill-current text-indigo-600" />
            <span>Try Demo</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
            title="Download blank CSV template with sample headers"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV Template</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
            title="Populate with sample university faculty and courses"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 transition shadow-xs"
            title="Clear all teachers and courses"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-900">Constraint Verification Notice</p>
            <p className="mt-0.5 font-mono">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{successNotice}</p>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Add Teachers */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-extrabold text-indigo-600 font-display">01</span>
            <div>
              <h2 className="text-slate-900 font-bold text-base">Faculty &amp; Teachers</h2>
              <p className="text-xs text-slate-500">
                Register instructors and professors who will be scheduled.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
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
              placeholder="Enter teacher name (e.g. Dr. Sarah Ahmed, Prof. Kamran Siddiqui)..."
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teacher</span>
          </button>
        </form>

        {/* Removable Chips */}
        <div>
          {teachers.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              No teachers added yet. Type a name above or click &ldquo;Load Sample&rdquo; to start.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="inline-flex items-center space-x-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-full px-3.5 py-1.5 text-xs text-slate-700 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <span className="font-semibold">{teacher.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTeacher(teacher.id, teacher.name)}
                    className="text-slate-400 hover:text-rose-600 transition ml-1"
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
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-extrabold text-indigo-600 font-display">02</span>
            <div>
              <h2 className="text-slate-900 font-bold text-base">Courses &amp; Credit Hours</h2>
              <p className="text-xs text-slate-500">
                Define the curriculum, weekly contact hours, and teacher assignments.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {totalCreditHours} Contact Hours
            </span>
          </div>
        </div>

        {/* Add Course Form */}
        <form onSubmit={handleAddCourse} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Course Name */}
            <div className="lg:col-span-2">
              <label htmlFor={courseNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                Course Name *
              </label>
              <input
                id={courseNameId}
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="e.g. Operating Systems"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Course Code */}
            <div>
              <label htmlFor={courseCodeId} className="block text-xs font-semibold text-slate-700 mb-1">
                Course Code
              </label>
              <input
                id={courseCodeId}
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                placeholder="e.g. CS202"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition uppercase"
              />
            </div>

            {/* Credit Hours */}
            <div>
              <label htmlFor={creditHoursId} className="block text-xs font-semibold text-slate-700 mb-1">
                Credit Hours
              </label>
              <select
                id={creditHoursId}
                value={newCreditHours}
                onChange={(e) => setNewCreditHours(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value={1}>1 Credit (1 hr/wk)</option>
                <option value={2}>2 Credits (2 hrs/wk)</option>
                <option value={3}>3 Credits (2+1 hrs/wk)</option>
                <option value={4}>4 Credits (2+2 hrs/wk)</option>
                <option value={5}>5 Credits (5 hrs/wk)</option>
                <option value={6}>6 Credits (6 hrs/wk)</option>
              </select>
            </div>

            {/* Assigned Teacher */}
            <div>
              <label htmlFor={teacherSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Teacher *
              </label>
              <select
                id={teacherSelectId}
                value={newAssignedTeacher}
                onChange={(e) => setNewAssignedTeacher(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
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
              <label htmlFor={courseTypeId} className="block text-xs font-semibold text-slate-700 mb-1">
                Format
              </label>
              <select
                id={courseTypeId}
                value={newCourseType}
                onChange={(e) => setNewCourseType(e.target.value as 'Lecture' | 'Lab')}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
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
                placeholder="Student Section / Cohort (e.g. BS-CS-4A)"
                className="w-full sm:w-72 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={teachers.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          </div>
        </form>

        {/* Courses Table */}
        <div className="pt-2">
          {courses.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              No courses added yet. Fill out the fields above to add your first course.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Course Name</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Credit Hours</th>
                    <th className="py-2.5 px-3">Assigned Faculty</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Student Group</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courses.map((course, idx) => (
                    <tr key={course.id} className="hover:bg-slate-50 transition text-slate-700">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{course.name}</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 font-bold">{course.code}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                          {course.creditHours} CH
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {course.teacherName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            course.type === 'Lab'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {course.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {course.studentGroup || (
                          <span className="text-slate-400 italic">None specified</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveCourse(course.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Remove course"
                        >
                          <Trash2 className="w-4 h-4" />
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
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <span className="text-sm font-extrabold text-indigo-600 font-display">03</span>
            <div>
              <h2 className="text-slate-900 font-bold text-base flex items-center gap-2">
                <span>Operating Timings &amp; Venues</span>
                <span className="text-xs font-normal text-slate-400">
                  (09:00 - 17:00 &bull; {settings.slotDuration}m slots &bull; {settings.rooms.length} venues)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Operating days, protected lunch break, period duration, and available rooms.
              </p>
            </div>
          </div>
          <div className="p-1 rounded-lg bg-slate-100 text-slate-600">
            {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {settingsOpen && (
          <div className="pt-4 border-t border-slate-100 space-y-5 animate-fade-in">
            {/* Days Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Active Weekdays
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_WEEKDAYS.map((day) => {
                  const isChecked = settings.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Configuration Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Day Start */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Day Start Time
                </label>
                <input
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => setSettings((s) => ({ ...s, startTime: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Day End */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Day End Time
                </label>
                <input
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => setSettings((s) => ({ ...s, endTime: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Slot Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slot Duration
                </label>
                <select
                  value={settings.slotDuration}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, slotDuration: Number(e.target.value) }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value={45}>45 Minutes</option>
                  <option value={50}>50 Minutes (Default)</option>
                  <option value={60}>60 Minutes</option>
                  <option value={75}>75 Minutes</option>
                  <option value={90}>90 Minutes</option>
                </select>
              </div>

              {/* Lunch Start */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lunch Break Start
                </label>
                <input
                  type="time"
                  value={settings.lunchStart}
                  onChange={(e) => setSettings((s) => ({ ...s, lunchStart: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Lunch End */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lunch Break End
                </label>
                <input
                  type="time"
                  value={settings.lunchEnd}
                  onChange={(e) => setSettings((s) => ({ ...s, lunchEnd: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Rooms Management */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Available Classrooms &amp; Venues ({settings.rooms.length})</span>
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {settings.rooms.map((room) => (
                  <span
                    key={room}
                    className="inline-flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700"
                  >
                    <span className="font-medium">{room}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRoom(room)}
                      className="text-slate-400 hover:text-rose-600 transition"
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
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shrink-0"
                >
                  Add Room
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: CSV Import Card */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-extrabold text-indigo-600 font-display">04</span>
            <div>
              <h2 className="text-slate-900 font-bold text-base">Bulk CSV Import</h2>
              <p className="text-xs text-slate-500">
                Upload existing spreadsheets with columns: teacher_name, course_name, credit_hours
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-700 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full transition self-start sm:self-auto font-semibold"
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
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/40'
              : 'border-slate-200 hover:border-indigo-400 bg-slate-50/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 rounded-full bg-white border border-slate-200 text-indigo-600 shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Click to browse or drag &amp; drop your courses CSV here
            </p>
            <p className="text-[11px] text-slate-500">
              Required: <span className="font-mono text-slate-700">teacher_name, course_name, credit_hours</span> &bull; Optional: course_code, room_type, student_group
            </p>
          </div>
        </div>
      </section>

      {/* Primary Generator Action Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-slate-900 font-extrabold text-lg flex items-center gap-2">
            <span>Ready to Solve Timetable?</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              OR-Tools CP-SAT
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {teachers.length} Faculty Members &bull; {courses.length} Courses &bull;{' '}
            {totalCreditHours} Contact Sessions &bull; {settings.rooms.length} Venues
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={isGenerating || courses.length === 0}
            onClick={handleGenerate}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-8 py-3.5 rounded-full text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm hover:shadow"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>{loadingMessage}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
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
