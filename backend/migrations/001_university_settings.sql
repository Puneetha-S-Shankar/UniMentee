-- PostgreSQL: university-wide configuration (one row per university).
-- Run manually or via your migration runner.

CREATE TABLE IF NOT EXISTS university_settings (
    setting_id BIGSERIAL PRIMARY KEY,
    university_id BIGINT NOT NULL UNIQUE,
    attendance_threshold NUMERIC(5, 2) NOT NULL DEFAULT 75,
    warning_threshold NUMERIC(5, 2) NOT NULL DEFAULT 80,
    auto_lock_hours INT NOT NULL DEFAULT 24,
    cgpa_good_standing NUMERIC(4, 2) NOT NULL DEFAULT 7.5,
    cgpa_warning NUMERIC(4, 2) NOT NULL DEFAULT 5.5,
    max_mentees_per_mentor INT NOT NULL DEFAULT 20,
    university_name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_university_settings_university_id ON university_settings (university_id);
