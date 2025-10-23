import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const DeleteUserSchema = z.object({
  userId: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Delete user function called");
    
    // Verify JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized: No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    // Use service role to bypass RLS for admin operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract JWT token from header
    const token = authHeader.replace(/Bearer\s+/i, "");

    // Decode JWT locally to extract user id (sub)
    function getUserIdFromJWT(jwt: string): string | null {
      try {
        const payload = jwt.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))
          )
        );
        return (json && (json.sub || json.user_id)) ?? null;
      } catch (_e) {
        return null;
      }
    }

    const requesterId = getUserIdFromJWT(token);
    if (!requesterId) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", requesterId);

    // Check if user is admin using has_role function
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin
      .rpc("has_role", { _user_id: requesterId, _role: "admin" });

    console.log("Admin role check result:", hasAdminRole, "Error:", roleError);

    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input
    const requestBody = await req.json();
    const validationResult = DeleteUserSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.issues }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { userId } = validationResult.data;
    console.log("Attempting to delete user:", userId);

    // Get auth_uuid from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("auth_uuid")
      .eq("user_id", userId)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authUuid = userData.auth_uuid;
    console.log("Found user with auth_uuid:", authUuid);

    // Step 1: Delete from user_roles table first (to avoid foreign key constraint issues)
    const { error: roleDeleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", authUuid);

    if (roleDeleteError) {
      console.error("Error deleting from user_roles:", roleDeleteError);
      throw roleDeleteError;
    }
    console.log("Deleted from user_roles");

    // Step 2: Delete from users table
    const { error: deleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting user from users table:", deleteError);
      throw deleteError;
    }
    console.log("Deleted from users table");

    // Step 3: Delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      authUuid
    );

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
      throw authDeleteError;
    }
    console.log("Deleted from auth.users");

    console.log(`Successfully deleted user ${userId} and auth user ${authUuid}`);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});