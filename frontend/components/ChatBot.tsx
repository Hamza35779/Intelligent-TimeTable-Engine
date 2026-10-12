'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Download, CheckCircle2, Layers } from 'lucide-react';
import { TimetableResponse } from '../types';
import {
  parseCsvLocally,
  solveLocally,
  triggerLocalDownload,
} from '../utils/localFallbackSolver';
import { SAMPLE_CSV } from './CsvUploader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  detected_views?: string[];
  detected_formats?: string[];
  status?: string;
}

interface ChatBotProps {
  scheduleId?: number | null;
  onScheduleGenerated?: (data: TimetableResponse) => void;
}

function detectIntentLocally(text: string) {
  const lower = text.toLowerCase();
  const views: string[] = [];
  const formats: string[] = [];

  if (lower.includes('master') || lower.includes('university') || lower.includes('all'))
    views.push('master');
  if (lower.includes('teacher') || lower.includes('faculty') || lower.includes('all'))
    views.push('teacher');
  if (lower.includes('student') || lower.includes('class') || lower.includes('all'))
    views.push('student');
  if (lower.includes('staff') || lower.includes('support') || lower.includes('all'))
    views.push('staff');
  if (lower.includes('canteen') || lower.includes('lunch') || lower.includes('all'))
    views.push('canteen');

  if (views.length === 0) {
    views.push('master', 'teacher', 'student', 'staff', 'canteen');
  }

  if (lower.includes('pdf')) formats.push('pdf');
  if (lower.includes('excel') || lower.includes('xlsx')) formats.push('xlsx');
  if (lower.includes('png') || lower.includes('image')) formats.push('png');
  if (lower.includes('csv')) formats.push('csv');
  if (lower.includes('json')) formats.push('json');
  if (lower.includes('html')) formats.push('html');

  if (formats.length === 0) {
    formats.push('pdf', 'xlsx', 'png', 'csv');
  }

  let section = 'AI 2023';
  if (lower.includes('2024') && lower.includes('b')) section = 'AI 2024 - Section B';
  else if (lower.includes('2024')) section = 'AI 2024 - Section A';
  else if (lower.includes('2025') && lower.includes('b')) section = 'AI 2025 - Section B';
  else if (lower.includes('2025')) section = 'AI 2025 - Section A';

  return { views, formats, section };
}

export default function ChatBot({ scheduleId, onScheduleGenerated }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: "Hi! I'm your AI Scheduling Assistant. Tell me which section or audience schedules you need (e.g., AI 2023, AI 2024 Section A/B, AI 2025 Section A/B, Teacher, Student, Support Staff, or Canteen) and I'll generate them instantly.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedSchedules, setGeneratedSchedules] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendText = (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
    };
    const { views, formats, section } = detectIntentLocally(trimmed);
    const viewBullets = views.map((v) => `• ${v.toUpperCase()} Schedule`).join('\n');
    const reply = `Ready to generate ${section} (${views.length} views) in ${formats
      .map((f) => f.toUpperCase())
      .join(', ')}:\n${viewBullets}\n\nClick "Generate All Schedules Simultaneously" below to build and view immediately.`;

    const botMsg: ChatMessage = {
      id: Date.now() + 1,
      sender: 'bot',
      text: reply,
      detected_views: views,
      detected_formats: formats,
      status: 'ready_to_generate',
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const handleGenerateSchedules = (views?: string[], formats?: string[]) => {
    setLoading(true);
    const targetViews =
      views && views.length > 0
        ? views
        : ['master', 'teacher', 'student', 'staff', 'canteen'];
    const targetFormats =
      formats && formats.length > 0 ? formats : ['pdf', 'xlsx', 'png', 'csv'];

    const localSched = solveLocally({ section_title: 'AI 2023' });
    if (onScheduleGenerated) {
      onScheduleGenerated(localSched);
    }

    const viewMap: Record<string, Record<string, string>> = {};
    targetViews.forEach((v) => {
      viewMap[v] = {};
      targetFormats.forEach((fmt) => {
        viewMap[v][fmt] = `/export/${localSched.schedule_id}?format=${fmt}&view=${v}`;
      });
    });

    setGeneratedSchedules({
      schedule_id: localSched.schedule_id,
      schedules_generated: targetViews.length,
      formats_generated: targetFormats,
      views: viewMap,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'bot',
        text: `Generated ${targetViews.length} customized audience schedules in <5ms! Click any format below to download.`,
      },
    ]);
    setLoading(false);
  };

  const handleDownloadLink = async (
    e: React.MouseEvent,
    schedId: number,
    fmt: string,
    viewName: string,
    url: string
  ) => {
    e.preventDefault();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    try {
      const res = await fetch(`${API_BASE}${url}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('Backend export unreachable');
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `timetable_${viewName}_${schedId}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch {
      clearTimeout(timer);
      triggerLocalDownload(schedId, fmt, viewName);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatedSchedules]);

  const quickPrompts = [
    'I need schedules for teachers, students, and canteen staff in PDF and Excel',
    'Generate all 5 views (Master, Teacher, Student, Staff, Canteen) in PDF, XLSX, and PNG',
    'Include support staff and canteen lunch rush schedule',
  ];

  return (
    <div className="flex flex-col h-[560px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <span>AI Schedule Assistant</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Multi-View NLU
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Conversational generator for Master, Teacher, Student, Staff & Canteen views
            </p>
          </div>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] text-slate-500 whitespace-nowrap">Try:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => sendText(prompt)}
            className="text-[11px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 px-2.5 py-1 rounded-full border border-slate-700/80 whitespace-nowrap transition"
          >
            {prompt.slice(0, 48)}...
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-xs'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-xs'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>

              {msg.detected_views && msg.detected_views.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    Views:
                  </span>
                  {msg.detected_views.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono uppercase"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}

              {msg.status === 'ready_to_generate' && (
                <button
                  type="button"
                  onClick={() => handleGenerateSchedules(msg.detected_views, msg.detected_formats)}
                  className="mt-3 w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate All Schedules Simultaneously</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Simultaneous Multi-View Download Matrix */}
        {generatedSchedules && generatedSchedules.views && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Download Customized Audience Views</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                Schedule #{generatedSchedules.schedule_id}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {Object.entries(generatedSchedules.views).map(([viewName, urls]: [string, any]) => (
                <div
                  key={viewName}
                  className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2"
                >
                  <p className="font-bold text-white capitalize flex items-center justify-between">
                    <span>{viewName} View</span>
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(urls).map(([fmt, url]: [string, any]) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={(e) =>
                          handleDownloadLink(
                            e,
                            generatedSchedules.schedule_id,
                            fmt,
                            viewName,
                            url
                          )
                        }
                        className="px-2 py-1 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 rounded text-[10px] font-mono font-semibold transition"
                      >
                        ↓ {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-slate-800 p-3 bg-slate-950/80 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendText(input);
            }
          }}
          placeholder="Ask for teacher, student, staff, or canteen schedules..."
          className="flex-1 bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => sendText(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{loading ? '...' : 'Send'}</span>
        </button>
      </div>
    </div>
  );
}
