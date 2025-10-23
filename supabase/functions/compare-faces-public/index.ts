import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const PublicCompareFaceSchema = z.object({
  capturedImageUrl: z.string().url().max(2048),
  userLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

// Haversine formula to calculate distance
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const requestBody = await req.json();
    const validationResult = PublicCompareFaceSchema.safeParse(requestBody);

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

    const { capturedImageUrl, userLocation } = validationResult.data;

    // Validate image URL domain
    const allowedDomains = ["i.ibb.co", "ibb.co"];
    const imageUrl = new URL(capturedImageUrl);
    if (!allowedDomains.includes(imageUrl.hostname)) {
      console.error("Untrusted image domain:", imageUrl.hostname);
      return new Response(
        JSON.stringify({ error: "Image URL from untrusted domain" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log attempt for audit trail
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    console.log(`Public face scan attempt from IP: ${clientIP} at ${new Date().toISOString()}`);

    const FACEPP_API_KEY = Deno.env.get("FACEPP_API_KEY");
    const FACEPP_API_SECRET = Deno.env.get("FACEPP_API_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with photos
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .not("photo_url", "is", null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No registered users found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to match face with each user
    for (const user of users) {
      const formData = new FormData();
      formData.append("api_key", FACEPP_API_KEY);
      formData.append("api_secret", FACEPP_API_SECRET);
      formData.append("image_url1", capturedImageUrl);
      formData.append("image_url2", user.photo_url);

      const faceppResponse = await fetch(
        "https://api-us.faceplusplus.com/facepp/v3/compare",
        {
          method: "POST",
          body: formData,
        }
      );

      const faceppData = await faceppResponse.json();

      if (faceppData.error_message) {
        console.error("Face++ API error:", faceppData.error_message);
        continue;
      }

      const confidence = faceppData.confidence || 0;

      if (confidence > 70) {
        console.log(`Match found for user ${user.user_id} with confidence ${confidence} from IP: ${clientIP}`);

        // Get department and group settings
        let groupData = null;
        if (user.group_id) {
          const result = await supabase
            .from("group")
            .select("group_location, geofence_radius, start_time, end_time")
            .eq("group_id", user.group_id)
            .maybeSingle();
          groupData = result.data;
        }

        const { data: deptData } = await supabase
          .from("department")
          .select("department_location, geofence_radius, start_time, end_time")
          .eq("department_id", user.department_id)
          .maybeSingle();

        const targetLocation = groupData?.group_location || deptData?.department_location;
        const radius = groupData?.geofence_radius || deptData?.geofence_radius || 500;
        const startTime = groupData?.start_time || deptData?.start_time;
        const endTime = groupData?.end_time || deptData?.end_time;

        // Check existing attendance BEFORE location validation to craft precise error messages
        const today = new Date().toISOString().split("T")[0];
        const { data: existingAttendance } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.user_id)
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`)
          .maybeSingle();

        // Validate location
        if (targetLocation) {
          const [targetLat, targetLon] = targetLocation.split(",").map(Number);
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            targetLat,
            targetLon
          );

          console.log(`Location check for user ${user.user_id}:`);
          console.log(`  User GPS: ${userLocation.latitude}, ${userLocation.longitude}`);
          console.log(`  Department: ${targetLat}, ${targetLon}`);
          console.log(`  Distance: ${distance}m, Allowed: ${radius}m`);

          if (distance > radius) {
            console.log(`Location validation FAILED: distance ${distance}m > radius ${radius}m`);
            const actionAttempt = existingAttendance && !existingAttendance.check_out_time ? 'check-out' : 'check-in';
            const msg = actionAttempt === 'check-out'
              ? 'Check-out unsuccessful! Location mismatch - you are not at the department/group location.'
              : 'Check-in unsuccessful! Location mismatch - you are not at the department/group location.';

            return new Response(
              JSON.stringify({
                match: true,
                user: {
                  user_id: user.user_id,
                  first_name: user.first_name,
                  last_name: user.last_name,
                },
                confidence,
                error: "Location mismatch",
                message: msg,
                action: actionAttempt,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        const currentTime = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Kuala_Lumpur",
        });

        let status = "present";
        let action = "";

        if (!existingAttendance) {
          // Check-in logic
          if (startTime && currentTime > startTime) {
            status = "late";
          }

          const { error: insertError } = await supabase.from("attendance").insert({
            user_id: user.user_id,
            status,
            check_in_time: new Date().toISOString(),
            location: `${userLocation.latitude},${userLocation.longitude}`,
          });

          if (insertError) {
            console.error("Error inserting attendance:", insertError);
            throw insertError;
          }

          action = "check-in";
          console.log(`Check-in successful for user ${user.user_id} with status ${status}`);
        } else if (!existingAttendance.check_out_time) {
          // Check-out logic
          if (endTime && currentTime < endTime) {
            status = "early_out";
          }

          const { error: updateError } = await supabase
            .from("attendance")
            .update({
              check_out_time: new Date().toISOString(),
              status,
            })
            .eq("attendance_id", existingAttendance.attendance_id);

          if (updateError) {
            console.error("Error updating attendance:", updateError);
            throw updateError;
          }

          action = "check-out";
          console.log(`Check-out successful for user ${user.user_id} with status ${status}`);
        } else {
          return new Response(
            JSON.stringify({
              match: true,
              user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
              },
              confidence,
              message: "Already checked in and out today",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            match: true,
            user: {
              user_id: user.user_id,
              first_name: user.first_name,
              last_name: user.last_name,
            },
            confidence,
            action,
            status,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log(`No match found for request from IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "User not found", match: false, message: "User not found" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in compare-faces-public:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});