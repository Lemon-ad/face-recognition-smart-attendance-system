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

    console.log(`✓ Database query successful. Found ${users?.length || 0} users with photos`);
    
    if (users && users.length > 0) {
      console.log("User photo URLs:");
      users.forEach((u, idx) => {
        console.log(`  ${idx + 1}. ${u.first_name} ${u.last_name}: ${u.photo_url}`);
      });
    }

    if (!users || users.length === 0) {
      console.log("✗ No users with photos found in database");
      return new Response(
        JSON.stringify({ error: "No registered users found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to match face with each user
    console.log(`\n=== Starting Face++ comparison for ${users.length} users ===`);
    console.log(`📸 Captured Image URL (from ImgBB): ${capturedImageUrl}`);
    
    for (const user of users) {
      console.log(`\n🔍 Comparing with user: ${user.first_name} ${user.last_name}`);
      console.log(`  📷 Registered Photo URL (from database): ${user.photo_url}`);
      
      const formData = new FormData();
      formData.append("api_key", FACEPP_API_KEY);
      formData.append("api_secret", FACEPP_API_SECRET);
      formData.append("image_url1", capturedImageUrl); // ImgBB URL with .jpg
      formData.append("image_url2", user.photo_url);   // Database photo_url

      console.log(`  ⚡ Calling Face++ API with both URLs...`);
      const faceppResponse = await fetch(
        "https://api-us.faceplusplus.com/facepp/v3/compare",
        {
          method: "POST",
          body: formData,
        }
      );

      const faceppData = await faceppResponse.json();
      console.log(`  Face++ response:`, JSON.stringify(faceppData, null, 2));

      if (faceppData.error_message) {
        console.error(`✗ Face++ API error for ${user.first_name}: ${faceppData.error_message}`);
        continue;
      }

      const confidence = faceppData.confidence || 0;
      const threshold1e3 = faceppData.thresholds?.["1e-3"] || 62.327;
      console.log(`  Confidence: ${confidence}%`);
      console.log(`  Face++ recommended threshold (1e-3): ${threshold1e3}%`);
      console.log(`  Match result: ${confidence > threshold1e3 ? "✓ MATCH" : "✗ NO MATCH"}`);

      if (confidence > threshold1e3) {
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
          console.log("Group data retrieved:", groupData);
        }

        const { data: deptData } = await supabase
          .from("department")
          .select("department_location, geofence_radius, start_time, end_time")
          .eq("department_id", user.department_id)
          .maybeSingle();
        
        console.log("Department data retrieved:", deptData);

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
          // Database stores as lon,lat (longitude first, latitude second)
          const [targetLon, targetLat] = targetLocation.split(",").map(Number);
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            targetLat,
            targetLon
          );

          console.log(`Location check for user ${user.user_id}:`);
          console.log(`  User GPS: lat=${userLocation.latitude}, lon=${userLocation.longitude}`);
          console.log(`  Target: lat=${targetLat}, lon=${targetLon}`);
          console.log(`  Distance: ${distance}m, Allowed: ${radius}m`);

          if (distance > radius) {
            console.log(`Location validation FAILED: distance ${distance}m > radius ${radius}m`);
            const actionAttempt = existingAttendance && existingAttendance.check_in_time ? 'check-out' : 'check-in';
            const msg = actionAttempt === 'check-out'
              ? `Check-out is unsuccessful due to location mismatch. Pls try again, ${user.first_name} ${user.last_name}`
              : `Check-in is unsuccessful due to location mismatch. Pls try again, ${user.first_name} ${user.last_name}`;

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
                action: actionAttempt
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

        if (!existingAttendance || !existingAttendance.check_in_time) {
          // Check-in logic: No attendance record OR no check-in time yet
          if (startTime && currentTime > startTime) {
            status = "late";
          }

          if (!existingAttendance) {
            // Create new attendance record
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
          } else {
            // Update existing absent record with check-in
            const { error: updateError } = await supabase
              .from("attendance")
              .update({
                check_in_time: new Date().toISOString(),
                status,
                location: `${userLocation.latitude},${userLocation.longitude}`,
              })
              .eq("attendance_id", existingAttendance.attendance_id);

            if (updateError) {
              console.error("Error updating attendance with check-in:", updateError);
              throw updateError;
            }
          }

          action = "check-in";
          console.log(`Check-in successful for user ${user.user_id} with status ${status}`);
        } else {
          // Check-out logic: Already checked in, so update check-out (can be done multiple times)
          if (endTime && currentTime < endTime) {
            status = "early_out";
          } else {
            status = "present"; // Normal check-out
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
          const isUpdate = existingAttendance.check_out_time ? " (updated)" : "";
          console.log(`Check-out successful${isUpdate} for user ${user.user_id} with status ${status}`);
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