import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capturedImageUrl, userId, location } = await req.json();

    if (!capturedImageUrl) {
      return new Response(
        JSON.stringify({ error: 'No image URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No user ID provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location not provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FACEPP_API_KEY = Deno.env.get('FACEPP_API_KEY');
    const FACEPP_API_SECRET = Deno.env.get('FACEPP_API_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Face++ API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch the specific user's photo and location info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, first_name, middle_name, last_name, photo_url, group_id, department_id')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user from database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user || !user.photo_url) {
      return new Response(
        JSON.stringify({ 
          matched: false, 
          message: 'User does not have a registered photo. Please check with admin.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compare captured face with user's registered photo
    try {
      const formData = new FormData();
      formData.append('api_key', FACEPP_API_KEY);
      formData.append('api_secret', FACEPP_API_SECRET);
      formData.append('image_url1', capturedImageUrl);
      formData.append('image_url2', user.photo_url);

      const compareResponse = await fetch(
        'https://api-us.faceplusplus.com/facepp/v3/compare',
        {
          method: 'POST',
          body: formData,
        }
      );

      const compareResult = await compareResponse.json();

      console.log(`Comparing with user ${user.first_name} ${user.last_name}:`, compareResult);

      // Check for Face++ API errors
      if (compareResult.error_message) {
        console.error('Face++ API error:', compareResult.error_message);
        return new Response(
          JSON.stringify({ 
            matched: false, 
            message: 'Face recognition service error. Please try again.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if faces match (confidence > 70)
      if (compareResult.confidence && compareResult.confidence > 70) {
        const fullName = [user.first_name, user.middle_name, user.last_name]
          .filter(Boolean)
          .join(' ');

        // Check for existing attendance today
        const today = new Date();
        const malaysiaTime = new Date(today.getTime() + 8 * 60 * 60 * 1000);
        const todayStart = new Date(Date.UTC(
          malaysiaTime.getUTCFullYear(),
          malaysiaTime.getUTCMonth(),
          malaysiaTime.getUTCDate(),
          0, 0, 0, 0
        ));

        const { data: attendanceToday, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.user_id)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const isCheckOut = attendanceToday && attendanceToday.check_in_time && !attendanceToday.check_out_time;

        // If this is a check-out, validate location
        if (isCheckOut) {
          // Get group location first (priority), then department location
          let targetLocation = null;
          let geofenceRadius = 500; // default

          if (user.group_id) {
            const { data: groupData } = await supabase
              .from('group')
              .select('group_location, geofence_radius')
              .eq('group_id', user.group_id)
              .single();

            if (groupData?.group_location) {
              targetLocation = groupData.group_location;
              if (groupData.geofence_radius) {
                geofenceRadius = groupData.geofence_radius;
              }
            }
          }

          // If no group location, use department location
          if (!targetLocation && user.department_id) {
            const { data: deptData } = await supabase
              .from('department')
              .select('department_location, geofence_radius')
              .eq('department_id', user.department_id)
              .single();

            if (deptData?.department_location) {
              targetLocation = deptData.department_location;
              if (deptData.geofence_radius) {
                geofenceRadius = deptData.geofence_radius;
              }
            }
          }

          // Validate location if target location exists
          if (targetLocation) {
            const [targetLat, targetLng] = targetLocation.split(',').map(Number);
            const distance = calculateDistance(
              location.latitude,
              location.longitude,
              targetLat,
              targetLng
            );

            if (distance > geofenceRadius) {
              return new Response(
                JSON.stringify({
                  matched: false,
                  message: `Checkout not recorded: You must be at your ${user.group_id ? 'group' : 'department'} location to check out. You are ${Math.round(distance)}m away (allowed: ${geofenceRadius}m).`,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        return new Response(
          JSON.stringify({
            matched: true,
            user: {
              user_id: user.user_id,
              name: fullName,
            },
            confidence: compareResult.confidence,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No match found
      return new Response(
        JSON.stringify({
          matched: false,
          message: 'Face does not match. Please check with admin.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error comparing faces:', error);
      return new Response(
        JSON.stringify({ 
          matched: false, 
          message: 'Failed to compare faces. Please try again.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in compare-faces function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
