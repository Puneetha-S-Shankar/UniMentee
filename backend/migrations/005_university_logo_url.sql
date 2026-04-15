-- Add logo URL to university_settings (run after 001_university_settings.sql).

ALTER TABLE university_settings
  ADD COLUMN IF NOT EXISTS university_logo_url VARCHAR(2048);
