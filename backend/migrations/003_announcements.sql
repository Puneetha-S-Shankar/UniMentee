-- PostgreSQL: announcements and optional batch/section targets.
-- Run manually or via your migration runner.

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id BIGSERIAL PRIMARY KEY,
    university_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL REFERENCES users (user_id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'ACADEMIC',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiry_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
);

CREATE INDEX IF NOT EXISTS ix_announcements_university_id ON announcements (university_id);
CREATE INDEX IF NOT EXISTS ix_announcements_posted_at ON announcements (posted_at DESC);

CREATE TABLE IF NOT EXISTS announcement_targets (
    id BIGSERIAL PRIMARY KEY,
    announcement_id BIGINT NOT NULL REFERENCES announcements (announcement_id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT
);

CREATE INDEX IF NOT EXISTS ix_announcement_targets_announcement ON announcement_targets (announcement_id);
