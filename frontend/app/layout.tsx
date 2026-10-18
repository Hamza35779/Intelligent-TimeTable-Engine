import './globals.css';
import type { Metadata } from 'next';
import Navbar from '../components/Navbar';
import MindmapChatDrawer from '../components/MindmapChatDrawer';

export const metadata: Metadata = {
  title: 'Intelligent Time Table | AI-Powered Scheduling Platform for Universities & Schools',
  description: 'Intelligent Time Table builds conflict-free schedules in seconds using Google OR-Tools CP-SAT and machine learning.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-800 min-h-screen flex flex-col antialiased selection:bg-indigo-600 selection:text-white">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <MindmapChatDrawer />
        <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Intelligent Time Table</span>
              <span>&bull;</span>
              <span>Autonomous Scheduling Platform</span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span>Google OR-Tools CP-SAT</span>
              <span>&bull;</span>
              <span>Machine Learning Preferences</span>
              <span>&bull;</span>
              <span>Conflict-Free Guaranteed</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
