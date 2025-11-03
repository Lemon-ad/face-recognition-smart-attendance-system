import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "npm:resend@2.0.0";

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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const { newPassword, redirectUrl } = await req.json();

    if (!newPassword || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Looking for admin users with emails...');

    // Get all admin users' emails using service role
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('email, username')
      .eq('role', 'admin')
      .not('email', 'is', null);

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    console.log(`Found ${admins?.length || 0} admin users`);

    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No admin accounts with email addresses found',
          success: false 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send password reset emails to all admins
    const resetResults = [];
    for (const admin of admins) {
      console.log(`Sending reset email to ${admin.email} (${admin.username})`);
      
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: admin.email!,
        options: {
          redirectTo: redirectUrl,
        }
      });

      if (error) {
        console.error(`Error generating reset link for ${admin.email}:`, error);
        resetResults.push({ email: admin.email, success: false, error: error.message });
      } else if (data?.properties?.action_link) {
        // Send the email using Resend
        try {
          await resend.emails.send({
            from: 'Attendance System <onboarding@resend.dev>',
            to: [admin.email!],
            subject: 'Admin Password Reset',
            html: `
              <h1>Password Reset Request</h1>
              <p>Hello ${admin.username},</p>
              <p>You have requested to reset your admin password. Click the link below to complete the reset:</p>
              <p><a href="${data.properties.action_link}">Reset Password</a></p>
              <p>This link will expire in 60 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            `,
          });
          console.log(`Successfully sent reset email to ${admin.email}`);
          resetResults.push({ email: admin.email, success: true });
        } catch (emailError) {
          console.error(`Error sending email to ${admin.email}:`, emailError);
          resetResults.push({ email: admin.email, success: false, error: 'Failed to send email' });
        }
      } else {
        console.error(`No action link generated for ${admin.email}`);
        resetResults.push({ email: admin.email, success: false, error: 'No action link generated' });
      }
    }

    const successCount = resetResults.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Password reset emails sent to ${successCount} admin account(s)`,
        results: resetResults,
        count: successCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-admin-reset-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});