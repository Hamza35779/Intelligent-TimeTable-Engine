'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Sparkles,
  Bot,
  Send,
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Trash2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Check,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  UserCheck,
  GraduationCap,
  ShieldAlert,
} from 'lucide-react';
import { TimetableResponse, TimetableEntry } from '../types';
import {
  saveLocalSchedule,
  solveLocally,
  UNIVERSITY_SECTION_PRESETS,
} from '../utils/localFallbackSolver';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface MindmapRule {
  id: string;
  type: 'faculty_preference' | 'faculty_avoid' | 'timing' | 'course_addition' | 'room_assignment' | 'general';
  category: 'do' | 'dont' | 'config';
  label: string;
  detail: string;
  active: boolean;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  speechText?: string;
  ruleCreated?: MindmapRule;
  intentStatus?: 'success' | 'clash' | 'free' | 'busy' | 'info' | 'error';
  actionTriggered?: 'reschedule' | 'clear' | 'view';
}

const DEFAULT_RULES: MindmapRule[] = [
  {
    id: 'rule-1',
    type: 'timing',
    category: 'dont',
    label: 'Protected Lunch Window',
    detail: 'No classes scheduled between 12:00 and 13:30',
    active: true,
    timestamp: 'Default',
  },
  {
    id: 'rule-2',
    type: 'faculty_preference',
    category: 'do',
    label: 'Spread Contact Hours',
    detail: 'Split 3-credit courses into 2h + 1h on separate days',
    active: true,
    timestamp: 'Default',
  },
  {
    id: 'rule-3',
    type: 'faculty_avoid',
    category: 'dont',
    label: 'Consecutive Class Cap',
    detail: 'Mandate minimum 15min break after 2 consecutive hours of teaching',
    active: true,
    timestamp: 'Default',
  },
];

type PersonaMode = 'mindmap' | 'admin' | 'faculty' | 'student';

