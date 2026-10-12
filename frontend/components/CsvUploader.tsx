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

export const SAMPLE_CSV = `teacher_name,course_name,credit_hours,student_group,room_type
Dr. Sarah Ahmed,Artificial Intelligence,3,BS-AI-4A,Lecture
Dr. Sarah Ahmed,Deep Learning,3,BS-AI-6A,Lab
Prof. Kamran Siddiqui,Operating Systems,4,BS-CS-4A,Lecture
Prof. Kamran Siddiqui,Computer Networks,3,BS-CS-6A,Lecture
Dr. Ayesha Tariq,Database Systems,4,BS-SE-4A,Lecture
Dr. Ayesha Tariq,Data Mining,2,BS-AI-6A,Lecture
Mr. Bilal Raza,Software Engineering,3,BS-SE-4A,Lecture
Mr. Bilal Raza,Agile Development,2,BS-SE-6A,Lecture
Dr. Usman Farooq,Linear Algebra,3,BS-AI-4A,Lecture
Dr. Usman Farooq,Probability & Statistics,3,BS-CS-4A,Lecture
Ms. Hina Noor,Technical Writing,2,BS-CS-6A,Lecture
Ms. Hina Noor,Professional Ethics,2,BS-SE-6A,Lecture`;

interface CsvUploaderProps {
  onScheduleGenerated: (data: TimetableResponse) => void;
}

export default function CsvUploader({ onScheduleGenerated }: CsvUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/schedule/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        saveLocalSchedule(data);
        onScheduleGenerated(data);
        return;
      } else {
        const errJson = await res.json().catch(() => null);
        const msg =
          errJson?.detail?.message ||
          errJson?.detail?.explanation ||
          (typeof errJson?.detail === 'string' ? errJson.detail : null);
        if (msg) {
          setError(msg);
          return;
        }
      }
    } catch {
      // Fallback to local solver only if backend is unreachable
      try {
        const text = await file.text();
        const parsed = parseCsvLocally(text);
        const localData = solveLocally(parsed);
        onScheduleGenerated(localData);
      } catch (err: any) {
        setError(err.message || 'CSV upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSampleCsvGenerate = async () => {
    setError(null);
    setFileName('demo_courses.csv');
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/demo/run`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        saveLocalSchedule(data);
        onScheduleGenerated(data);
        return;
      }
    } catch {
      // Fallback if backend is unreachable
    } finally {
      setUploading(false);
    }
    const parsed = parseCsvLocally(SAMPLE_CSV);
    const localData = solveLocally(parsed);
    onScheduleGenerated(localData);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'demo_courses.csv';
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
            <span>demo_courses.csv</span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={handleSampleCsvGenerate}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-3 py-1.5 rounded-lg transition"
          >
            <span>{uploading ? 'Solving...' : '1-Click Run Demo CSV'}</span>
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
                <CheckCircle2 className="w-3.5 h-3.5" /> {fileName}
              </span>
            ) : (
              'Click to upload CSV (teacher_name, course_name, credit_hours, optional: student_group, room_type)'
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}
    </div>
  );
}
