-- Add geofence_radius column to department table
ALTER TABLE public.department 
ADD COLUMN geofence_radius integer DEFAULT 500;

-- Add geofence_radius column to group table
ALTER TABLE public.group 
ADD COLUMN geofence_radius integer DEFAULT 500;

-- Add comments for clarity
COMMENT ON COLUMN public.department.geofence_radius IS 'Geofence radius in meters for attendance validation';
COMMENT ON COLUMN public.group.geofence_radius IS 'Geofence radius in meters for attendance validation';