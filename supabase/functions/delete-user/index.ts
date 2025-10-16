import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Deleting user with ID:', userId);

    // First, get the auth_uuid from the users table
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('auth_uuid')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      throw fetchError;
    }

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const authUuid = userData.auth_uuid;
    console.log('Found auth UUID:', authUuid);

    // Delete from users table first (due to foreign key constraint)
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (deleteUserError) {
      console.error('Error deleting user record:', deleteUserError);
      throw deleteUserError;
    }

    console.log('User record deleted successfully');

    // Delete from auth.users using admin API
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
      authUuid
    );

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Don't throw here - user record is already deleted
      // Just log the error and continue
      console.warn('Auth user deletion failed but user record was deleted');
    } else {
      console.log('Auth user deleted successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-user function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
