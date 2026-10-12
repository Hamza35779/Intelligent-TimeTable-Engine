'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Download, CheckCircle2, Layers } from 'lucide-react';
import { TimetableResponse } from '../types';
import {
  solveLocally,
  triggerLocalDownload,
} from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  mode?: string;
  detected_views?: string[];
  detected_formats?: string[];
  status?: string;
}

interface ChatBotProps {
  scheduleId?: number | null;
  onScheduleGenerated?: (data: TimetableResponse) => void;
}

export default function ChatBot({ scheduleId, onScheduleGenerated }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: "Hi! I'm your AI Scheduling Assistant. Tell me which views (master, teacher, student, staff, canteen) and export formats (csv, xlsx, pdf, png, jpg, json, html) you need.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<string>('keyword_fallback');
  const [generatedSchedules, setGeneratedSchedules] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendText = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          schedule_id: scheduleId ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg =
          data?.detail?.message ||
          (typeof data?.detail === 'string' ? data.detail : 'Invalid request');
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: `Rejected (400): ${errMsg}`,
            mode: data?.detail?.mode || activeMode,
            status: 'error',
          },
        ]);
        return;
      }

      if (data.mode) setActiveMode(data.mode);
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.bot_response,
        mode: data.mode,
        detected_views: data.detected_views || [],
        detected_formats: data.detected_formats || [],
        status: data.status,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Ready to generate views in PDF, XLSX, PNG, and CSV.',
        mode: 'keyword_fallback',
        detected_views: ['master', 'teacher', 'student', 'staff', 'canteen'],
        detected_formats: ['pdf', 'xlsx', 'png', 'csv'],
        status: 'ready_to_generate',
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedules = async (views?: string[], formats?: string[]) => {
    setLoading(true);
    const targetViews =
      views && views.length > 0
        ? views
        : ['master', 'teacher', 'student', 'staff', 'canteen'];
    const targetFormats =
      formats && formats.length > 0 ? formats : ['pdf', 'xlsx', 'png', 'csv'];

    try {
      let targetSchedId = scheduleId;
      if (!targetSchedId) {
        const demoRes = await fetch(`${API_BASE}/demo/run`, { method: 'POST' });
        if (demoRes.ok) {
          const demoData: TimetableResponse = await demoRes.json();
          targetSchedId = demoData.schedule_id;
          if (onScheduleGenerated) onScheduleGenerated(demoData);
        }
      }

      if (targetSchedId) {
        const res = await fetch(`${API_BASE}/chat/generate-schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule_id: targetSchedId,
            views: targetViews,
            formats: targetFormats,
          }),
        });
        if (res.ok) {
          const genData = await res.json();
          if (genData.mode) setActiveMode(genData.mode);
          setGeneratedSchedules(genData);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              sender: 'bot',
              mode: genData.mode,
              text: `Generated ${genData.schedules_generated} customized audience schedules (${targetViews.join(', ')}) for Schedule #${targetSchedId}. Click any format below to download.`,
            },
          ]);
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }

    const localSched = solveLocally({ section_title: 'AI 2024 - Section A' });
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
  };

  const handleDownloadLink = async (
    e: React.MouseEvent,
    schedId: number,
    fmt: string,
    viewName: string,
    url: string
  ) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}${url}`);
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
      triggerLocalDownload(schedId, fmt, viewName);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatedSchedules]);

  const quickPrompts = [
    'Generate teacher and student schedules in PDF and Excel',
    'Generate all 5 views (Master, Teacher, Student, Staff, Canteen) in PDF, XLSX, and PNG',
    'Show canteen lunch rush and support staff views in HTML and CSV',
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
                mode: {activeMode}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Extracts structured views &amp; export formats via Gemini or deterministic keyword parser
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
                  : msg.status === 'error'
                  ? 'bg-rose-950/50 border border-rose-500/40 text-rose-200 rounded-bl-xs'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-xs'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>

              {msg.mode && msg.sender === 'bot' && (
                <div className="mt-1.5 text-[10px] font-mono text-slate-400">
                  Parser mode: <span className="text-emerald-400">{msg.mode}</span>
                </div>
              )}

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
                  <span>Generate Requested Views &amp; Formats</span>
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
                        &darr; {fmt.toUpperCase()}
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
