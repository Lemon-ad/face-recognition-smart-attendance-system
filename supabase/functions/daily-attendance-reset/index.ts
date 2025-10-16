import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log('Starting daily attendance reset at 12am Malaysia time...');

    // Get current date in Malaysia timezone (UTC+8)
    const now = new Date();
    const klOffset = 8 * 60; // Kuala Lumpur is UTC+8
    const klTime = new Date(now.getTime() + (klOffset * 60 * 1000));
    const todayDateStr = klTime.toISOString().split('T')[0];

    console.log(`Resetting attendance for date: ${todayDateStr}`);

    // Step 1: Fetch all current attendance records
    const { data: currentRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('*');

    if (fetchError) {
      console.error('Error fetching current attendance:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendance records', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let archivedCount = 0;

    // Step 2: Archive existing records if any
    if (currentRecords && currentRecords.length > 0) {
      console.log(`Found ${currentRecords.length} records to archive`);

      // Get yesterday's date for the archived records
      const yesterday = new Date(klTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDateStr = yesterday.toISOString().split('T')[0];

      // Prepare records for history table
      const historyRecords = currentRecords.map(record => ({
        attendance_id: record.attendance_id,
        user_id: record.user_id,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        status: record.status,
        location: record.location,
        attendance_date: yesterdayDateStr,
        created_at: record.created_at,
        updated_at: record.updated_at,
      }));

      // Insert into attendance_history
      const { error: insertError } = await supabase
        .from('attendance_history')
        .insert(historyRecords);

      if (insertError) {
        console.error('Error inserting into history:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to archive records', details: insertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully archived ${historyRecords.length} records`);
      archivedCount = historyRecords.length;

      // Delete archived records from attendance table
      const attendanceIds = currentRecords.map(r => r.attendance_id);
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .in('attendance_id', attendanceIds);

      if (deleteError) {
        console.error('Error deleting archived records:', deleteError);
        return new Response(
          JSON.stringify({ 
            error: 'Records archived but failed to delete from main table',
            details: deleteError 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully deleted ${attendanceIds.length} records from attendance table`);
    } else {
      console.log('No records to archive');
    }

    // Step 3: Fetch all users (members and admins)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: usersError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!users || users.length === 0) {
      console.log('No users found to create attendance records');
      return new Response(
        JSON.stringify({ 
          message: 'Reset completed but no users found',
          date: todayDateStr,
          archived: archivedCount,
          created: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating attendance records for ${users.length} users`);

    // Step 4: Create new attendance records with status "absent"
    const newAttendanceRecords = users.map(user => ({
      user_id: user.user_id,
      status: 'absent',
      check_in_time: null,
      check_out_time: null,
      location: null,
    }));

    const { error: createError } = await supabase
      .from('attendance')
      .insert(newAttendanceRecords);

    if (createError) {
      console.error('Error creating new attendance records:', createError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create new attendance records',
          details: createError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully created ${newAttendanceRecords.length} new attendance records`);

    return new Response(
      JSON.stringify({
        message: 'Daily attendance reset completed successfully',
        date: todayDateStr,
        archived: archivedCount,
        created: newAttendanceRecords.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily-attendance-reset function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
