export interface Faculty {
  id?: number;
  name: string;
  department: string;
  max_hours_per_day: number;
  max_days_per_week: number;
  email: string;
  preferences?: {
    prefer_morning?: boolean;
    preferred_days?: string[];
    [key: string]: any;
  };
  unavailable_slots?: number[];
}

export interface Venue {
  id?: number;
  name: string;
  capacity: number;
  equipment?: string[];
  available_slots?: number[];
}

export interface TimeSlot {
  id?: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export interface Course {
  id?: number;
  name: string;
  code: string;
  faculty_id: number;
  capacity_required: number;
  duration_minutes: number;
}

export interface CustomConstraint {
  id?: number;
  type: 'hard' | 'soft';
  name: string;
  description?: string;
  weight: number;
  constraint_data?: Record<string, any>;
}

export interface TimetableEntry {
  id?: number;
  course_id: number;
  course_name: string;
  course_code: string;
  faculty_id: number;
  faculty_name: string;
  venue_id: number;
  venue_name: string;
  slot_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export interface SolverStats {
  status: string;
  solver_time_ms: number;
  total_time_ms: number;
  total_courses_scheduled: number;
  total_courses_requested: number;
  conflict_count: number;
  conflicts_resolved: number;
  gap_from_optimum?: number;
}

export interface TimetableResponse {
  schedule_id: number;
  status: string;
  generated_at: string;
  stats: SolverStats;
  schedule: TimetableEntry[];
  analytics?: Record<string, any>;
}

export interface ScheduleRunDetail {
  id: number;
  generated_at: string;
  status: string;
  solver_status?: string;
  solver_time_ms: number;
  total_time_ms: number;
  total_courses_scheduled: number;
  conflict_count: number;
  conflicts_resolved: number;
  metrics: Record<string, any>;
  entries: TimetableEntry[];
}
