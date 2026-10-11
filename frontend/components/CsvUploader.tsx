'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle2, RefreshCw } from 'lucide-react';
import { TimetableResponse } from '../types';
import {
  parseCsvLocally,
  solveLocally,
  saveLocalSchedule,
} from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const SAMPLE_CSV = `teacher,course,code,hours,preferred_time,department,capacity
Ahmad Ali,Data Structures & Algorithms,CS301,3,Morning,Computer Science,60
Fatima Khan,Database Management Systems,CS302,4,Afternoon,Computer Science,50
Hassan Raza,Operating Systems,SE205,3,Morning,Software Engineering,45
Dr. Alan Turing,Theory of Computation,CS401,3,Morning,Computer Science,75
Dr. Ada Lovelace,Compiler Construction,CS405,3,Afternoon,Computer Science,40
Dr. Claude Shannon,Information Theory,IT202,3,Morning,Information Theory,55`;

interface CsvUploaderProps {
  onScheduleGenerated: (data: TimetableResponse) => void;
}

export default function CsvUploader({ onScheduleGenerated }: CsvUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/schedule/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'CSV upload failed');
      }
      const data: TimetableResponse = await res.json();
      saveLocalSchedule(data);
      onScheduleGenerated(data);
    } catch (err: any) {
      // Fallback to in-browser CSV parsing & solving if backend is unreachable
      try {
        const text = await file.text();
        const parsed = parseCsvLocally(text);
        const localData = solveLocally(parsed);
        onScheduleGenerated(localData);
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSampleCsvGenerate = async () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const file = new File([blob], 'university_courses.csv', { type: 'text/csv' });
    await handleFileUpload(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_courses_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <h3 className="text-white font-bold text-sm">Upload Courses CSV</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-emerald-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample CSV</span>
          </button>
          <button
            type="button"
            onClick={handleSampleCsvGenerate}
            disabled={uploading}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 rounded-lg transition"
          >
            <span>1-Click Run Sample CSV</span>
          </button>
        </div>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center space-y-2 text-emerald-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <span className="text-xs font-medium">Parsing CSV, predicting ML preferences & solving...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-400 transition" />
            <div className="text-xs text-slate-300 font-medium">
              {fileName ? (
                <span className="text-emerald-400 flex items-center gap-1 justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {fileName}
                </span>
              ) : (
                'Click to upload CSV (teacher, course, code, hours, preferred_time, department, capacity)'
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}
    </div>
  );
}
