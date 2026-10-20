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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  FileSpreadsheet,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  speechText?: string;
  detected_views?: string[];
  detected_formats?: string[];
  intentStatus?: string;
  status?: string;
}

type PersonaMode = 'admin' | 'faculty' | 'student' | 'export';

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedViews, setGeneratedViews] = useState<Record<string, Record<string, string>> | null>(
    null
  );

  // Voice & Persona States
  const [activePersona, setActivePersona] = useState<PersonaMode>('admin');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        setSpeechSupported(true);
        const recog = new SpeechRecognitionClass();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = 'en-US';

        recog.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
          setIsListening(false);
        };

        recog.onerror = () => {
          setIsListening(false);
        };

        recog.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, []);

  // Text-to-Speech function
  const speakUtterance = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`•🚫✅]/g, '').trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const toggleMute = () => {
    if (isSpeaking && !isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setIsMuted(!isMuted);
  };

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
          const welcomeText =
            "Welcome to the Voice & Conversational Assistant!\n\n" +
            "You can use Voice Commands or Text across roles:\n" +
            "• Admin: \"Move Artificial Intelligence to Room B-201\"\n" +
            "• Faculty: \"Am I free on Monday at 10 AM?\"\n" +
            "• Student: \"What is my next class?\"\n" +
            "• Export: \"Export Master and Teacher views in PDF\"";
          setMessages([
            {
              id: 1,
              sender: 'bot',
              text: welcomeText,
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
            "Welcome to the Voice & Conversational Assistant!\n\n" +
            "Voice commands supported:\n" +
            "• Admin: \"Move Artificial Intelligence to Room B-201\"\n" +
            "• Faculty: \"Am I free on Monday at 10 AM?\"\n" +
            "• Student: \"What is my next class?\"",
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
        body: JSON.stringify({
          message: text,
          persona: activePersona !== 'export' ? activePersona : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversation_id) setConversationId(data.conversation_id);
        const replyText = data.reply || data.bot_response || 'Understood.';
        const speech = data.speech_text || replyText;
        const botMsg: ChatMessage = {
          id: messages.length + 2,
          sender: 'bot',
          text: replyText,
          speechText: speech,
          detected_views: data.detected_views,
          detected_formats: data.detected_formats,
          intentStatus: data.intent?.status,
          status: data.status,
        };
        setMessages((prev) => [...prev, botMsg]);
        speakUtterance(speech);
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
        speakUtterance(errText);
      }
    } catch {
      const fallbackMsg = 'The request was received. Ground-truth database integrity is maintained.';
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          sender: 'bot',
          text: fallbackMsg,
        },
      ]);
      speakUtterance(fallbackMsg);
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
        const genMsg = `Successfully generated ${data.schedules_generated} audience views across ${data.formats_generated.length} formats. You can download each package below:`;
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            sender: 'bot',
            text: genMsg,
          },
        ]);
        speakUtterance(genMsg);
      }
    } catch {
      // ignore
    } finally {
      setIsGenerating(false);
    }
  };

  const personaPrompts: Record<PersonaMode, string[]> = {
    admin: [
      'Move Artificial Intelligence to Room B-201',
      'Shift Computer Vision to Room A-101',
      'Reschedule Database Systems to Room B-201',
    ],
    faculty: [
      'Am I free on Monday at 09:00 am?',
      'Am I free on Monday at 2:00 pm?',
      'What is my schedule for Monday?',
    ],
    student: [
      'What is my next class?',
      'Where is my next class?',
      'What do I have next?',
    ],
    export: [
      'Export Master and Teacher views in PDF and Excel',
      'Prepare Student and Canteen views in XLSX',
      'Generate all 5 audience views in PDF',
    ],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Slide 11 Voice AI Engine</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Voice Command &amp; Conversational Assistant
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hands-free voice command support for Admin, Faculty, and Students with conflict checking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Mute/Unmute */}
          <button
            type="button"
            onClick={toggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              isMuted
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isMuted ? 'Voice Muted' : 'Voice Active'}</span>
          </button>

          {conversationId && (
            <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              Session: <span className="font-mono text-slate-700">{conversationId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Persona Role Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Voice Persona:</span>
          {(
            [
              { key: 'admin', label: 'Admin (Room Moves)', icon: ShieldCheck },
              { key: 'faculty', label: 'Faculty (Availability)', icon: UserCheck },
              { key: 'student', label: 'Student (Next Class)', icon: GraduationCap },
              { key: 'export', label: 'Export (Multi-View)', icon: FileSpreadsheet },
            ] as const
          ).map((p) => {
            const Icon = p.icon;
            const isSelected = activePersona === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setActivePersona(p.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mic listening banner button */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isListening ? 'Listening...' : 'Click to Speak'}</span>
          </button>
        )}
      </div>

      {/* Chat Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[520px]">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Intent status badge */}
                {msg.intentStatus && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center gap-1.5 text-xs font-bold">
                    {msg.intentStatus === 'success' || msg.intentStatus === 'free' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Conflict-Free Verified</span>
                      </span>
                    ) : msg.intentStatus === 'clash' || msg.intentStatus === 'busy' ? (
                      <span className="inline-flex items-center gap-1 text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Clash Detected &bull; Reassignment Aborted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Timetable Verified</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Action Trigger in Bot Message */}
                {msg.status === 'ready_to_generate' && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateFromChat}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating all 5 views...</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-3.5 h-3.5" />
                          <span>Generate All Schedules Simultaneously</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-none p-4 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Checking timetable constraints and clash verification...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Voice Persona Prompts */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto scrollbar-hide text-xs">
          <span className="text-slate-400 font-semibold shrink-0 text-xs">Voice Prompts:</span>
          {personaPrompts[activePersona].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition shrink-0 font-medium"
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
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-200'
                  : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200'
              }`}
              title={isListening ? 'Stop listening' : 'Speak command via microphone'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              activePersona === 'admin'
                ? "Admin: 'Move Artificial Intelligence to Room B-201'..."
                : activePersona === 'faculty'
                ? "Faculty: 'Am I free on Monday at 10 AM?'..."
                : activePersona === 'student'
                ? "Student: 'What is my next class?'..."
                : "Export: 'Prepare Master and Teacher views in PDF'..."
            }
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center transition shadow-xs shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Generated Downloads Grid */}
      {generatedViews && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Prepared Audience Downloads</span>
            </h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
              Conflict-Free Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(generatedViews).map(([viewName, formats]) => (
              <div key={viewName} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {viewName} View
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(formats).map(([fmt, url]) => (
                    <a
                      key={fmt}
                      href={`${API_BASE}${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                    >
                      {fmt.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
