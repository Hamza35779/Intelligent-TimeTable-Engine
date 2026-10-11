'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import FeedbackForm from '../../../components/FeedbackForm';
import MLStatus from '../../../components/MLStatus';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';

export default function FeedbackPage() {
  const params = useParams();
  const scheduleId = Number(params?.id) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href={`/schedule/${scheduleId}`}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-emerald-400" />
              <span>Faculty Feedback & ML Training — Schedule #{scheduleId}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Submit preference ratings to continuously improve future schedule generations
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <FeedbackForm scheduleId={scheduleId} />
        </div>
        <div className="lg:col-span-5">
          <MLStatus />
        </div>
      </div>
    </div>
  );
}
