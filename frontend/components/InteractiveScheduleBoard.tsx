'use client';

import { useState, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Move,
  RotateCcw,
  ShieldCheck,
  Zap,
  X,
  Check,
} from 'lucide-react';
import { TimetableEntry } from '../types';

interface InteractiveScheduleBoardProps {
  scheduleId: number;
  entries: TimetableEntry[];
  onScheduleUpdated: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  { start: '08:30', end: '09:20' },
  { start: '09:30', end: '10:20' },
  { start: '10:30', end: '11:20' },
  { start: '11:30', end: '12:20' },
  { start: '13:30', end: '14:20' },
  { start: '14:30', end: '15:20' },
  { start: '15:30', end: '16:20' },
];

export default function InteractiveScheduleBoard({
  scheduleId,
  entries,
  onScheduleUpdated,
}: InteractiveScheduleBoardProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Group entries by day and time slot
  const gridMap = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const key = `${e.day_of_week.toLowerCase()}_${e.start_time}`;
      const existing = map.get(key) || [];
      existing.push(e);
      map.set(key, existing);
    }
    return map;
  }, [entries]);

  const handleSelectEntry = (entry: TimetableEntry) => {
    if (selectedEntry?.id === entry.id) {
      setSelectedEntry(null);
      setSimulationResult(null);
    } else {
      setSelectedEntry(entry);
      setSimulationResult(null);
    }
  };

  const handleCellClick = async (day: string, slot: { start: string; end: string }) => {
    if (!selectedEntry) return;

    // If clicking same position, cancel
    if (
      selectedEntry.day_of_week.toLowerCase() === day.toLowerCase() &&
      selectedEntry.start_time === slot.start
    ) {
      setSelectedEntry(null);
      setSimulationResult(null);
      return;
    }

    setSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/schedule/${scheduleId}/simulate-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: selectedEntry.id,
          target_day: day,
          target_start_time: slot.start,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationResult({
          ...data,
          target_day: day,
          target_slot: slot,
        });
      }
    } catch {
      // ignore
    } finally {
      setSimulating(false);
    }
  };

  const handleExecuteMove = async (moves: any[]) => {
    setIsApplying(true);
    try {
      const res = await fetch(`${API_BASE}/schedule/${scheduleId}/apply-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      });

      if (res.ok) {
        const data = await res.json();
        setToastMessage(data.message || 'Schedule updated successfully!');
        setSelectedEntry(null);
        setSimulationResult(null);
        onScheduleUpdated();
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch {
      // ignore
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Simulation Banner & Instructions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">What-If Schedule Simulator</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Clash Halos
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {selectedEntry
                ? `Selected: "${selectedEntry.course_name}" — Click any destination slot below to test clash halos.`
                : 'Click any class below to enter What-If simulation mode and test manual relocations.'}
            </p>
          </div>
        </div>

        {selectedEntry && (
          <button
            type="button"
            onClick={() => {
              setSelectedEntry(null);
              setSimulationResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel Selection</span>
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interactive Grid Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3 w-28 text-slate-700">Day</th>
                {TIME_SLOTS.map((slot) => (
                  <th key={slot.start} className="p-3 text-center border-l border-slate-200/60">
                    <span className="block text-slate-800 font-bold">{slot.start}</span>
                    <span className="block text-[10px] text-slate-400 font-normal">{slot.end}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-slate-50/40 transition">
                  <td className="p-3 font-bold text-slate-900 bg-slate-50/30 whitespace-nowrap">
                    {day}
                  </td>
                  {TIME_SLOTS.map((slot) => {
                    const key = `${day.toLowerCase()}_${slot.start}`;
                    const cellEntries = gridMap.get(key) || [];
                    const isDestination =
                      selectedEntry &&
                      (selectedEntry.day_of_week.toLowerCase() !== day.toLowerCase() ||
                        selectedEntry.start_time !== slot.start);
                    const isSelectedOrigin =
                      selectedEntry &&
                      selectedEntry.day_of_week.toLowerCase() === day.toLowerCase() &&
                      selectedEntry.start_time === slot.start;

                    return (
                      <td
                        key={slot.start}
                        onClick={() => {
                          if (selectedEntry) {
                            handleCellClick(day, slot);
                          }
                        }}
                        className={`p-2 border-l border-slate-200/60 align-top transition cursor-pointer relative min-h-[90px] ${
                          isSelectedOrigin
                            ? 'bg-indigo-50/80 ring-2 ring-indigo-500 ring-inset'
                            : isDestination
                            ? 'hover:bg-indigo-50/40 hover:ring-2 hover:ring-indigo-300 hover:ring-inset'
                            : ''
                        }`}
                      >
                        {cellEntries.length > 0 ? (
                          <div className="space-y-1.5">
                            {cellEntries.map((e) => (
                              <div
                                key={e.id}
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  handleSelectEntry(e);
                                }}
                                className={`p-2 rounded-xl border text-[11px] leading-snug transition shadow-2xs ${
                                  selectedEntry?.id === e.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-800'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between gap-1">
                                  <span className="truncate">{e.course_name}</span>
                                  <span
                                    className={`text-[9px] px-1 rounded ${
                                      selectedEntry?.id === e.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {e.credit_hours} CH
                                  </span>
                                </div>
                                <div
                                  className={`text-[10px] mt-0.5 truncate ${
                                    selectedEntry?.id === e.id ? 'text-indigo-100' : 'text-slate-500'
                                  }`}
                                >
                                  {e.faculty_name}
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[9px] font-semibold text-indigo-700">
                                  <span
                                    className={`px-1.5 py-0.2 rounded ${
                                      selectedEntry?.id === e.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-indigo-50 text-indigo-700'
                                    }`}
                                  >
                                    {e.venue_name}
                                  </span>
                                  {selectedEntry?.id === e.id ? (
                                    <span className="text-white text-[9px]">Selected</span>
                                  ) : (
                                    <span className="text-slate-400 text-[9px] hover:text-indigo-600">
                                      Click to move
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                            {isDestination ? 'Free slot' : '—'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ripple Resolution & Clash Simulation Modal */}
      {simulationResult && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                simulationResult.halo === 'green'
                  ? 'bg-emerald-50/70 border-emerald-100 text-emerald-900'
                  : 'bg-rose-50/70 border-rose-100 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {simulationResult.halo === 'green' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {simulationResult.halo === 'green'
                      ? 'Direct Move Verified (Zero Clashes)'
                      : 'Clash Detected &bull; Ripple Available'}
                  </h4>
                  <span className="text-[11px] opacity-80">
                    Target: {simulationResult.target_day} at {simulationResult.target_slot.start}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimulationResult(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">{simulationResult.message}</p>

              {/* Green direct move flow */}
              {simulationResult.can_direct_move && (
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span>Proposed Relocation:</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">100% Conflict Free</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">{selectedEntry.course_name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-indigo-700">
                      {simulationResult.target_day} ({simulationResult.target_slot.start} -{' '}
                      {simulationResult.target_slot.end}) in {simulationResult.target_venue.name}
                    </span>
                  </div>
                </div>
              )}

              {/* Red clash with Ripple Solution */}
              {simulationResult.suggested_ripple && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{simulationResult.suggested_ripple.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">
                    {simulationResult.suggested_ripple.description}
                  </p>
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    {simulationResult.suggested_ripple.moves.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 bg-white rounded-lg border border-indigo-100 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800">{m.course_name}</span>
                        <span className="text-indigo-700 font-semibold">
                          &rarr; {m.to_day} at {m.to_start_time} ({m.to_venue_name})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSimulationResult(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition"
              >
                Cancel
              </button>

              {simulationResult.can_direct_move && (
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() =>
                    handleExecuteMove([
                      {
                        entry_id: selectedEntry.id,
                        to_slot_id: simulationResult.target_slot.id,
                        to_venue_id: simulationResult.target_venue.id,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full transition shadow-xs"
                >
                  {isApplying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Execute Move</span>
                </button>
              )}

              {simulationResult.suggested_ripple && (
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => handleExecuteMove(simulationResult.suggested_ripple.moves)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full transition shadow-xs"
                >
                  {isApplying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Execute AI Ripple Swap</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
