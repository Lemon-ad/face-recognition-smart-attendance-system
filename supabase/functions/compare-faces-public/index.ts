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
    const { capturedImageUrl } = await req.json();

    if (!capturedImageUrl) {
      return new Response(
        JSON.stringify({ error: 'No image URL provided' }),
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

    // Fetch all users with photo_url
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, first_name, middle_name, last_name, photo_url')
      .not('photo_url', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users from database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          matched: false, 
          message: 'No users with photos found in database' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compare captured face with each user's photo
    for (const user of users) {
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
          continue; // Try next user
        }

        // Check if faces match (confidence > 70)
        if (compareResult.confidence && compareResult.confidence > 70) {
          const fullName = [user.first_name, user.middle_name, user.last_name]
            .filter(Boolean)
            .join(' ');

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
      } catch (error) {
        console.error(`Error comparing with user ${user.user_id}:`, error);
        // Continue to next user
      }
    }

    // No match found
    return new Response(
      JSON.stringify({
        matched: false,
        message: 'User not found',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-faces-public function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
