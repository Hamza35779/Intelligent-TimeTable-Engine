'use client';

import { useState, useMemo } from 'react';
import { TimetableEntry } from '../types';
import { Download, Printer, Filter, BookOpen, User, MapPin } from 'lucide-react';

interface TimetableGridProps {
  entries: TimetableEntry[];
}

const FACULTY_COLORS = [
  'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20',
  'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20',
  'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20',
  'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20',
  'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20',
  'bg-pink-500/10 border-pink-500/30 text-pink-300 hover:bg-pink-500/20',
  'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20',
  'bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20',
];

export default function TimetableGrid({ entries }: TimetableGridProps) {
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('All');
  const [activeModalEntry, setActiveModalEntry] = useState<TimetableEntry | null>(null);

  // Extract distinct venues, days, slots, and faculty
  const venues = useMemo(() => {
    const map = new Map<number, string>();
    entries.forEach((e) => map.set(e.venue_id, e.venue_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const days = useMemo(() => {
    const list = Array.from(new Set(entries.map((e) => e.day_of_week)));
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return list.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [entries]);

  const faculties = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.faculty_name))).sort();
  }, [entries]);

  const facultyColorMap = useMemo(() => {
    const map = new Map<string, string>();
    faculties.forEach((f, idx) => {
      map.set(f, FACULTY_COLORS[idx % FACULTY_COLORS.length]);
    });
    return map;
  }, [faculties]);

  // Distinct time slots filtered by day if selected
  const slots = useMemo(() => {
    const filteredEntries =
      selectedDay === 'All' ? entries : entries.filter((e) => e.day_of_week === selectedDay);

    const slotMap = new Map<string, { start: string; end: string; day: string }>();
    filteredEntries.forEach((e) => {
      const key = `${e.day_of_week}_${e.start_time}-${e.end_time}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, { start: e.start_time, end: e.end_time, day: e.day_of_week });
      }
    });

    return Array.from(slotMap.entries()).map(([key, info]) => ({
      key,
      ...info,
    }));
  }, [entries, selectedDay]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const dayMatch = selectedDay === 'All' || e.day_of_week === selectedDay;
      const facultyMatch = selectedFaculty === 'All' || e.faculty_name === selectedFaculty;
      return dayMatch && facultyMatch;
    });
  }, [entries, selectedDay, selectedFaculty]);

  // Lookup map: `${day}_${start}-${end}_${venue_id}` -> TimetableEntry
  const entryLookup = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    filteredEntries.forEach((e) => {
      const key = `${e.day_of_week}_${e.start_time}-${e.end_time}_${e.venue_id}`;
      map.set(key, e);
    });
    return map;
  }, [filteredEntries]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Day', 'Time Slot', 'Venue', 'Course Code', 'Course Name', 'Faculty'];
    const rows = entries.map((e) => [
      e.day_of_week,
      `${e.start_time} - ${e.end_time}`,
      `"${e.venue_name}"`,
      `"${e.course_code}"`,
      `"${e.course_name}"`,
      `"${e.faculty_name}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timetable_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Action and Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter:</span>
          </div>

          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
          >
            <option value="All">All Days</option>
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
          >
            <option value="All">All Faculty</option>
            {faculties.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg border border-slate-700 transition"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Grid</span>
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="p-3 font-semibold text-slate-300 w-44 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                Time Slot
              </th>
              {venues.map((venue) => (
                <th key={venue.id} className="p-3 font-semibold text-slate-300 border-r border-slate-800 min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <span>{venue.name}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Venue</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {slots.length === 0 ? (
              <tr>
                <td colSpan={venues.length + 1} className="p-8 text-center text-slate-500">
                  No scheduled classes match the selected filter.
                </td>
              </tr>
            ) : (
              slots.map((slot) => (
                <tr key={slot.key} className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-3 text-slate-400 font-mono sticky left-0 bg-slate-950/90 z-10 border-r border-slate-800 whitespace-nowrap">
                    <div className="font-semibold text-white">{slot.day}</div>
                    <div className="text-[11px] text-slate-500">
                      {slot.start} - {slot.end}
                    </div>
                  </td>

                  {venues.map((venue) => {
                    const lookupKey = `${slot.day}_${slot.start}-${slot.end}_${venue.id}`;
                    const entry = entryLookup.get(lookupKey);

                    if (!entry) {
                      return (
                        <td key={venue.id} className="p-2 border-r border-slate-800/60 bg-slate-950/20">
                          <div className="h-14 rounded-lg border border-dashed border-slate-800/60 flex items-center justify-center text-[11px] text-slate-600">
                            Available
                          </div>
                        </td>
                      );
                    }

                    const colorClass =
                      facultyColorMap.get(entry.faculty_name) ||
                      'bg-slate-800 border-slate-700 text-slate-200';

                    return (
                      <td key={venue.id} className="p-2 border-r border-slate-800/60">
                        <div
                          onClick={() => setActiveModalEntry(entry)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all shadow-sm ${colorClass}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs tracking-tight">{entry.course_code}</span>
                            <span className="text-[10px] opacity-75 font-mono">{entry.start_time}</span>
                          </div>
                          <div className="truncate font-medium text-[11px] mt-0.5">{entry.course_name}</div>
                          <div className="flex items-center space-x-1 text-[10px] opacity-80 mt-1">
                            <User className="w-3 h-3" />
                            <span className="truncate">{entry.faculty_name}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for class details on click */}
      {activeModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h4 className="text-white font-bold text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>Class Details</span>
              </h4>
              <button
                onClick={() => setActiveModalEntry(null)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-md bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-mono uppercase">Course</div>
                <div className="text-white font-bold text-base mt-0.5">{activeModalEntry.course_name}</div>
                <div className="text-emerald-400 font-mono text-xs mt-0.5">Code: {activeModalEntry.course_code}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-mono uppercase flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-400" />
                    Faculty
                  </div>
                  <div className="text-white font-semibold text-xs mt-1">{activeModalEntry.faculty_name}</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-mono uppercase flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    Venue
                  </div>
                  <div className="text-white font-semibold text-xs mt-1">{activeModalEntry.venue_name}</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Scheduled Time</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  {activeModalEntry.day_of_week}, {activeModalEntry.start_time} - {activeModalEntry.end_time}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setActiveModalEntry(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
