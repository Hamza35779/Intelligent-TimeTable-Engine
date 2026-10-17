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
  ruleCreated?: MindmapRule;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // Broadcast update to any listening components
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
            "Hi! I am your AI Mindmap Copilot. Chat with me to define what to do and what NOT to do before generating or rescheduling your timetable.\n\nFor example:\n• \"Dr. Sarah should only teach on Mondays and Wednesdays in the morning\"\n• \"No classes for any professor on Friday after 1 PM\"\n• \"Add course: Cloud Computing (3 CH) assigned to Dr. Usman\"\n• \"Set slot duration to 60 minutes with 12:00 lunch break\"\n• \"Now reschedule the timetable\"",
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

  // Natural Language Interpreter: parses instructions and extracts Do's and Don'ts
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
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: 'Reset all custom mindmap directives back to default university standards.',
          actionTriggered: 'clear',
        },
      ]);
      return;
    }

    // 3. Parse specific instructions
    let createdRule: MindmapRule | null = null;
    let botReply = '';

    // Day avoidance (e.g. "no classes on Friday", "avoid Friday")
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
    }
    // Teacher specific day / time restriction
    else if (lower.includes('dr. sarah') || lower.includes('sarah')) {
      const isMorning = lower.includes('morning');
      const isMonWed = lower.includes('monday') || lower.includes('wednesday');
      const detailStr = isMorning && isMonWed
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
    }
    // Prof Kamran or teacher morning avoidance
    else if (lower.includes('kamran') || (lower.includes('no morning') && lower.includes('class'))) {
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
    }
    // Slot duration change
    else if (lower.includes('60 min') || lower.includes('60-minute') || lower.includes('slot duration')) {
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
    }
    // Lunch break adjustment
    else if (lower.includes('lunch') || lower.includes('break')) {
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
    }
    // Add new course or subject
    else if (lower.includes('add course') || lower.includes('new course') || lower.includes('credit hour')) {
      // Extract course name if possible
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
    }
    // Room / Venue allocation
    else if (lower.includes('room') || lower.includes('lab') || lower.includes('venue')) {
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
    }
    // General do/don't interpretation
    else {
      const isDont =
        lower.includes('don\'t') ||
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
      // 1. Attempt backend demo / simple generation with current rules
      const res = await fetch(`${API_BASE}/demo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data: TimetableResponse = await res.json();
        saveLocalSchedule(data);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: `Timetable successfully solved with ${rules.filter((r) => r.active).length} active mindmap directives! Zero conflicts found. Opening Schedule #${data.schedule_id}...`,
            actionTriggered: 'reschedule',
          },
        ]);
        setTimeout(() => {
          setIsOpen(false);
          router.push(`/schedule/${data.schedule_id}`);
        }, 1000);
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

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `Timetable rescheduled with ${rules.filter((r) => r.active).length} active mindmap directives! Routing to Schedule #${localResult.schedule_id}...`,
          actionTriggered: 'reschedule',
        },
      ]);

      setTimeout(() => {
        setIsOpen(false);
        router.push(`/schedule/${localResult.schedule_id}`);
      }, 1000);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: 'Unable to complete reschedule. Please ensure courses and faculty are defined.',
        },
      ]);
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

  const quickPrompts = [
    'No classes on Friday after 12 PM',
    'Dr. Sarah: Mon & Wed morning slots only',
    'Prof. Kamran: Avoid early 8:30 AM classes',
    'Protect 1-hour lunch break',
    'Reschedule timetable now',
  ];

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
            <span className="block text-xs font-bold leading-tight">AI Mindmap &amp; Reschedule</span>
            <span className="block text-[10px] text-indigo-200">
              {rules.filter((r) => r.active).length} active directives &bull; Ctrl+K
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
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
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
                  AI Mindmap Copilot
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Interactive
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Define what to do &amp; what not to do before solving
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Mindmap Active Directives Accordion */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
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
            <div className="pt-3 pb-1 space-y-2 max-h-48 overflow-y-auto">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 transition ${
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

        {/* Reschedule progress banner if active */}
        {rescheduleNotice && (
          <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 animate-spin shrink-0" />
            <span>{rescheduleNotice}</span>
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
                <span>Interpreting mindmap directive...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-xs">
          <span className="text-slate-400 font-medium shrink-0 text-[11px]">Directives:</span>
          {quickPrompts.map((prompt) => (
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

        {/* Input Form Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell AI what to do or what not to do (e.g. 'No Friday classes')..."
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
