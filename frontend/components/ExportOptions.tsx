'use client';

import { useState } from 'react';
import { Download, Layers, CheckCircle2 } from 'lucide-react';
import { triggerLocalDownload } from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface ExportOptionsProps {
  scheduleId: number;
}

export default function ExportOptions({ scheduleId }: ExportOptionsProps) {
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('master');

  const views = [
    { id: 'master', label: 'Master Schedule' },
    { id: 'teacher', label: 'Teacher View' },
    { id: 'student', label: 'Student View' },
    { id: 'staff', label: 'Support Staff' },
    { id: 'canteen', label: 'Canteen Staff' },
  ];

  const exportFormats = [
    { value: 'csv', label: 'CSV (Excel / Sheets)' },
    { value: 'xlsx', label: 'Excel Workbook (.XLSX)' },
    { value: 'pdf', label: 'PDF Document' },
    { value: 'png', label: 'PNG High-Res Image' },
    { value: 'jpg', label: 'JPG Image' },
    { value: 'json', label: 'JSON Data' },
    { value: 'html', label: 'HTML Web Table' },
  ];

  const handleExport = async (format: string, view: string = selectedView) => {
    setExportingFormat(format);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      const response = await fetch(
        `${API_BASE}/export/${scheduleId}?format=${format}&view=${view}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timetable_${view}_${scheduleId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      clearTimeout(timer);
      triggerLocalDownload(scheduleId, format, view);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Download className="w-5 h-5 text-emerald-400" />
          <h3 className="text-white font-bold text-base">Multi-Format & Multi-View Exporter</h3>
        </div>

        {/* Audience View Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Perspective:
          </span>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedView(v.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                selectedView === v.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {exportFormats.map((fmt) => (
          <button
            key={fmt.value}
            type="button"
            onClick={() => handleExport(fmt.value)}
            disabled={exportingFormat !== null}
            className="p-3 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-300 rounded-xl text-xs font-semibold transition flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span className="font-mono text-sm font-bold uppercase text-emerald-400">
              .{fmt.value}
            </span>
            <span className="text-[11px] text-center text-slate-400">{fmt.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Includes fairness & ML satisfaction metrics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Excel & CSV ready for Google Sheets</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>High-res PNG/JPG for notice boards</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Landscape A4 styled PDF with break highlights</span>
        </div>
      </div>
    </div>
  );
}
