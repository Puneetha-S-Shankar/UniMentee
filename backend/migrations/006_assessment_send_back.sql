-- Optional reason when an assessment is sent back from SUBMITTED to DRAFT.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS send_back_reason TEXT;
