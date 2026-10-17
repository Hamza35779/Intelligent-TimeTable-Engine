import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Easy Timetable Builder | Autonomous Timetable Engine',
  description:
    'Quickly add teachers, courses, configure schedule settings, or import CSV to generate conflict-free university timetables.',
};

export default function BuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
