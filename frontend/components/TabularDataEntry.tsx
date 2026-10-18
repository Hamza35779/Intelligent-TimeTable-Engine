'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { TableRowData, TableRowValidationError } from '../types';

export const DEFAULT_SAMPLE_ROWS: TableRowData[] = [
  {
    id: 'row-1',
    teacher_name: 'Dr. Ahmad Ali',
    course_name: 'Data Structures',
    credit_hours: 3,
    student_group: 'CS-2024-A',
    preferred_time: 'Morning',
  },
  {
    id: 'row-2',
    teacher_name: 'Ms. Fatima Khan',
    course_name: 'Database Systems',
    credit_hours: 4,
    student_group: 'CS-2024-A',
    preferred_time: 'Afternoon',
  },
  {
    id: 'row-3',
    teacher_name: 'Mr. Hassan Khan',
    course_name: 'Web Development',
    credit_hours: 3,
    student_group: 'CS-2024-B',
    preferred_time: '',
  },
  {
    id: 'row-4',
    teacher_name: 'Dr. Sarah Ahmed',
    course_name: 'Artificial Intelligence',
    credit_hours: 3,
    student_group: 'AI-2024-A',
    preferred_time: 'Morning',
  },
  {
    id: 'row-5',
    teacher_name: 'Prof. Kamran Siddiqui',
    course_name: 'Operating Systems',
    credit_hours: 4,
    student_group: 'CS-2024-B',
    preferred_time: 'Morning',
  },
];

interface TabularDataEntryProps {
  rows: TableRowData[];
  setRows: React.Dispatch<React.SetStateAction<TableRowData[]>>;
  errors: TableRowValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<TableRowValidationError[]>>;
  onSaveTable?: () => void;
  savedNotice?: boolean;
}

export default function TabularDataEntry({
  rows,
  setRows,
  errors,
  setErrors,
  onSaveTable,
  savedNotice,
}: TabularDataEntryProps) {
  const handleAddRow = () => {
    const newRow: TableRowData = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      teacher_name: '',
      course_name: '',
      credit_hours: 3,
      student_group: '',
      preferred_time: '',
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      alert('You must have at least one course row.');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setErrors([]);
  };

  const handleChange = (id: string, field: keyof TableRowData, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'teacher_name,course_name,credit_hours,student_group,preferred_time\n' +
      'Dr. Ahmad Ali,Data Structures,3,CS-2024-A,Morning\n' +
      'Ms. Fatima Khan,Database Systems,4,CS-2024-A,Afternoon\n' +
      'Mr. Hassan Khan,Web Development,3,CS-2024-B,\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'timetable_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleRows = () => {
    setRows(DEFAULT_SAMPLE_ROWS);
    setErrors([]);
  };

  // Error lookup helper for a row
  const getRowError = (rowIndex: number): string | null => {
    const err = errors.find((e) => e.row_index === rowIndex);
    return err ? err.message : null;
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs border border-indigo-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs border border-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template (CSV)</span>
          </button>
          <button
            type="button"
            onClick={handleLoadSampleRows}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs border border-slate-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Load Sample Rows</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Table Saved &amp; Validated
            </span>
          )}
          {onSaveTable && (
            <button
              type="button"
              onClick={onSaveTable}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors"
            >
              <span>Save Table</span>
            </button>
          )}
        </div>
      </div>

      {/* Error banner if there are multiple errors */}
      {errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Validation found {errors.length} issue{errors.length > 1 ? 's' : ''}:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {errors.map((e, idx) => (
                <li key={idx}>
                  Row {e.row_index + 1}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Interactive Table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 min-w-[180px]">Teacher Name *</th>
              <th className="py-3 px-3 min-w-[200px]">Course Name *</th>
              <th className="py-3 px-3 w-28">Credit Hours *</th>
              <th className="py-3 px-3 min-w-[140px]">Student Group</th>
              <th className="py-3 px-3 w-36">Preferred Time</th>
              <th className="py-3 px-3 min-w-[180px]">Validation Status</th>
              <th className="py-3 px-3 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const rowError = getRowError(index);
              const hasError = !!rowError;
              return (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    hasError ? 'bg-rose-50/40' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={row.teacher_name}
                      onChange={(e) =>
                        handleChange(row.id, 'teacher_name', e.target.value)
                      }
                      placeholder="e.g. Dr. Ahmad Ali"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 ${
                        hasError && !row.teacher_name
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-slate-300 focus:ring-indigo-500'
                      }`}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={row.course_name}
                      onChange={(e) =>
                        handleChange(row.id, 'course_name', e.target.value)
                      }
                      placeholder="e.g. Data Structures"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 ${
                        hasError && !row.course_name
                          ? 'border-rose-400 focus:ring-rose-400'
                          : 'border-slate-300 focus:ring-indigo-500'
                      }`}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={row.credit_hours}
                      onChange={(e) =>
                        handleChange(row.id, 'credit_hours', Number(e.target.value))
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={1}>1 Hour</option>
                      <option value={2}>2 Hours</option>
                      <option value={3}>3 Hours</option>
                      <option value={4}>4 Hours</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={row.student_group || ''}
                      onChange={(e) =>
                        handleChange(row.id, 'student_group', e.target.value)
                      }
                      placeholder="e.g. CS-2024-A"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={row.preferred_time || ''}
                      onChange={(e) =>
                        handleChange(row.id, 'preferred_time', e.target.value)
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">(No preference)</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    {rowError ? (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {rowError}
                      </span>
                    ) : row.teacher_name && row.course_name ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Valid
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Incomplete</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      title="Remove row"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Total rows: {rows.length}</span>
        <span>* Indicates required field. Credit hours must be between 1 and 4.</span>
      </div>
    </div>
  );
}