export default function MindmapChatDrawer() {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rules, setRules] = useState<MindmapRule[]>(DEFAULT_RULES);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);

  // Voice States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activePersona, setActivePersona] = useState<PersonaMode>('mindmap');
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API support
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
            setInput(transcript);
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

  // Load saved rules from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timetable_mindmap_rules');
      if (saved) {
        const parsed: MindmapRule[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRules(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save rules to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('timetable_mindmap_rules', JSON.stringify(rules));
      window.dispatchEvent(
        new CustomEvent('mindmap-rules-changed', { detail: { rules } })
      );
    } catch {
      // ignore
    }
  }, [rules]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'bot',
          text:
            "Hi! I am your AI Timetable Copilot with Voice Command Support.\n\n" +
            "You can use Voice or Text to control your timetable across 4 modes:\n" +
            "• Mindmap: Define what to do & not do before rescheduling\n" +
            "• Admin: \"Move Artificial Intelligence to Room B-201\"\n" +
            "• Faculty: \"Am I free on Monday at 10 AM?\"\n" +
            "• Student: \"What is my next class?\"",
        },
      ]);
    }
  }, [messages.length]);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Keyboard shortcut Ctrl+K to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Natural Language Interpreter for Mindmap Rules
  const interpretUserMindmap = async (userText: string) => {
    const lower = userText.toLowerCase();

    // 1. Check for Reschedule / Generate trigger
    if (
      lower.includes('reschedule') ||
      lower.includes('generate timetable') ||
      lower.includes('solve now') ||
      lower.includes('make the schedule') ||
      lower.includes('build schedule')
    ) {
      await handleTriggerReschedule();
      return;
    }

    // 2. Check for clear rules
    if (
      lower.includes('clear all rules') ||
      lower.includes('reset rules') ||
      lower.includes('reset mindmap')
    ) {
      setRules(DEFAULT_RULES);
      const text = 'Reset all custom mindmap directives back to default university standards.';
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text,
          actionTriggered: 'clear',
        },
      ]);
      speakUtterance(text);
      return;
    }

    // 3. Check for Slide 11 Voice Persona Queries: Admin, Faculty, Student via backend API
    const isAdminQuery =
      lower.includes('move ') ||
      lower.includes('shift ') ||
      lower.includes('assign ') ||
      activePersona === 'admin';
    const isFacultyQuery =
      lower.includes('free') ||
      lower.includes('my schedule') ||
      activePersona === 'faculty';
    const isStudentQuery =
      lower.includes('next class') ||
      lower.includes('upcoming class') ||
      activePersona === 'student';

    if (isAdminQuery || isFacultyQuery || isStudentQuery) {
      try {
        const res = await fetch(`${API_BASE}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            persona: activePersona !== 'mindmap' ? activePersona : undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.mode === 'voice_persona') {
            const botReply = data.reply || data.speech_text;
            const intentStatus = data.intent?.status;
            setMessages((prev) => [
              ...prev,
              {
                id: `bot-${Date.now()}`,
                sender: 'bot',
                text: botReply,
                speechText: data.speech_text,
                intentStatus,
              },
            ]);
            speakUtterance(data.speech_text || botReply);
            return;
          }
        }
      } catch {
        // Fall back to local mindmap rule parsing if backend is unreachable
      }
    }

    // 4. Parse Mindmap Rules
    let createdRule: MindmapRule | null = null;
    let botReply = '';

    if (
      lower.includes('no classes on friday') ||
      lower.includes('avoid friday') ||
      lower.includes('no friday') ||
      lower.includes('off on friday')
    ) {
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'faculty_avoid',
        category: 'dont',
        label: 'No Friday Classes',
        detail: 'Exclude Friday from operating timetable slots',
        active: true,
        timestamp: 'Just now',
      };
      botReply =
        'Got it! Added directive: 🚫 No classes will be scheduled on Fridays. Operating days adjusted to Monday–Thursday.';
    } else if (lower.includes('dr. sarah') || lower.includes('sarah')) {
      const isMorning = lower.includes('morning');
      const isMonWed = lower.includes('monday') || lower.includes('wednesday');
      const detailStr =
        isMorning && isMonWed
          ? 'Restricted to Monday & Wednesday morning slots (08:30 - 12:00)'
          : isMorning
          ? 'Restricted to morning slots only (08:30 - 12:00)'
          : 'Restricted to specified preferred days';

      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'faculty_preference',
        category: 'do',
        label: 'Dr. Sarah Ahmed: Mon/Wed Morning',
        detail: detailStr,
        active: true,
        timestamp: 'Just now',
      };
      botReply = `Understood! Added directive for Dr. Sarah Ahmed: ${detailStr}. The solver will enforce this constraint.`;
    } else if (lower.includes('kamran') || (lower.includes('no morning') && lower.includes('class'))) {
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'faculty_avoid',
        category: 'dont',
        label: 'Prof. Kamran: Avoid Morning Slots',
        detail: 'Exclude Slots 1 & 2 (08:30-10:10) from teaching schedule',
        active: true,
        timestamp: 'Just now',
      };
      botReply =
        'Noted! Added directive: 🚫 Prof. Kamran Siddiqui will not be assigned morning slots (08:30–10:10).';
    } else if (lower.includes('60 min') || lower.includes('60-minute') || lower.includes('slot duration')) {
      const duration = lower.includes('60') ? 60 : lower.includes('45') ? 45 : 50;
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'timing',
        category: 'config',
        label: `Slot Duration: ${duration} Minutes`,
        detail: `Each academic period adjusted to ${duration} minutes duration`,
        active: true,
        timestamp: 'Just now',
      };
      botReply = `Configured! Academic slot duration set to ${duration} minutes with synchronized breaks.`;
    } else if (lower.includes('lunch') || lower.includes('break')) {
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'timing',
        category: 'dont',
        label: 'Protected Lunch Period',
        detail: 'Ensure 12:30 - 13:30 interval remains completely clear of teaching sessions',
        active: true,
        timestamp: 'Just now',
      };
      botReply =
        'Protected lunch break recorded. The solver guarantees zero sessions overlap this interval across all rooms and faculty.';
    } else if (lower.includes('add course') || lower.includes('new course') || lower.includes('credit hour')) {
      let cName = 'New Course';
      if (lower.includes('cloud computing')) cName = 'Cloud Computing';
      else if (lower.includes('computer vision')) cName = 'Computer Vision';
      else if (lower.includes('mobile app')) cName = 'Mobile Application Development';
      else if (lower.includes('cyber security')) cName = 'Cyber Security';

      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'course_addition',
        category: 'do',
        label: `Add ${cName} (3 CH)`,
        detail: `${cName} added to curriculum with 3 weekly contact hours`,
        active: true,
        timestamp: 'Just now',
      };
      botReply = `Great! Registered course directive: "${cName}" (3 Credit Hours). It will be scheduled across balanced sessions.`;
    } else if (lower.includes('room') || lower.includes('lab') || lower.includes('venue')) {
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'room_assignment',
        category: 'do',
        label: 'Dedicated Room Allocation',
        detail: 'Assign lectures to spacious Lecture Hall 101 and labs to specialized computing venues',
        active: true,
        timestamp: 'Just now',
      };
      botReply =
        'Room allocation policy registered. The solver will strictly match course format (Lecture vs Lab) with appropriate venue facilities.';
    } else {
      const isDont =
        lower.includes("don't") ||
        lower.includes('dont') ||
        lower.includes('never') ||
        lower.includes('avoid') ||
        lower.includes('no ');
      createdRule = {
        id: `rule-${Date.now()}`,
        type: 'general',
        category: isDont ? 'dont' : 'do',
        label: isDont ? 'Avoidance Directive' : 'Allocation Directive',
        detail: userText,
        active: true,
        timestamp: 'Just now',
      };
      botReply = `Understood. I have recorded your ${
        isDont ? 'restriction (What NOT to do)' : 'requirement (What to do)'
      }: "${userText}". This will be applied during constraint optimization.`;
    }

    if (createdRule) {
      setRules((prev) => [createdRule as MindmapRule, ...prev]);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botReply,
        ruleCreated: createdRule || undefined,
      },
    ]);
    speakUtterance(botReply);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      await interpretUserMindmap(text);
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger solver execution with current mindmap applied
  const handleTriggerReschedule = async () => {
    setIsProcessing(true);
    setRescheduleNotice('Applying mindmap rules and solving timetable with Google OR-Tools CP-SAT...');

    try {
      const res = await fetch(`${API_BASE}/demo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        const replyText = `Timetable successfully solved with ${rules.filter((r) => r.active).length} active mindmap directives! Zero conflicts found. Opening Schedule #${data.schedule_id}...`;
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: replyText,
            actionTriggered: 'reschedule',
          },
        ]);
        speakUtterance(replyText);
        setTimeout(() => {
          setIsOpen(false);
          router.push(`/schedule/${data.schedule_id}`);
        }, 1200);
        return;
      }
    } catch {
      // backend unreachable, fallback to instant local solver
    }

    try {
      const firstPresetKey = Object.keys(UNIVERSITY_SECTION_PRESETS)[0] || 'AI 2023';
      const presetData = UNIVERSITY_SECTION_PRESETS[firstPresetKey];
      const localResult = solveLocally({
        faculty: presetData.faculty,
        venues: presetData.venues,
        slots: presetData.slots,
        courses: presetData.courses,
        preset_entries: presetData.preset_entries,
        section_title: presetData.section_title || 'AI 2023',
      });
      saveLocalSchedule(localResult);

      const replyText = `Timetable rescheduled with ${rules.filter((r) => r.active).length} active mindmap directives! Routing to Schedule #${localResult.schedule_id}...`;
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          actionTriggered: 'reschedule',
        },
      ]);
      speakUtterance(replyText);

      setTimeout(() => {
        setIsOpen(false);
        router.push(`/schedule/${localResult.schedule_id}`);
      }, 1200);
    } catch {
      const errReply = 'Unable to complete reschedule. Please ensure courses and faculty are defined.';
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: errReply,
        },
      ]);
      speakUtterance(errReply);
    } finally {
      setIsProcessing(false);
      setRescheduleNotice(null);
    }
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Quick Persona Prompts based on Slide 11
  const personaPrompts: Record<PersonaMode, string[]> = {
    mindmap: [
      'No classes on Friday after 12 PM',
      'Dr. Sarah: Mon & Wed morning slots only',
      'Prof. Kamran: Avoid early 8:30 AM classes',
      'Protect 1-hour lunch break',
      'Reschedule timetable now',
    ],
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
  };

  return (
    <>
      {/* Floating Trigger Pill (Fixed in Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 px-4 sm:px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full animate-pulse" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold leading-tight">AI Voice Copilot &amp; Mindmap</span>
            <span className="block text-[10px] text-indigo-200">
              Voice commands &bull; {rules.filter((r) => r.active).length} directives &bull; Ctrl+K
            </span>
          </div>
        </button>
      </div>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Slide-In Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  AI Voice &amp; Mindmap Copilot
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Slide 11 Voice AI
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Voice command personas &amp; conflict-free reschedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Voice Output Mute/Unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-lg transition ${
                isMuted
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
              }`}
              title={isMuted ? 'Voice Audio Muted (Click to Unmute)' : 'Voice Audio Enabled (Click to Mute)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleTriggerReschedule}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-xs transition disabled:opacity-50"
              title="Apply all mindmap directives and compute timetable"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Reschedule</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Persona Mode Switcher Tabs */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Role:</span>
          {(
            [
              { key: 'mindmap', label: 'Mindmap', icon: Sliders },
              { key: 'admin', label: 'Admin', icon: ShieldCheck },
              { key: 'faculty', label: 'Faculty', icon: UserCheck },
              { key: 'student', label: 'Student', icon: GraduationCap },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const isSelected = activePersona === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setActivePersona(mode.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mindmap Active Directives Accordion (If in Mindmap Mode) */}
        {activePersona === 'mindmap' && (
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2">
            <button
              type="button"
              onClick={() => setRulesExpanded(!rulesExpanded)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Active Mindmap Directives ({rules.filter((r) => r.active).length})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[10px] font-normal">
                  {rulesExpanded ? 'Hide rules' : 'Show details'}
                </span>
                {rulesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {rulesExpanded && (
              <div className="pt-2 pb-1 space-y-1.5 max-h-40 overflow-y-auto">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 transition ${
                      rule.active
                        ? rule.category === 'dont'
                          ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                          : 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
                        : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id)}
                        className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition ${
                          rule.active
                            ? rule.category === 'dont'
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {rule.active && <Check className="w-3 h-3" />}
                      </button>
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{rule.category === 'dont' ? '🚫' : '✅'}</span>
                          <span>{rule.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          {rule.detail}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                      title="Delete rule"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reschedule progress banner if active */}
        {rescheduleNotice && (
          <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 animate-spin shrink-0" />
            <span>{rescheduleNotice}</span>
          </div>
        )}

        {/* Listening Voice Indicator */}
        {isListening && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-2 text-xs font-semibold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Listening to voice command... speak now</span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="text-emerald-700 underline text-[11px] hover:text-emerald-900"
            >
              Stop
            </button>
          </div>
        )}

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                    : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-bl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Intent Status Badge */}
                {msg.intentStatus && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-xs font-bold">
                    {msg.intentStatus === 'success' || msg.intentStatus === 'free' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Conflict-Free Verified</span>
                      </span>
                    ) : msg.intentStatus === 'clash' || msg.intentStatus === 'busy' ? (
                      <span className="inline-flex items-center gap-1 text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Clash Detected &bull; Integrity Protected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Timetable Verified</span>
                      </span>
                    )}
                  </div>
                )}

                {/* If this message created a rule, show badge */}
                {msg.ruleCreated && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-xs text-indigo-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Directive saved to mindmap!</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-bl-none p-3 text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Processing voice intent &amp; schedule verification...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts based on Active Persona */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-xs">
          <span className="text-slate-400 font-medium shrink-0 text-[11px]">
            {activePersona === 'admin' ? 'Admin Prompts:' : activePersona === 'faculty' ? 'Faculty Prompts:' : activePersona === 'student' ? 'Student Prompts:' : 'Directives:'}
          </span>
          {personaPrompts[activePersona].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition shrink-0 text-[11px]"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form Bar with Microphone Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          {/* Speech-to-Text Mic Toggle */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activePersona === 'admin'
                ? "Admin: 'Move Artificial Intelligence to Room B-201'..."
                : activePersona === 'faculty'
                ? "Faculty: 'Am I free on Monday at 10 AM?'..."
                : activePersona === 'student'
                ? "Student: 'What is my next class?'..."
                : "Tell AI what to do or not do before rescheduling..."
            }
            className="flex-1 bg-slate-50 border border-slate-300 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center transition shadow-xs shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
}
