'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Clock, Sparkles } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Calendar },
  { href: '/build', label: 'Easy Builder', icon: Sparkles },
  { href: '/schedule', label: 'Schedules', icon: Clock },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Clock className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <Link
                href="/"
                className="text-white font-bold text-lg tracking-tight hover:text-emerald-400 transition-colors"
              >
                Timetable Engine
              </Link>
              <span className="block text-[11px] text-emerald-400/80 font-mono">CP-SAT Optimized</span>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
