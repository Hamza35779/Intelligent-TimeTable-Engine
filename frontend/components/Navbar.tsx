'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Calendar, Users, Bot, ArrowRight, Layers } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: Calendar },
  { href: '/build', label: 'Timetable Builder', icon: Sparkles },
  { href: '/schedule', label: 'Schedules', icon: Layers },
  { href: '/substitutes', label: 'Substitutes', icon: Users },
  { href: '/assistant', label: 'AI Assistant', icon: Bot },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <defs>
                  <linearGradient id="tmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#818CF8" />
                  </linearGradient>
                </defs>
                <rect x="4" y="4" width="24" height="24" rx="6" fill="url(#tmGrad)" />
                <rect x="8" y="8" width="7" height="7" rx="2" fill="white" opacity="0.95" />
                <rect x="17" y="8" width="7" height="7" rx="2" fill="white" opacity="0.65" />
                <rect x="8" y="17" width="7" height="7" rx="2" fill="white" opacity="0.65" />
                <rect x="17" y="17" width="7" height="7" rx="2" fill="white" opacity="0.95" />
              </svg>
            </div>
            <div className="relative inline-flex items-baseline select-none">
              <span className="text-indigo-600 font-light italic tracking-tight text-xl sm:text-2xl">timetable</span>
              <span className="text-indigo-600 font-extrabold italic tracking-tight text-xl sm:text-2xl">master</span>
              <span className="ml-1 inline-flex items-center justify-center rounded-full font-bold not-italic bg-indigo-600 text-white text-[9px] w-4 h-4 leading-none">
                TM
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-indigo-600 bg-indigo-50 font-semibold'
                      : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* CTA Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/build"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-full shadow-sm hover:shadow transition-all"
            >
              <span>Build Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
