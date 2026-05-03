# SQL Migrations (PostgreSQL)

Hand-written incremental patches for the UniMentee backend. There is no Alembic
runner — apply files manually (or via `psql -f`) **in the numbered order below**.

---

## Bootstrap order for a fresh database

Run these steps in sequence every time you set up an empty database:

**Step 1 — Apply the base schema**

Run `University_ERP_Schema_v3_1_FINAL.sql` first. This file creates all core
domain tables (see the full list below). The incremental migrations in this
directory assume those tables already exist.

**Step 2 — Apply incremental migrations in order**

| # | File | What it does |
|---|------|--------------|
| 1 | `001_university_settings.sql` | Creates `university_settings` (one row per university) |
| 2 | `002_leave_requests.sql` | Creates `leave_requests`, `leave_request_subjects`; requires `students`, `users`, `subject_offerings` |
| 3 | `003_announcements.sql` | Creates `announcements`, `announcement_targets`; requires `users` |
| 4 | `004_audit_logs.sql` | Creates `audit_logs`; requires `users` |
| 5 | `005_university_logo_url.sql` | `ALTER TABLE university_settings` — adds `university_logo_url` column |
| 6 | `006_assessment_send_back.sql` | `ALTER TABLE assessments` — adds `send_back_reason` column |

All files use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so they
are safe to re-run on a database that already has some migrations applied.

---

## Tables expected from the base schema

The following tables must exist before running any of the migrations above.
They are all created by `University_ERP_Schema_v3_1_FINAL.sql` and are **not**
re-created by any file in this directory.

**Identity and access**
- `users`
- `roles`
- `user_roles`
- `permissions`
- `role_permissions`

**Academic structure**
- `departments`
- `programs`
- `batches`
- `sections`
- `subjects`
- `subject_offerings`

**Students and enrolment**
- `students`
- `student_subject_enrollments`

**Attendance**
- `attendance_sessions`
- `attendance_records`

**Marks and progress**
- `assessment_types`
- `assessments`
- `student_marks`
- `student_academic_progress`
- `grade_scales`

**Mentorship and portfolio**
- `mentor_assignments`
- `mentoring_sessions`
- `portfolio_items`

---

## Tables created by this directory's migrations

| Table | Migration |
|-------|-----------|
| `university_settings` | `001` |
| `leave_requests` | `002` |
| `leave_request_subjects` | `002` |
| `announcements` | `003` |
| `announcement_targets` | `003` |
| `audit_logs` | `004` |
| `university_settings.university_logo_url` (column) | `005` |
| `assessments.send_back_reason` (column) | `006` |

---

## Environment variables

See [`../.env.example`](../.env.example) for required application variables
(`DATABASE_URL`, `JWT_SECRET`, etc.).
