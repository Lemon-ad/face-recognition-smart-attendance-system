-- Add new status values to the attendance_status_enum type
ALTER TYPE attendance_status_enum ADD VALUE IF NOT EXISTS 'early_out';
ALTER TYPE attendance_status_enum ADD VALUE IF NOT EXISTS 'no_checkout';