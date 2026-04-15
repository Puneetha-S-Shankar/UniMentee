-- PostgreSQL: student leave requests and linked subject offerings.
-- Run manually or via your migration runner.

CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id BIGSERIAL PRIMARY KEY,
    university_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL REFERENCES students (student_id),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    document_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by BIGINT REFERENCES users (user_id),
    review_note TEXT
);

CREATE INDEX IF NOT EXISTS ix_leave_requests_university_id ON leave_requests (university_id);
CREATE INDEX IF NOT EXISTS ix_leave_requests_student_id ON leave_requests (student_id);

CREATE TABLE IF NOT EXISTS leave_request_subjects (
    id BIGSERIAL PRIMARY KEY,
    leave_request_id BIGINT NOT NULL REFERENCES leave_requests (leave_id) ON DELETE CASCADE,
    offering_id BIGINT NOT NULL REFERENCES subject_offerings (offering_id)
);

CREATE INDEX IF NOT EXISTS ix_leave_request_subjects_leave ON leave_request_subjects (leave_request_id);
CREATE INDEX IF NOT EXISTS ix_leave_request_subjects_offering ON leave_request_subjects (offering_id);
