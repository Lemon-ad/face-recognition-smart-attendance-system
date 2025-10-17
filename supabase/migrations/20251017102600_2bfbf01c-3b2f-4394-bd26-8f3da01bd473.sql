-- Enable realtime for attendance table
ALTER TABLE attendance REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;