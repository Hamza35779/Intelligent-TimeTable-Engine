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
    { value: 'csv', label: 'CSV Spreadsheets' },
    { value: 'xlsx', label: 'Excel (.XLSX)' },
    { value: 'pdf', label: 'PDF Printable' },
    { value: 'png', label: 'PNG Image' },
    { value: 'jpg', label: 'JPG Image' },
    { value: 'json', label: 'JSON Data' },
    { value: 'html', label: 'HTML Table' },
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
    <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <Download className="w-5 h-5 text-indigo-600" />
          <h3 className="text-slate-900 font-bold text-base">Multi-Format &amp; Multi-View Exporter</h3>
        </div>

        {/* Audience View Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Perspective:
          </span>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedView(v.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                selectedView === v.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {exportFormats.map((fmt) => (
          <button
            key={fmt.value}
            type="button"
            onClick={() => handleExport(fmt.value)}
            disabled={exportingFormat !== null}
            className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-xl text-xs font-semibold transition flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 group"
          >
            <span className="font-mono text-sm font-bold uppercase text-indigo-600 group-hover:scale-105 transition-transform">
              .{fmt.value}
            </span>
            <span className="text-[11px] text-center text-slate-500">{fmt.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Includes fairness &amp; ML satisfaction metrics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Excel &amp; CSV ready for Google Sheets</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>High-res PNG/JPG for physical notice boards</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Landscape A4 styled PDF with protected lunch</span>
        </div>
      </div>
    </div>
  );
}
