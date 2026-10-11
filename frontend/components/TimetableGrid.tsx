'use client';

import { useState, useMemo } from 'react';
import { TimetableEntry } from '../types';
import { Download, Printer, Layers } from 'lucide-react';
import {
  buildUniversitySheetData,
  UNIVERSITY_SECTION_PRESETS,
  triggerLocalDownload,
} from '../utils/localFallbackSolver';

interface TimetableGridProps {
  entries: TimetableEntry[];
  sectionTitle?: string;
  scheduleId?: number;
}

export default function TimetableGrid({
  entries,
  sectionTitle = 'AI 2023',
  scheduleId = 1,
}: TimetableGridProps) {
  const [selectedSection, setSelectedSection] = useState<string>(sectionTitle);
  const [usePresetOverride, setUsePresetOverride] = useState<boolean>(false);

  const activeEntries = useMemo(() => {
    if (usePresetOverride && UNIVERSITY_SECTION_PRESETS[selectedSection]) {
      return UNIVERSITY_SECTION_PRESETS[selectedSection].preset_entries.map(
        (pe: any, idx: number) => ({
          id: idx + 1,
          course_id: idx + 1,
          course_name: pe.course_name,
          course_code: pe.course_code,
          faculty_id: idx + 1,
          faculty_name: pe.faculty_name,
          venue_id: idx + 1,
          venue_name: pe.venue_name,
          slot_id: idx + 1,
          day_of_week: pe.day_of_week,
          start_time: pe.start_time,
          end_time: pe.end_time,
          credit_hours: pe.credit_hours,
          elective_compulsory: pe.elective_compulsory,
          remarks: pe.remarks,
        })
      );
    }
    return entries;
  }, [entries, selectedSection, usePresetOverride]);

  const effectiveTitle = usePresetOverride ? selectedSection : sectionTitle;

  const sheet = useMemo(() => {
    return buildUniversitySheetData(activeEntries, effectiveTitle, 'master');
  }, [activeEntries, effectiveTitle]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Section Sheet:</span>
          </span>
          {Object.keys(UNIVERSITY_SECTION_PRESETS).map((secName) => {
            const isSelected = effectiveTitle === secName;
            return (
              <button
                key={secName}
                type="button"
                onClick={() => {
                  setSelectedSection(secName);
                  setUsePresetOverride(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-[#2E75B6] text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {secName}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerLocalDownload(scheduleId, 'csv', 'master')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg border border-slate-700 transition"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Official Sheet</span>
          </button>
        </div>
      </div>

      {/* Exact University Timetable Sheet (Matches Uploaded Screenshots) */}
      <div className="overflow-x-auto rounded-lg border border-slate-400 bg-white p-4 shadow-2xl text-black">
        {/* Upper Table: Blue Section Banner + 9-Slot Horizontal Schedule Matrix */}
        <table className="w-full border-collapse border border-black text-center text-[13px] leading-snug font-sans">
          <thead>
            {/* Row 1: Blue Section Banner */}
            <tr>
              <th
                colSpan={10}
                className="bg-[#2E75B6] text-white font-bold text-base py-2 px-3 border border-black tracking-wide text-center"
              >
                {sheet.section_title}
              </th>
            </tr>
            {/* Row 2: Slot 1 .. Slot 9 */}
            <tr className="bg-white text-black">
              {sheet.slot_headers.map((slotHdr, idx) => (
                <th
                  key={idx}
                  className="border border-black py-1.5 px-2 font-bold text-[13px] text-center"
                  style={{ width: idx === 0 ? '10%' : '10%' }}
                >
                  {slotHdr}
                </th>
              ))}
            </tr>
            {/* Row 3: Day/Time | 0830-9020 .. 1510-1600 */}
            <tr className="bg-white text-black">
              {sheet.time_headers.map((timeHdr, idx) => (
                <th
                  key={idx}
                  className="border border-black py-1.5 px-2 font-bold text-[13px] text-center whitespace-nowrap"
                >
                  {timeHdr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.days.map((day) => {
              const spans = sheet.merged_day_cells[day] || [];
              return (
                <tr key={day} className="bg-white text-black">
                  <td className="border border-black py-4 px-2 font-bold text-[13px] text-center align-middle whitespace-nowrap">
                    {day}
                  </td>
                  {spans.map((sp, sIdx) => (
                    <td
                      key={sIdx}
                      colSpan={sp.colSpan > 1 ? sp.colSpan : undefined}
                      className="border border-black py-3 px-2 text-[12.5px] text-center align-middle whitespace-pre-line"
                    >
                      {sp.text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Blank Row Separator */}
        <div className="h-6" />

        {/* Lower Table: 8-Column Course & Faculty Summary Legend */}
        <table className="w-full border-collapse border border-black text-center text-[13px] leading-snug font-sans">
          <thead>
            <tr className="bg-white text-black">
              <th className="border border-black py-2 px-2 font-bold w-[6%]">Serial</th>
              <th className="border border-black py-2 px-2 font-bold w-[11%]">Course Code</th>
              <th className="border border-black py-2 px-3 font-bold w-[26%]">Course Titles</th>
              <th className="border border-black py-2 px-2 font-bold w-[6%]">CHs</th>
              <th className="border border-black py-2 px-3 font-bold w-[19%]">Name of Faculty</th>
              <th className="border border-black py-2 px-2 font-bold w-[13%]">
                Elective / Compulsory
              </th>
              <th className="border border-black py-2 px-2 font-bold w-[11%]">Venues</th>
              <th className="border border-black py-2 px-2 font-bold w-[8%]">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {sheet.course_legend.map((row) => (
              <tr key={row.serial} className="bg-white text-black">
                <td className="border border-black py-2 px-2 text-center">{row.serial}</td>
                <td className="border border-black py-2 px-2 text-center">{row.course_code}</td>
                <td className="border border-black py-2 px-3 text-center">{row.course_title}</td>
                <td className="border border-black py-2 px-2 text-center">{row.credit_hours}</td>
                <td className="border border-black py-2 px-3 text-center">{row.faculty_name}</td>
                <td className="border border-black py-2 px-2 text-center">
                  {row.elective_compulsory}
                </td>
                <td className="border border-black py-2 px-2 text-center">{row.venues}</td>
                <td className="border border-black py-2 px-2 text-center">{row.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
