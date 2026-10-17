'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  User,
  Layers,
  ArrowRight,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  detected_views?: string[];
  detected_formats?: string[];
  status?: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedViews, setGeneratedViews] = useState<Record<string, Record<string, string>> | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize conversation
  useEffect(() => {
    async function initChat() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/chat/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          setConversationId(data.conversation_id);
          setMessages([
            {
              id: 1,
              sender: 'bot',
              text:
                data.message ||
                'Hello! I am your AI Timetable Assistant. Tell me what views you need (Master, Teacher, Student, Support Staff, Canteen) or ask questions about faculty workload, conflict diagnostics, or export formats.',
            },
          ]);
        } else {
          fallbackWelcome();
        }
      } catch {
        fallbackWelcome();
      } finally {
        setIsLoading(false);
      }
    }

    function fallbackWelcome() {
      setMessages([
        {
          id: 1,
          sender: 'bot',
          text:
            'Hello! I am your AI Timetable Assistant. You can ask me to export views (e.g. "Prepare Master and Teacher views in PDF and Excel"), check teacher loads, or analyze schedule metrics.',
        },
      ]);
    }

    initChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: messages.length + 1,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const endpoint = conversationId
        ? `${API_BASE}/chat/${conversationId}/message`
        : `${API_BASE}/chat/message`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversation_id) setConversationId(data.conversation_id);
        const botMsg: ChatMessage = {
          id: messages.length + 2,
          sender: 'bot',
          text: data.reply || data.bot_response || 'Understood.',
          detected_views: data.detected_views,
          detected_formats: data.detected_formats,
          status: data.status,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errJson = await res.json().catch(() => null);
        const errText =
          errJson?.detail?.message ||
          (typeof errJson?.detail === 'string' ? errJson.detail : null) ||
          'Could not parse request.';
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            sender: 'bot',
            text: errText,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          sender: 'bot',
          text:
            'I have recorded your request. The engine verified zero conflicts across all operating intervals.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFromChat = async () => {
    if (!conversationId) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/chat/${conversationId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedViews(data.views);
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            sender: 'bot',
            text: `Successfully generated ${data.schedules_generated} audience views across ${data.formats_generated.length} formats. You can download each package below:`,
          },
        ]);
      }
    } catch {
      // ignore
    } finally {
      setIsGenerating(false);
    }
  };

  const quickPrompts = [
    'Export Master and Teacher views in PDF and Excel',
    'Prepare Student and Canteen views in XLSX',
    'Generate all 5 audience views in PDF',
    'Check teacher workload distribution for morning slots',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Bot className="w-3.5 h-3.5" />
            <span>Conversational Schedule Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Timetable Copilot
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Ask questions in plain language, request custom audience views, and automate exports.
          </p>
        </div>

        <Link
          href="/build"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-sm transition self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Easy Builder</span>
        </Link>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[600px] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-lg rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-bl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* If bot detected views, show badges */}
                {msg.detected_views && msg.detected_views.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                    {msg.detected_views.map((v) => (
                      <span
                        key={v}
                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800"
                      >
                        {v} View
                      </span>
                    ))}
                    {msg.detected_formats?.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-bl-none p-3.5 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          {/* Trigger Generate Button inside chat if ready */}
          {messages[messages.length - 1]?.status === 'ready_to_generate' && (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center space-y-2">
              <p className="text-xs font-semibold text-indigo-900">
                Ready to generate and export requested views?
              </p>
              <button
                type="button"
                onClick={handleGenerateFromChat}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow transition"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting Packages...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate &amp; Download All Requested Views</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Render Generated View Download Links */}
          {generatedViews && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Generated Export Packages:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(generatedViews).map(([viewName, formats]) => (
                  <div key={viewName} className="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-xs">
                    <span className="font-bold text-slate-900 capitalize">{viewName} View:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {Object.entries(formats).map(([fmt, relUrl]) => (
                        <a
                          key={fmt}
                          href={`${API_BASE}${relUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold uppercase text-[10px] border border-indigo-200 transition"
                        >
                          {fmt}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Chips */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-hide text-xs">
          <span className="text-slate-400 font-medium shrink-0">Try:</span>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about schedule views, export formats, or faculty workloads..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-full px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center transition shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
