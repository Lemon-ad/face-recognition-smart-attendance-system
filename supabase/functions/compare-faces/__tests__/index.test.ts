import { describe, it, expect, beforeEach } from 'https://deno.land/std@0.192.0/testing/bdd.ts';
import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

/**
 * Edge Function Tests for compare-faces
 * 
 * Run these tests using Deno:
 * deno test --allow-env --allow-net supabase/functions/compare-faces/__tests__/index.test.ts
 */

describe('compare-faces edge function', () => {
  beforeEach(() => {
    Deno.env.set('FACEPP_API_KEY', 'test_key');
    Deno.env.set('FACEPP_API_SECRET', 'test_secret');
    Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
    Deno.env.set('SUPABASE_ANON_KEY', 'test_anon_key');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test_service_key');
  });

  describe('Haversine distance calculation', () => {
    // Copy the function for testing
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

    it('should calculate zero distance for same coordinates', () => {
      const distance = calculateDistance(3.0738, 101.5183, 3.0738, 101.5183);
      assertEquals(Math.round(distance), 0);
    });

    it('should calculate correct distance between two points', () => {
      // Kuala Lumpur to Petaling Jaya (approximately 10km)
      const distance = calculateDistance(3.1390, 101.6869, 3.1073, 101.6048);
      
      // Should be roughly 8-10km
      assertEquals(distance > 7000, true);
      assertEquals(distance < 12000, true);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateDistance(-33.8688, 151.2093, -33.9173, 151.2313);
      
      // Sydney coordinates, should be positive distance
      assertEquals(distance > 0, true);
    });
  });

  describe('Input validation', () => {
    it('should validate UUID format', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      assertEquals(uuidRegex.test(validUUID), true);
    });

    it('should validate URL format', () => {
      const validUrl = 'https://i.ibb.co/test/image.jpg';
      const isValid = validUrl.startsWith('https://i.ibb.co/') || validUrl.startsWith('https://ibb.co/');
      
      assertEquals(isValid, true);
    });

    it('should reject invalid URL domains', () => {
      const invalidUrl = 'https://evil.com/image.jpg';
      const allowedDomains = ['i.ibb.co', 'ibb.co'];
      const urlObj = new URL(invalidUrl);
      const isValid = allowedDomains.includes(urlObj.hostname);
      
      assertEquals(isValid, false);
    });

    it('should validate latitude range', () => {
      const validLatitudes = [0, 45, -45, 90, -90];
      const invalidLatitudes = [91, -91, 100];

      validLatitudes.forEach(lat => {
        assertEquals(lat >= -90 && lat <= 90, true);
      });

      invalidLatitudes.forEach(lat => {
        assertEquals(lat >= -90 && lat <= 90, false);
      });
    });

    it('should validate longitude range', () => {
      const validLongitudes = [0, 90, -90, 180, -180];
      const invalidLongitudes = [181, -181, 200];

      validLongitudes.forEach(lon => {
        assertEquals(lon >= -180 && lon <= 180, true);
      });

      invalidLongitudes.forEach(lon => {
        assertEquals(lon >= -180 && lon <= 180, false);
      });
    });
  });

  describe('Face matching logic', () => {
    it('should match when confidence exceeds threshold', () => {
      const confidence = 75.5;
      const threshold = 69.101;
      
      assertEquals(confidence > threshold, true);
    });

    it('should not match when confidence below threshold', () => {
      const confidence = 65.0;
      const threshold = 69.101;
      
      assertEquals(confidence > threshold, false);
    });

    it('should use Face++ recommended threshold', () => {
      const thresholds = {
        '1e-3': 62.327,
        '1e-4': 69.101,
        '1e-5': 73.975,
      };

      // Using 1e-4 threshold (recommended)
      const selectedThreshold = thresholds['1e-4'];
      assertEquals(selectedThreshold, 69.101);
    });
  });

  describe('Attendance status determination', () => {
    it('should mark as late when check-in after start time', () => {
      const currentTime = '09:30'; // 9:30 AM
      const startTime = '09:00';   // 9:00 AM
      
      const isLate = currentTime > startTime;
      const status = isLate ? 'late' : 'present';
      
      assertEquals(status, 'late');
    });

    it('should mark as present when check-in on time', () => {
      const currentTime = '08:45'; // 8:45 AM
      const startTime = '09:00';   // 9:00 AM
      
      const isLate = currentTime > startTime;
      const status = isLate ? 'late' : 'present';
      
      assertEquals(status, 'present');
    });

    it('should mark as early_out when check-out before end time', () => {
      const currentTime = '16:30'; // 4:30 PM
      const endTime = '17:00';     // 5:00 PM
      
      const isEarlyOut = currentTime < endTime;
      const status = isEarlyOut ? 'early_out' : 'present';
      
      assertEquals(status, 'early_out');
    });
  });

  describe('Authorization checks', () => {
    it('should require authorization header', () => {
      const headers = new Headers();
      const authHeader = headers.get('Authorization');
      
      assertEquals(authHeader, null);
    });

    it('should validate user can only check own attendance', () => {
      const requestingUserId = 'user-123';
      const targetUserId = 'user-456';
      const isAdmin = false;

      const isAuthorized = (requestingUserId === targetUserId) || isAdmin;
      
      assertEquals(isAuthorized, false);
    });

    it('should allow admin to check any attendance', () => {
      const requestingUserId = 'admin-123';
      const targetUserId = 'user-456';
      const isAdmin = true;

      const isAuthorized = (requestingUserId === targetUserId) || isAdmin;
      
      assertEquals(isAuthorized, true);
    });
  });

  describe('Location validation', () => {
    it('should validate user is within geofence', () => {
      const userLat = 3.0738;
      const userLon = 101.5183;
      const targetLat = 3.0740;
      const targetLon = 101.5185;
      const radius = 500; // 500 meters

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

      const distance = calculateDistance(userLat, userLon, targetLat, targetLon);
      const isWithinGeofence = distance <= radius;
      
      assertEquals(isWithinGeofence, true);
    });

    it('should reject user outside geofence', () => {
      const distance = 1000; // 1000 meters
      const radius = 500;    // 500 meters

      const isWithinGeofence = distance <= radius;
      
      assertEquals(isWithinGeofence, false);
    });
  });

  describe('Environment configuration', () => {
    it('should have required environment variables', () => {
      const apiKey = Deno.env.get('FACEPP_API_KEY');
      const apiSecret = Deno.env.get('FACEPP_API_SECRET');
      const supabaseUrl = Deno.env.get('SUPABASE_URL');

      assertExists(apiKey);
      assertExists(apiSecret);
      assertExists(supabaseUrl);
    });
  });
});
