# SQL migrations (PostgreSQL)

UniMentee backend context: see the [project README](../../README.md).

Run scripts **in numeric order** on your database. These patches assume **core ERP tables already exist** (for example created in Supabase or a separate baseline DDL): `users`, `students`, `subject_offerings`, `assessments`, etc. The files here only add or alter app-specific tables and columns.

## Order

| File | Purpose |
|------|---------|
| `001_university_settings.sql` | `university_settings` |
| `002_leave_requests.sql` | `leave_requests`, `leave_request_subjects` (requires `users`, `students`, `subject_offerings`) |
| `003_announcements.sql` | `announcements`, `announcement_targets` |
| `004_audit_logs.sql` | `audit_logs` |
| `005_university_logo_url.sql` | `ALTER` add `university_logo_url` |
| `006_assessment_send_back.sql` | `ALTER` add `send_back_reason` on `assessments` |

For a **completely empty** database you must apply your full schema (or restore from backup) **before** running `001`–`006`.

## Environment

See [`../.env.example`](../.env.example) for required application variables (`DATABASE_URL`, `JWT_SECRET`, etc.).
