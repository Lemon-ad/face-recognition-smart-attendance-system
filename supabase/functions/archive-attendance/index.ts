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

    console.log('Starting attendance archiving process...');

    // Calculate yesterday's date in Malaysia timezone (UTC+8)
    const now = new Date();
    const klOffset = 8 * 60; // Kuala Lumpur is UTC+8
    const klTime = new Date(now.getTime() + (klOffset * 60 * 1000));
    
    // Get yesterday's date
    const yesterday = new Date(klTime);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    // Get end of yesterday
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayDateStr = yesterday.toISOString().split('T')[0];

    console.log(`Archiving attendance for date: ${yesterdayDateStr}`);

    // Fetch all attendance records from yesterday
    const { data: yesterdayRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .lte('created_at', yesterdayEnd.toISOString());

    if (fetchError) {
      console.error('Error fetching yesterday\'s attendance:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendance records', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!yesterdayRecords || yesterdayRecords.length === 0) {
      console.log('No attendance records found for yesterday');
      return new Response(
        JSON.stringify({ 
          message: 'No records to archive',
          date: yesterdayDateStr,
          archived: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${yesterdayRecords.length} records to archive`);

    // Prepare records for history table
    const historyRecords = yesterdayRecords.map(record => ({
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

    // Insert records into attendance_history
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

    // Delete the archived records from attendance table
    const attendanceIds = yesterdayRecords.map(r => r.attendance_id);
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

    return new Response(
      JSON.stringify({
        message: 'Attendance archived successfully',
        date: yesterdayDateStr,
        archived: historyRecords.length,
        deleted: attendanceIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in archive-attendance function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
