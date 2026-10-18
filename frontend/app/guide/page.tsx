'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Upload,
  Table as TableIcon,
  Sliders,
  CheckCircle2,
  Calendar,
  Users,
  Building,
  Coffee,
  FileSpreadsheet,
  Bot,
  BrainCircuit,
  Info,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-3">
                <BookOpen className="w-3.5 h-3.5" />
                Official Documentation &amp; User Manual
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Intelligent Timetable Engine: User Guide
              </h1>
              <p className="mt-2 text-slate-600 max-w-2xl text-sm leading-relaxed">
                Complete operational reference manual for university administrators, registrars, and department heads.
                Learn how to upload or enter datasets, configure timetable constraints, generate conflict-free schedules,
                and distribute views to faculty, classes, staff, and canteen management.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/build"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all"
              >
                <span>Launch Engine</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Section 1: What the software does */}
        <section id="section-1" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">1</span>
            What the software does
          </h2>
          <div className="prose prose-slate max-w-none text-slate-700 space-y-3 text-sm leading-relaxed">
            <p>
              You give it the list of teachers and courses, and it produces complete timetables for the whole university.
              It makes sure no teacher, room, or student group is booked twice at the same time, that lunch is protected,
              and that teachers get breaks. It then produces separate schedules for the university, each class, each teacher,
              support staff, and the canteen, in the file formats you choose.
            </p>
            <p className="font-semibold text-slate-900">You can give it the data in two ways:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                  <Upload className="w-4 h-4" />
                  Option A: Upload a dataset file
                </div>
                <p className="text-xs text-slate-600">
                  Upload a standard CSV or Excel file containing courses, faculty, and credit hours.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                  <TableIcon className="w-4 h-4" />
                  Option B: Fill in a table on screen
                </div>
                <p className="text-xs text-slate-600">
                  Type courses directly into the interactive grid row-by-row with instant validation.
                </p>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              Both paths are mathematically normalized and lead to the exact same solver result.
            </div>
          </div>
        </section>

        {/* Section 2: Main features */}
        <section id="section-2" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">2</span>
            Main features
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">What it is</th>
                  <th className="py-3 px-4">Who uses it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Data upload</td>
                  <td className="py-3 px-4">Load a CSV or Excel file of teachers and courses.</td>
                  <td className="py-3 px-4 text-slate-600">Registrar or admin</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Data entry table</td>
                  <td className="py-3 px-4">A table on screen where you type teachers and courses row by row.</td>
                  <td className="py-3 px-4 text-slate-600">Registrar or admin, when no file exists</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Schedule settings</td>
                  <td className="py-3 px-4">Set the days, start and end time, class length, lunch, and break rules. Defaults are filled in.</td>
                  <td className="py-3 px-4 text-slate-600">Registrar or admin</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Automatic timetable generation</td>
                  <td className="py-3 px-4">Builds one conflict-free timetable for the whole university.</td>
                  <td className="py-3 px-4 text-slate-600">Automatic (OR-Tools CP-SAT)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Conflict checker</td>
                  <td className="py-3 px-4">Confirms that no teacher, room, or group is double-booked and that lunch is clear. It runs on every result.</td>
                  <td className="py-3 px-4 text-slate-600">Automatic</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Master schedule</td>
                  <td className="py-3 px-4">One full grid showing every class, teacher, and room.</td>
                  <td className="py-3 px-4 text-slate-600">Administration</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Teacher schedules</td>
                  <td className="py-3 px-4">One schedule per teacher showing only their classes.</td>
                  <td className="py-3 px-4 text-slate-600">Each teacher</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Class (student group) schedules</td>
                  <td className="py-3 px-4">One schedule per student group, with breaks marked.</td>
                  <td className="py-3 px-4 text-slate-600">Each class</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Staff schedule</td>
                  <td className="py-3 px-4">Hour-by-hour view of how busy the rooms are, so support staff can plan.</td>
                  <td className="py-3 px-4 text-slate-600">Maintenance, security, cleaning</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Canteen schedule</td>
                  <td className="py-3 px-4">Hour-by-hour estimate of how many students are in classes, showing when the rush is.</td>
                  <td className="py-3 px-4 text-slate-600">Canteen and cafeteria staff</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Export</td>
                  <td className="py-3 px-4">Download any schedule as Excel, CSV, PDF, PNG, JPG, JSON, or HTML.</td>
                  <td className="py-3 px-4 text-slate-600">Anyone who receives a schedule</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Assistant (chatbot)</td>
                  <td className="py-3 px-4">Type a request in plain words, such as &quot;teacher schedules as PDF,&quot; and it prepares the export.</td>
                  <td className="py-3 px-4 text-slate-600">Anyone</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Preference learning</td>
                  <td className="py-3 px-4">Learns teacher time preferences from feedback and uses them as a soft suggestion. It never overrides a hard rule.</td>
                  <td className="py-3 px-4 text-slate-600">Automatic, after feedback is collected</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Health check</td>
                  <td className="py-3 px-4">Shows whether each part of the system is running.</td>
                  <td className="py-3 px-4 text-slate-600">Technical staff</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Input option A: Upload a dataset */}
        <section id="section-3" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">3</span>
            Input option A: Upload a dataset
          </h2>
          <div className="space-y-4 text-sm text-slate-700">
            <p>Prepare a file (CSV or Excel) with these columns:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                    <th className="py-2.5 px-3">Column</th>
                    <th className="py-2.5 px-3">Required</th>
                    <th className="py-2.5 px-3">Example</th>
                    <th className="py-2.5 px-3">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">teacher_name</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">Yes</td>
                    <td className="py-2.5 px-3">Dr. Ahmad Ali</td>
                    <td className="py-2.5 px-3">Teacher for the course</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">course_name</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">Yes</td>
                    <td className="py-2.5 px-3">Data Structures</td>
                    <td className="py-2.5 px-3">Name of the course</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">credit_hours</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">Yes</td>
                    <td className="py-2.5 px-3">3</td>
                    <td className="py-2.5 px-3">Weekly contact hours (1 to 4)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">student_group</td>
                    <td className="py-2.5 px-3 text-slate-500">No</td>
                    <td className="py-2.5 px-3">CS-2024-A</td>
                    <td className="py-2.5 px-3">Class that attends the course. If blank, course is its own group.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">preferred_time</td>
                    <td className="py-2.5 px-3 text-slate-500">No</td>
                    <td className="py-2.5 px-3">Morning</td>
                    <td className="py-2.5 px-3">Morning, Afternoon, Evening, or blank</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
              teacher_name,course_name,credit_hours,student_group,preferred_time<br />
              Dr. Ahmad Ali,Data Structures,3,CS-2024-A,Morning<br />
              Ms. Fatima Khan,Database Systems,4,CS-2024-A,Afternoon<br />
              Mr. Hassan Khan,Web Development,3,CS-2024-B,
            </div>

            <div className="space-y-1 text-slate-700">
              <p className="font-semibold text-slate-900">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong>Upload dataset</strong>.</li>
                <li>Choose your CSV or Excel file.</li>
                <li>The system checks the file and shows a preview of the rows.</li>
                <li>Fix any listed errors (see section 6), then click <strong>Load data</strong>.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section 4: Input option B: Fill in the table */}
        <section id="section-4" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">4</span>
            Input option B: Fill in the table
          </h2>
          <div className="space-y-4 text-sm text-slate-700">
            <p>Use this when no file exists. The table has one row per course:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                    <th className="py-2.5 px-3">Teacher name</th>
                    <th className="py-2.5 px-3">Course name</th>
                    <th className="py-2.5 px-3">Credit hours</th>
                    <th className="py-2.5 px-3">Student group</th>
                    <th className="py-2.5 px-3">Preferred time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr>
                    <td className="py-2 px-3 text-slate-500">(type here)</td>
                    <td className="py-2 px-3 text-slate-500">(type here)</td>
                    <td className="py-2 px-3 text-indigo-700 font-semibold">(1 to 4)</td>
                    <td className="py-2 px-3 text-slate-500">(optional)</td>
                    <td className="py-2 px-3 text-slate-500">(choose from list, or blank)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-slate-700">
              <p className="font-semibold text-slate-900">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong>Enter data manually</strong>.</li>
                <li>Type a teacher and course in each row. Use <strong>Add row</strong> for more rows and the trash icon to remove a row.</li>
                <li>Credit hours are a dropdown from 1 to 4.</li>
                <li>Preferred time is a dropdown: Morning, Afternoon, Evening, or blank.</li>
                <li>Click <strong>Save table</strong>. The system checks the rows (section 6) and then loads them, just like an uploaded file.</li>
              </ol>
            </div>
            <p className="text-xs text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
              💡 <strong>Tip:</strong> You can also click <strong>Download template</strong> to get the CSV layout, fill it in offline, and upload it.
            </p>
          </div>
        </section>

        {/* Section 5: Settings and the full procedure */}
        <section id="section-5" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">5</span>
            Settings and the full procedure
          </h2>
          <div className="space-y-6 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Settings (defaults are already filled in)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                      <th className="py-2.5 px-3">Setting</th>
                      <th className="py-2.5 px-3">Default</th>
                      <th className="py-2.5 px-3">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Days</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">Monday to Friday</td>
                      <td className="py-2.5 px-3">Days classes run</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Day start</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">09:00</td>
                      <td className="py-2.5 px-3">First possible class time</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Day end</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">17:00</td>
                      <td className="py-2.5 px-3">Last class must finish by this time</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Class length</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">60 minutes</td>
                      <td className="py-2.5 px-3">One teaching slot</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Lunch</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">12:00 to 14:00</td>
                      <td className="py-2.5 px-3">No classes during this time</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Break</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">15 minutes</td>
                      <td className="py-2.5 px-3">Break after two consecutive hours of teaching</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Gap between a teacher&apos;s classes</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">30 minutes</td>
                      <td className="py-2.5 px-3">Minimum rest between classes on the same day</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Maximum teaching per day</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">6 hours</td>
                      <td className="py-2.5 px-3">Per teacher</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Rooms</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">5 rooms (Room 1 to Room 5)</td>
                      <td className="py-2.5 px-3">Rooms available for classes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 text-sm">Step by step procedure</h3>
              <ol className="list-decimal list-inside space-y-2 text-xs">
                <li><strong>Load data:</strong> upload a file (option A) or fill in the table (option B).</li>
                <li><strong>Check settings:</strong> keep the defaults or change them.</li>
                <li><strong>Click &quot;Generate all schedules.&quot;</strong></li>
                <li><strong>Wait for the result:</strong> the system shows solve time and whether the timetable is OPTIMAL, FEASIBLE, or INFEASIBLE.</li>
                <li><strong>Review:</strong> open master schedule, then teacher, class, staff, or canteen views.</li>
                <li><strong>Export:</strong> choose a schedule and format, or click <strong>Export all</strong> to download every format.</li>
                <li><strong>Optional:</strong> use the Assistant to ask for specific outputs, or submit teacher feedback.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section 6: Input checking (validation) */}
        <section id="section-6" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">6</span>
            What the software checks
          </h2>
          <div className="space-y-3 text-sm text-slate-700">
            <p>Before generating, it automatically validates your dataset against these constraints:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                    <th className="py-2.5 px-3">Message</th>
                    <th className="py-2.5 px-3">Meaning</th>
                    <th className="py-2.5 px-3">What to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-rose-700">&quot;Teacher name is missing&quot;</td>
                    <td className="py-2.5 px-3">A row has no teacher</td>
                    <td className="py-2.5 px-3 text-slate-600">Fill in the name</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-rose-700">&quot;Course name is missing&quot;</td>
                    <td className="py-2.5 px-3">A row has no course</td>
                    <td className="py-2.5 px-3 text-slate-600">Fill in the course</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-rose-700">&quot;Credit hours must be 1 to 4&quot;</td>
                    <td className="py-2.5 px-3">Value outside range</td>
                    <td className="py-2.5 px-3 text-slate-600">Enter 1, 2, 3, or 4</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-rose-700">&quot;Duplicate: this teacher already teaches this course&quot;</td>
                    <td className="py-2.5 px-3">Same teacher and course twice</td>
                    <td className="py-2.5 px-3 text-slate-600">Remove one row or change the course name</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-amber-700">&quot;Teacher X needs N hours but only M are free&quot;</td>
                    <td className="py-2.5 px-3">Too many hours for the time window</td>
                    <td className="py-2.5 px-3 text-slate-600">Extend the day, shorten the window, or reduce the load</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-rose-700">&quot;No valid timetable found&quot;</td>
                    <td className="py-2.5 px-3">The rules cannot all be met together</td>
                    <td className="py-2.5 px-3 text-slate-600">Relax a setting or reduce courses; the message lists the cause</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 7: Who gets which schedule */}
        <section id="section-7" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">7</span>
            Who gets which schedule
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                  <th className="py-2.5 px-3">Output</th>
                  <th className="py-2.5 px-3">Contents</th>
                  <th className="py-2.5 px-3">Recipients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Master schedule</td>
                  <td className="py-2.5 px-3">All classes, times, rooms, teachers</td>
                  <td className="py-2.5 px-3 text-slate-600">Administration, planning committee</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Teacher schedule (one per teacher)</td>
                  <td className="py-2.5 px-3">Only their classes, total hours, days taught</td>
                  <td className="py-2.5 px-3 text-slate-600">Each teacher</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Class schedule (one per student group)</td>
                  <td className="py-2.5 px-3">Their classes, times, rooms, teachers, breaks</td>
                  <td className="py-2.5 px-3 text-slate-600">Each class</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Staff schedule</td>
                  <td className="py-2.5 px-3">Hourly room activity: busy, moderate, or quiet</td>
                  <td className="py-2.5 px-3 text-slate-600">Maintenance, security, cleaning</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Canteen schedule</td>
                  <td className="py-2.5 px-3">Hourly estimated students in classes, and rush times</td>
                  <td className="py-2.5 px-3 text-slate-600">Canteen and cafeteria staff</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500 italic">
            * Note on the canteen figures: these are estimates based on how many students are in classes in each hour. They are not sales or attendance records.
          </p>
        </section>

        {/* Section 8: Output formats */}
        <section id="section-8" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">8</span>
            Output formats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">Excel (XLSX)</span>
              <span className="text-slate-500 text-[11px]">Editing &amp; sharing</span>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">CSV</span>
              <span className="text-slate-500 text-[11px]">Sheets &amp; tools</span>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">PDF</span>
              <span className="text-slate-500 text-[11px]">Printing &amp; posting</span>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">PNG / JPG</span>
              <span className="text-slate-500 text-[11px]">Slides &amp; chats</span>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">JSON</span>
              <span className="text-slate-500 text-[11px]">API systems</span>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
              <span className="font-bold text-indigo-700 block">HTML</span>
              <span className="text-slate-500 text-[11px]">Web browser</span>
            </div>
          </div>
        </section>

        {/* Section 9: Using the Assistant */}
        <section id="section-9" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">9</span>
            Using the Assistant (chatbot)
          </h2>
          <div className="space-y-3 text-sm text-slate-700">
            <p>Type what you need in plain words. Examples:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-indigo-900 font-mono bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <li>&quot;Give me teacher schedules as PDF.&quot;</li>
              <li>&quot;I need the canteen schedule and the master schedule in Excel.&quot;</li>
              <li>&quot;Export all schedules in PDF and Excel.&quot;</li>
            </ul>
            <p className="text-xs text-slate-600">
              The Assistant asks a question if your request is unclear. It only chooses what to export. It never changes the timetable itself.
              The chat response shows which mode handled your request: AI (Gemini) or keyword matching fallback when offline.
            </p>
          </div>
        </section>

        {/* Section 10: Preference learning */}
        <section id="section-10" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold">10</span>
            Preference learning (how it works and its limits)
          </h2>
          <ul className="list-disc list-inside space-y-2 text-xs text-slate-700">
            <li>After each timetable, teachers can rate their schedule and state their preferred time band.</li>
            <li>When at least 30 feedback responses exist, the system learns from them and uses the result as a soft suggestion weight.</li>
            <li>Until then, every teacher is treated equally, and the system clearly says so.</li>
            <li>Demo results use synthetic training data, labeled as such on the status page.</li>
            <li><strong>Preferences never override hard rules</strong> such as no double-booking or protected lunch breaks.</li>
          </ul>
        </section>

        {/* Section 11 & 12 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section id="section-11" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">11</span>
              Limits of the current version
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600">
              <li>One semester at a time.</li>
              <li>Rooms are the list you provide (room capacity not matched against class size).</li>
              <li>Canteen numbers are heuristic estimations.</li>
              <li>Assistant AI mode requires internet connectivity and API key.</li>
              <li>Teacher preference learning needs real feedback to become accurate.</li>
            </ul>
          </section>

          <section id="section-12" className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">12</span>
              Glossary
            </h2>
            <dl className="space-y-2 text-xs text-slate-700">
              <div>
                <dt className="font-bold text-slate-900 inline">Credit hours: </dt>
                <dd className="inline text-slate-600">Weekly contact hours. A 3-credit course meets for 3 hours a week, split into sessions.</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-900 inline">Student group: </dt>
                <dd className="inline text-slate-600">A class that attends the same courses together, such as &quot;CS-2024-A&quot;.</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-900 inline">Conflict: </dt>
                <dd className="inline text-slate-600">Two things booked at the same time (same teacher, room, or group).</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-900 inline">Solver: </dt>
                <dd className="inline text-slate-600">The CP-SAT optimization engine that finds a valid timetable automatically.</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-900 inline">Status: </dt>
                <dd className="inline text-slate-600">OPTIMAL (best proven), FEASIBLE (valid but not proven best), INFEASIBLE (no valid timetable possible).</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
