import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const CompareFaceSchema = z.object({
  capturedImageUrl: z.string().url().max(2048),
  userId: z.string().uuid(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    const requestBody = await req.json();
    const validationResult = CompareFaceSchema.safeParse(requestBody);

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

    const { capturedImageUrl, userId, location } = validationResult.data;

    // Validate image URL is from trusted domain
    const allowedDomains = ["i.ibb.co", "ibb.co"];
    const imageUrl = new URL(capturedImageUrl);
    if (!allowedDomains.includes(imageUrl.hostname)) {
      return new Response(
        JSON.stringify({ error: "Image URL from untrusted domain" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check authorization: user can only check their own attendance unless admin
    const { data: userData, error: userCheckError } = await supabaseClient
      .from("users")
      .select("user_id, role, auth_uuid")
      .eq("user_id", userId)
      .single();

    if (userCheckError || !userData) {
      console.error("User lookup error:", userCheckError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify authorization: user must be checking their own attendance or be an admin
    const { data: hasAdminRole } = await supabaseClient
      .rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (userData.auth_uuid !== user.id && !hasAdminRole) {
      console.error("Authorization failed: User trying to check attendance for another user");
      return new Response(
        JSON.stringify({ error: "Forbidden: You can only check your own attendance" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Face++ API credentials
    const FACEPP_API_KEY = Deno.env.get("FACEPP_API_KEY");
    const FACEPP_API_SECRET = Deno.env.get("FACEPP_API_SECRET");

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
      throw new Error("Face++ API credentials not configured");
    }

    // Use service role for database operations
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user data with photo
    const { data: userWithPhoto, error: photoError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (photoError || !userWithPhoto) {
      console.error("Error fetching user:", photoError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userWithPhoto.photo_url) {
      return new Response(
        JSON.stringify({ error: "No photo registered for this user" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compare faces using Face++ API
    const formData = new FormData();
    formData.append("api_key", FACEPP_API_KEY);
    formData.append("api_secret", FACEPP_API_SECRET);
    formData.append("image_url1", capturedImageUrl);
    formData.append("image_url2", userWithPhoto.photo_url);

    const faceppResponse = await fetch(
      "https://api-us.faceplusplus.com/facepp/v3/compare",
      {
        method: "POST",
        body: formData,
      }
    );

    const faceppData = await faceppResponse.json();
    console.log("Face++ API response:", faceppData);

    if (faceppData.error_message) {
      console.error("Face++ API error:", faceppData.error_message);
      return new Response(
        JSON.stringify({ error: faceppData.error_message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const confidence = faceppData.confidence || 0;
    const threshold1e4 = faceppData.thresholds?.["1e-4"] || 69.101;

    if (confidence > threshold1e4) {
      // Get today's date in Asia/Kuala_Lumpur timezone
      const todayKL = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
      });
      
      // Check existing attendance for today
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", `${todayKL}T00:00:00`)
        .lte("created_at", `${todayKL}T23:59:59`)
        .maybeSingle();

      // Get current time in Asia/Kuala_Lumpur timezone
      const klTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kuala_Lumpur",
      });
      const klDate = new Date(klTime);
      const klISOString = klDate.toISOString();
      
      const currentTime = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kuala_Lumpur",
      });

      // If check-out and location provided, validate location
      if (existingAttendance && !existingAttendance.check_out_time && location) {
        const { data: groupData } = await supabase
          .from("group")
          .select("group_location, geofence_radius")
          .eq("group_id", userWithPhoto.group_id)
          .single();

        const { data: deptData } = await supabase
          .from("department")
          .select("department_location, geofence_radius")
          .eq("department_id", userWithPhoto.department_id)
          .single();

        const targetLocation = groupData?.group_location || deptData?.department_location;
        const radius = groupData?.geofence_radius || deptData?.geofence_radius || 500;

        if (targetLocation) {
          // Database stores as lon,lat (longitude first, latitude second)
          const [targetLon, targetLat] = targetLocation.split(",").map(Number);
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            targetLat,
            targetLon
          );

          if (distance > radius) {
            return new Response(
              JSON.stringify({
                match: true,
                confidence,
                error: "Location mismatch: You are not within the allowed area for check-out",
                distance,
                allowedRadius: radius,
              }),
              {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      // Get department and group settings for time validation
      const { data: groupData } = await supabase
        .from("group")
        .select("start_time, end_time")
        .eq("group_id", userWithPhoto.group_id)
        .maybeSingle();

      const { data: deptData } = await supabase
        .from("department")
        .select("start_time, end_time")
        .eq("department_id", userWithPhoto.department_id)
        .maybeSingle();

      const startTime = groupData?.start_time || deptData?.start_time;
      const endTime = groupData?.end_time || deptData?.end_time;

      let status = "present";
      let action = "";

      if (!existingAttendance || !existingAttendance.check_in_time) {
        // Check-in logic
        if (startTime && currentTime > startTime) {
          status = "late";
        }

        if (!existingAttendance) {
          // Create new attendance record with KL timezone
          const { error: insertError } = await supabase.from("attendance").insert({
            user_id: userId,
            status,
            check_in_time: klISOString,
            location: location ? `${location.latitude},${location.longitude}` : null,
          });

          if (insertError) {
            console.error("Error inserting attendance:", insertError);
            throw insertError;
          }
        } else {
          // Update existing absent record with check-in in KL timezone
          const { error: updateError } = await supabase
            .from("attendance")
            .update({
              check_in_time: klISOString,
              status,
              location: location ? `${location.latitude},${location.longitude}` : null,
            })
            .eq("attendance_id", existingAttendance.attendance_id);

          if (updateError) {
            console.error("Error updating attendance with check-in:", updateError);
            throw updateError;
          }
        }

        action = "check-in";
        console.log(`Check-in successful for user ${userId} with status ${status}`);
      } else {
        // Check-out logic
        if (endTime && currentTime < endTime) {
          status = "early_out";
        } else {
          status = "present";
        }

        const { error: updateError } = await supabase
          .from("attendance")
          .update({
            check_out_time: klISOString,
            status,
          })
          .eq("attendance_id", existingAttendance.attendance_id);

        if (updateError) {
          console.error("Error updating attendance:", updateError);
          throw updateError;
        }

        action = "check-out";
        console.log(`Check-out successful for user ${userId} with status ${status}`);
      }

      return new Response(
        JSON.stringify({
          matched: true,
          match: true,
          user: userWithPhoto,
          confidence,
          action,
          status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ match: false, confidence }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in compare-faces function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});