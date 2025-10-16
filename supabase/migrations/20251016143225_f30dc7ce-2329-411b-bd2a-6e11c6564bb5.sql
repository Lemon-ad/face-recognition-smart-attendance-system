-- Drop the attendance_history table as it's no longer needed
-- All attendance records (current and historical) will be stored in the attendance table
DROP TABLE IF EXISTS attendance_history;