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

    console.log('Starting daily attendance reset at midnight Malaysia time...');

    // Fetch all users
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
          message: 'No users found',
          created: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating attendance records for ${users.length} users`);

    // Create new attendance records with status "absent"
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
