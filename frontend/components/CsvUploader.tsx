'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import { TimetableResponse } from '../types';
import {
  parseCsvLocally,
  solveLocally,
  saveLocalSchedule,
} from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const SAMPLE_CSV = `teacher,course,code,hours,preferred_time,department,capacity
Lec. Faria Sajjad,Computer Vision,CS410,3,Morning,Artificial Intelligence,50
SLE Saad Rafi Butt,Computer Vision Lab,CS410L,1,Afternoon,Artificial Intelligence,50
Lec. Almira Aslam,Operating Systems,CS330,3,Morning,Artificial Intelligence,50
Lec. Qasim Safeer,Operating Systems Lab,CS331,1,Morning,Artificial Intelligence,50
Lec. Hassan Raza,Natural Language Processing,CS380,3,Morning,Artificial Intelligence,50
Lec. Abdul Basit,Competitive Programming,CS210,2,Afternoon,Computer Science,50
Lec. Usama Ahmed,Full Stack Mobile App Development,SE340,3,Afternoon,Software Engineering,50`;

interface CsvUploaderProps {
  onScheduleGenerated: (data: TimetableResponse) => void;
}

export default function CsvUploader({ onScheduleGenerated }: CsvUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      // 1. Parse and solve in-browser immediately (<5ms) so there is zero waiting
      const text = await file.text();
      const parsed = parseCsvLocally(text);
      const localData = solveLocally(parsed);
      onScheduleGenerated(localData);

      // 2. Sync asynchronously with backend if running
      const formData = new FormData();
      formData.append('file', file);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 700);
      fetch(`${API_BASE}/schedule/upload-csv`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          clearTimeout(timer);
          if (data) saveLocalSchedule(data);
        })
        .catch(() => clearTimeout(timer));
    } catch (err: any) {
      setError(err.message || 'CSV upload failed');
    }
  };

  const handleSampleCsvGenerate = () => {
    setFileName('university_ai_courses.csv');
    const parsed = parseCsvLocally(SAMPLE_CSV);
    const localData = solveLocally(parsed);
    onScheduleGenerated(localData);
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
        <div className="flex flex-col items-center space-y-2">
          <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-400 transition" />
          <div className="text-xs text-slate-300 font-medium">
            {fileName ? (
              <span className="text-emerald-400 flex items-center gap-1 justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" /> {fileName} (Solved Instantly)
              </span>
            ) : (
              'Click to upload CSV (teacher, course, code, hours, preferred_time, department, capacity)'
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}
    </div>
  );
}
