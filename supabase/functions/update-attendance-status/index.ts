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

    // Get current date in Kuala Lumpur timezone
    const now = new Date();
    const klOffset = 8 * 60;
    const klNow = new Date(now.getTime() + (klOffset * 60 * 1000));
    const klToday = new Date(klNow.getFullYear(), klNow.getMonth(), klNow.getDate());

    // Fetch all attendance records that don't have check_out_time
    // This includes both today's records and older records
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance')
      .select('attendance_id, user_id, status, check_out_time, created_at')
      .is('check_out_time', null);

    if (attendanceError) {
      console.error('Error fetching attendance records:', attendanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendance records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No attendance records to update', updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentHours = klNow.getHours();
    const currentMinutes = klNow.getMinutes();

    let updatedCount = 0;

    // For each attendance record, check if we should update to no_checkout
    for (const record of attendanceRecords) {
      // Check if record is from a previous day
      const recordDate = new Date(record.created_at);
      const recordKlDate = new Date(recordDate.getTime() + (klOffset * 60 * 1000));
      const recordKlDay = new Date(recordKlDate.getFullYear(), recordKlDate.getMonth(), recordKlDate.getDate());
      
      const isFromPreviousDay = recordKlDay < klToday;
      
      // If record is from a previous day and has no checkout, mark as no_checkout
      if (isFromPreviousDay && record.status !== 'no_checkout') {
        await supabase
          .from('attendance')
          .update({ status: 'no_checkout' })
          .eq('attendance_id', record.attendance_id);

        updatedCount++;
        console.log(`Updated attendance ${record.attendance_id} from previous day to no_checkout`);
        continue;
      }
      // Get user's group and department info
      const { data: userData } = await supabase
        .from('users')
        .select('group_id, department_id')
        .eq('user_id', record.user_id)
        .single();

      if (!userData) continue;

      let endTime = null;

      // Get end_time from group first
      if (userData.group_id) {
        const { data: groupData } = await supabase
          .from('group')
          .select('end_time')
          .eq('group_id', userData.group_id)
          .single();

        if (groupData?.end_time) {
          endTime = groupData.end_time;
        }
      }

      // If no group end_time, get from department
      if (!endTime && userData.department_id) {
        const { data: deptData } = await supabase
          .from('department')
          .select('end_time')
          .eq('department_id', userData.department_id)
          .single();

        if (deptData?.end_time) {
          endTime = deptData.end_time;
        }
      }

      // If we have an end_time, check if current time is past it
      if (endTime) {
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        
        // Compare current time with end time
        const currentTotalMinutes = (currentHours * 60) + currentMinutes;
        const endTotalMinutes = (endHours * 60) + endMinutes;

        if (currentTotalMinutes > endTotalMinutes && record.status !== 'no_checkout') {
          // Update status to no_checkout
          await supabase
            .from('attendance')
            .update({ status: 'no_checkout' })
            .eq('attendance_id', record.attendance_id);

          updatedCount++;
          console.log(`Updated attendance ${record.attendance_id} to no_checkout`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Attendance status updated successfully',
        updated: updatedCount,
        checked: attendanceRecords.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-attendance-status function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
