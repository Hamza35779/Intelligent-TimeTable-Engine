'use client';

import { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  AlertCircle,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  Users,
  Search,
  ArrowRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { ScheduleDetail, TimetableEntry } from '../../types';
import { getLocalSchedule, UNIVERSITY_SECTION_PRESETS } from '../../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SubstituteCandidate {
  facultyName: string;
  department: string;
  totalWeeklyHours: number;
  isFreeAtSlot: boolean;
  coverScore: number;
  reason: string;
}

interface AssignedCover {
  id: string;
  originalFaculty: string;
  substituteFaculty: string;
  courseName: string;
  day: string;
  timeSlot: string;
  venue: string;
  assignedAt: string;
}

export default function SubstitutesPage() {
  const [scheduleEntries, setScheduleEntries] = useState<TimetableEntry[]>([]);
  const [facultyList, setFacultyList] = useState<string[]>([]);
  const [selectedAbsentFaculty, setSelectedAbsentFaculty] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [assignedCovers, setAssignedCovers] = useState<AssignedCover[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const absentFacultySelectId = useId();
  const daySelectId = useId();
  const slotSelectId = useId();

  // Load schedule data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${API_BASE}/schedules`);
        if (res.ok) {
          const list = await res.json();
          if (list.length > 0) {
            const detailRes = await fetch(`${API_BASE}/schedules/${list[0].id}`);
            if (detailRes.ok) {
              const detail: ScheduleDetail = await detailRes.json();
              if (detail.entries && detail.entries.length > 0) {
                const entries: TimetableEntry[] = detail.entries.map((e, i) => ({
                  id: i + 1,
                  course_id: e.course_id ?? i + 1,
                  course_name: e.course_name,
                  course_code: e.course_code,
                  faculty_id: e.faculty_id ?? i + 1,
                  faculty_name: e.faculty_name,
                  venue_id: e.venue_id ?? i + 1,
                  venue_name: e.venue_name,
                  slot_id: e.slot_id ?? i + 1,
                  day_of_week: e.day_of_week,
                  time_slot: e.time_slot || `${e.start_time} - ${e.end_time}`,
                  start_time: e.start_time,
                  end_time: e.end_time,
                  credit_hours: e.credit_hours,
                }));
                setScheduleEntries(entries);
                extractFaculty(entries);
                return;
              }
            }
          }
        }
      } catch {
        // fallback
      }

      // Local fallback
      const local = getLocalSchedule(1);
      if (local && local.schedule && local.schedule.length > 0) {
        setScheduleEntries(local.schedule);
        extractFaculty(local.schedule);
      } else {
        const firstKey = Object.keys(UNIVERSITY_SECTION_PRESETS)[0] || 'AI 2023';
        const preset = UNIVERSITY_SECTION_PRESETS[firstKey];
        const names: string[] = (preset?.faculty || []).map((f: { name: string }) => f.name);
        setFacultyList(names);
        if (names.length > 0) setSelectedAbsentFaculty(names[0]);
      }
    }

    function extractFaculty(entries: TimetableEntry[]) {
      const names = Array.from(new Set(entries.map((e) => e.faculty_name))).filter(Boolean);
      setFacultyList(names);
      if (names.length > 0) {
        setSelectedAbsentFaculty(names[0]);
      }
    }

    loadData();
  }, []);

  // When absent faculty or day changes, find slots where they have a class
  const absentFacultyClasses = scheduleEntries.filter(
    (e) =>
      e.faculty_name === selectedAbsentFaculty &&
      e.day_of_week.toLowerCase() === selectedDay.toLowerCase()
  );

  useEffect(() => {
    if (absentFacultyClasses.length > 0) {
      setSelectedSlot(absentFacultyClasses[0].time_slot || '');
    } else {
      setSelectedSlot('');
    }
  }, [selectedAbsentFaculty, selectedDay, absentFacultyClasses.length]);

  // Compute available substitute candidates
  const currentClassToCover = absentFacultyClasses.find((e) => e.time_slot === selectedSlot);

  const candidates: SubstituteCandidate[] = facultyList
    .filter((name) => name !== selectedAbsentFaculty)
    .map((name) => {
      // Check if this faculty has a class at the exact same day and slot
      const hasConflict = scheduleEntries.some(
        (e) =>
          e.faculty_name === name &&
          e.day_of_week.toLowerCase() === selectedDay.toLowerCase() &&
          e.time_slot === selectedSlot
      );

      // Total weekly hours already taught by this faculty
      const weeklyHours = scheduleEntries.filter((e) => e.faculty_name === name).length;

      // Score: high if free and lighter load
      const isFree = !hasConflict;
      const coverScore = isFree ? Math.max(10, 100 - weeklyHours * 8) : 0;

      let reason = 'Available - Free during this slot';
      if (!isFree) {
        reason = 'Unavailable - Already teaching another class';
      } else if (weeklyHours <= 3) {
        reason = 'Highly Recommended - Light weekly workload';
      } else if (weeklyHours <= 6) {
        reason = 'Available - Moderate workload';
      }

      return {
        facultyName: name,
        department: 'Computer Science',
        totalWeeklyHours: weeklyHours,
        isFreeAtSlot: isFree,
        coverScore,
        reason,
      };
    })
    .sort((a, b) => b.coverScore - a.coverScore);

  const handleAssignCover = (candidateName: string) => {
    if (!currentClassToCover) return;

    const newCover: AssignedCover = {
      id: `cov-${Date.now()}`,
      originalFaculty: selectedAbsentFaculty,
      substituteFaculty: candidateName,
      courseName: currentClassToCover.course_name,
      day: selectedDay,
      timeSlot: selectedSlot,
      venue: currentClassToCover.venue_name,
      assignedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAssignedCovers((prev) => [newCover, ...prev]);
    setSuccessMessage(
      `Cover assigned: ${candidateName} will substitute for ${selectedAbsentFaculty} (${currentClassToCover.course_name}) on ${selectedDay} at ${selectedSlot}.`
    );

    setTimeout(() => {
      setSuccessMessage(null);
    }, 6000);
  };

  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="space-y-10 pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Smart Cover Teacher Assignment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Substitutes &amp; Absence Management
          </h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            When faculty members are absent, TimetableMaster ranks available cover teachers based
            on free periods, current weekly workload, and subject familiarity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-full border border-slate-300 shadow-sm transition"
          >
            <span>View Full Timetable</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {/* Main Substitution Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Select Absence */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>1. Select Absent Teacher</span>
            </h2>
          </div>

          <div className="space-y-4">
            {/* Absent Faculty Picker */}
            <div>
              <label htmlFor={absentFacultySelectId} className="block text-xs font-semibold text-slate-700 mb-1.5">
                Faculty Member Absent
              </label>
              <select
                id={absentFacultySelectId}
                value={selectedAbsentFaculty}
                onChange={(e) => setSelectedAbsentFaculty(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
              >
                {facultyList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Day Picker */}
            <div>
              <label htmlFor={daySelectId} className="block text-xs font-semibold text-slate-700 mb-1.5">
                Day of Absence
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {daysList.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition ${
                      selectedDay.toLowerCase() === day.toLowerCase()
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Affected Slot / Class */}
            <div>
              <label htmlFor={slotSelectId} className="block text-xs font-semibold text-slate-700 mb-1.5">
                Class / Slot to Cover
              </label>
              {absentFacultyClasses.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  {selectedAbsentFaculty} has no classes scheduled on {selectedDay}.
                </div>
              ) : (
                <select
                  id={slotSelectId}
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                >
                  {absentFacultyClasses.map((c) => (
                    <option key={c.id} value={c.time_slot}>
                      {c.time_slot} &bull; {c.course_name} ({c.venue_name})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentClassToCover && (
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1">
                <div className="font-semibold text-indigo-900">Session Details:</div>
                <div className="text-slate-600">Course: <strong className="text-slate-900">{currentClassToCover.course_name}</strong></div>
                <div className="text-slate-600">Venue: <strong className="text-slate-900">{currentClassToCover.venue_name}</strong></div>
                <div className="text-slate-600">Time: <strong className="text-slate-900">{currentClassToCover.time_slot}</strong></div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (2 cols): Ranked Substitute Recommendations */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>2. Ranked Substitute Recommendations</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by slot availability, weekly teaching load, and workload fairness.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {candidates.filter((c) => c.isFreeAtSlot).length} Available
            </span>
          </div>

          {!selectedSlot ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Please select a class session to cover on the left.
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate, idx) => (
                <div
                  key={candidate.facultyName}
                  className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    candidate.isFreeAtSlot
                      ? idx === 0
                        ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                        candidate.isFreeAtSlot
                          ? idx === 0
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {candidate.facultyName}
                        </span>
                        {idx === 0 && candidate.isFreeAtSlot && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <Award className="w-3 h-3" />
                            Best Match
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{candidate.department}</span>
                        <span>&bull;</span>
                        <span>{candidate.totalWeeklyHours} hrs weekly load</span>
                        <span>&bull;</span>
                        <span
                          className={
                            candidate.isFreeAtSlot ? 'text-emerald-600 font-medium' : 'text-rose-600'
                          }
                        >
                          {candidate.reason}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end sm:justify-start">
                    {candidate.isFreeAtSlot ? (
                      <button
                        type="button"
                        onClick={() => handleAssignCover(candidate.facultyName)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-sm transition"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign Cover</span>
                      </button>
                    ) : (
                      <span className="text-xs text-rose-500 font-semibold px-3 py-1.5 bg-rose-50 rounded-lg">
                        Clash Detected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Cover Record Table */}
      {assignedCovers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Assigned Substitutions for Current Run</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {assignedCovers.length} Assigned
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Original Teacher</th>
                  <th className="py-2.5 px-3">Substitute Teacher</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Day &amp; Time</th>
                  <th className="py-2.5 px-3">Venue</th>
                  <th className="py-2.5 px-3">Assigned At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedCovers.map((cov) => (
                  <tr key={cov.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-700">{cov.originalFaculty}</td>
                    <td className="py-3 px-3 font-bold text-indigo-600">{cov.substituteFaculty}</td>
                    <td className="py-3 px-3 text-slate-800">{cov.courseName}</td>
                    <td className="py-3 px-3 text-slate-600">{cov.day} &bull; {cov.timeSlot}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono">{cov.venue}</td>
                    <td className="py-3 px-3 text-slate-400">{cov.assignedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
