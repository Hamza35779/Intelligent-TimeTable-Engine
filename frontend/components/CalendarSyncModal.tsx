'use client';

import { useState } from 'react';
import {
  Calendar,
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  Smartphone,
  Globe,
  Radio,
} from 'lucide-react';

interface CalendarSyncModalProps {
  scheduleId: number;
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CalendarSyncModal({
  scheduleId,
  isOpen,
  onClose,
}: CalendarSyncModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Construct absolute webcal and ics URLs
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const apiHost = API_BASE.replace(/^https?:\/\//, '');
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const icsDownloadUrl = `${API_BASE}/export/${scheduleId}?format=ics`;
  const webcalUrl = `webcal://${apiHost}/export/${scheduleId}?format=ics`;
  const googleCalUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
  const outlookCalUrl = `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(webcalUrl)}`;

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(webcalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Calendar Subscription</h3>
              <p className="text-xs text-slate-500">Auto-sync schedule changes directly to your device</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Quick Subscribe Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google Calendar */}
            <a
              href={googleCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                G
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 group-hover:text-indigo-700">Google Calendar</span>
                <span className="block text-[10px] text-slate-500">Add webcal subscription</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
            </a>

            {/* Microsoft Outlook */}
            <a
              href={outlookCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 font-bold text-xs shrink-0">
                O
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 group-hover:text-indigo-700">Outlook 365</span>
                <span className="block text-[10px] text-slate-500">Subscribe on web</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
            </a>

            {/* Apple / Native OS Calendar */}
            <a
              href={webcalUrl}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 group-hover:text-indigo-700">Apple Calendar</span>
                <span className="block text-[10px] text-slate-500">Open webcal link</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
            </a>

            {/* Direct .ics Download */}
            <a
              href={icsDownloadUrl}
              download={`schedule_${scheduleId}.ics`}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 group-hover:text-indigo-700">Download .ICS</span>
                <span className="block text-[10px] text-slate-500">Static iCal file</span>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
            </a>
          </div>

          {/* Webcal Feed Copy Box */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-600" />
              <span>Live Subscription URL (WebCal Feed)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webcalUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 select-all focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              When schedule entries or rooms change in the timetable, subscribed calendars refresh automatically.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-full transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
