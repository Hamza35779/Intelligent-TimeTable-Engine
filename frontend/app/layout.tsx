import './globals.css';
import type { Metadata } from 'next';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'Autonomous Timetable Optimization Engine',
  description: 'Production-ready constraint-based timetable optimization engine using Google OR-Tools CP-SAT',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
          Intelligent Autonomous Timetable Engine &bull; Powered by Google OR-Tools CP-SAT &bull; Real-time Optimization
        </footer>
      </body>
    </html>
  );
}
