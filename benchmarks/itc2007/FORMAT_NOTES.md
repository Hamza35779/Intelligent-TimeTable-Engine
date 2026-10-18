# ITC-2007 Track 3 (Curriculum-Based Course Timetabling) Format Notes

## 1. Overview
The International Timetabling Competition 2007 (ITC-2007) Track 3 addresses Curriculum-Based Course Timetabling (CB-CTT). The benchmark dataset consists of 21 competition instances (`comp01.ctt` through `comp21.ctt`) based on real-world university timetabling at the University of Udine.

## 2. File Format Specification (`.ctt`)

Instances are ASCII text files structured into a header and 4 delimited sections:

### Header
```
Name: <string>
Courses: <int>
Rooms: <int>
Days: <int>
Periods_per_day: <int>
Curricula: <int>
Constraints: <int>
```
- `Days`: Number of teaching days per week (typically 5, Monday-Friday). Days are 0-indexed: `0, ..., Days - 1`.
- `Periods_per_day`: Number of time periods per day (e.g. 4, 5, or 6). Periods within a day are 0-indexed: `0, ..., Periods_per_day - 1`.
- Total periods = `Days * Periods_per_day`. Absolute period `p = day * Periods_per_day + day_period`.

### Sections

1. **`COURSES:`**
   Each line specifies:
   `<CourseID> <TeacherID> <NumLectures> <MinWorkingDays> <NumStudents>`
   - `CourseID`: String identifier (e.g., `c0001`)
   - `TeacherID`: String identifier of the instructor (e.g., `t000`)
   - `NumLectures`: Total number of weekly lectures (contact hours) to be scheduled
   - `MinWorkingDays`: Minimum number of distinct days across which lectures must be spread
   - `NumStudents`: Number of enrolled students attending each lecture

2. **`ROOMS:`**
   Each line specifies:
   `<RoomID> <Capacity>`
   - `RoomID`: String identifier (e.g., `rA`, `B`, `001`)
   - `Capacity`: Maximum student capacity (integer)

3. **`CURRICULA:`**
   Each line specifies:
   `<CurriculumID> <NumCourses> <CourseID_1> <CourseID_2> ... <CourseID_N>`
   - All courses within a curriculum are taken by the same cohort of students and must not clash.

4. **`UNAVAILABILITY_CONSTRAINTS:`**
   Each line specifies:
   `<CourseID> <Day> <DayPeriod>`
   - Indicates that `<CourseID>` cannot be taught on `<Day>` at `<DayPeriod>`.

5. **`END.`**
   Marks the end of the instance file.

---

## 3. Solution Format (`.sol`)

A solution assigns each lecture of each course to a specific room and time slot:
```
<CourseID> <RoomID> <Day> <DayPeriod>
```
- Exactly one line per scheduled lecture.
- For a course with $k$ lectures, there must be exactly $k$ lines.
- `Day` is an integer in `[0, Days - 1]`.
- `DayPeriod` is an integer in `[0, Periods_per_day - 1]`.

---

## 4. Constraint Definitions & Official Penalties

### Hard Constraints (Target: 0 violations)
1. **Lectures**: Every lecture of each course must be scheduled.
   `Violations = sum(|actual_lectures(c) - required_lectures(c)|)`
2. **Conflicts**: Courses sharing a curriculum or sharing a teacher cannot be scheduled in the same time period.
   `Violations = number of overlapping lecture pairs sharing a teacher or curriculum`.
3. **Availability**: No course lecture may be scheduled in an unavailable period.
   `Violations = number of lectures placed in an unavailable slot`.
4. **RoomOccupation**: No two lectures may occupy the same room in the same period.
   `Violations = sum(max(0, room_occupancy(r, p) - 1))`.

### Soft Constraints & Official Cost Weights
1. **RoomCapacity (Weight = 1)**:
   For every lecture scheduled in a room with capacity $C_{room} < N_{students}$:
   $$\text{Penalty} = (N_{students} - C_{room}) \times 1$$
2. **MinWorkingDays (Weight = 5)**:
   For every course whose lectures are spread across fewer distinct days $D_{used} < D_{min}$:
   $$\text{Penalty} = (D_{min} - D_{used}) \times 5$$
3. **CurriculumCompactness (Weight = 2)**:
   For every curriculum, lectures should be contiguous within each day. An isolated lecture is one having no preceding and no following lecture for the same curriculum on the same day:
   $$\text{Penalty} = \text{isolated\_lectures} \times 2$$
4. **RoomStability (Weight = 1)**:
   All lectures of a course should ideally take place in the same room. If a course is taught in $R_{used} > 1$ distinct rooms:
   $$\text{Penalty} = (R_{used} - 1) \times 1$$

$$\text{Total Soft Cost} = \text{RoomCapacity} + 5 \times \text{MinWorkingDays} + 2 \times \text{CurriculumCompactness} + \text{RoomStability}$$
