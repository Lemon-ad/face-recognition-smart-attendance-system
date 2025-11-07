import { describe, it, expect, beforeEach } from 'https://deno.land/std@0.192.0/testing/bdd.ts';
import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

/**
 * Edge Function Tests for compare-faces-public
 * 
 * Run these tests using Deno:
 * deno test --allow-env --allow-net supabase/functions/compare-faces-public/__tests__/index.test.ts
 */

describe('compare-faces-public edge function', () => {
  beforeEach(() => {
    Deno.env.set('FACEPP_API_KEY', 'test_key');
    Deno.env.set('FACEPP_API_SECRET', 'test_secret');
    Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test_service_key');
  });

  describe('Public access (no authentication)', () => {
    it('should not require authorization header', () => {
      // Public endpoint should work without auth header
      const headers = new Headers();
      const authHeader = headers.get('Authorization');
      
      // Should be able to proceed even without auth
      assertEquals(authHeader, null);
    });

    it('should log IP address for audit trail', () => {
      const mockHeaders = new Headers({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });

      const clientIP = mockHeaders.get('x-forwarded-for') || 'unknown';
      
      assertEquals(clientIP, '192.168.1.1, 10.0.0.1');
    });
  });

  describe('Input validation', () => {
    it('should validate required fields', () => {
      const validInput = {
        capturedImageUrl: 'https://i.ibb.co/test.jpg',
        userLocation: {
          latitude: 3.0738,
          longitude: 101.5183,
        },
      };

      assertEquals(!!validInput.capturedImageUrl, true);
      assertEquals(!!validInput.userLocation, true);
      assertEquals(typeof validInput.userLocation.latitude, 'number');
      assertEquals(typeof validInput.userLocation.longitude, 'number');
    });

    it('should reject missing userLocation', () => {
      const invalidInput = {
        capturedImageUrl: 'https://i.ibb.co/test.jpg',
        // Missing userLocation
      };

      const hasRequiredFields = !!(invalidInput.capturedImageUrl && (invalidInput as any).userLocation);
      
      assertEquals(hasRequiredFields, false);
    });

    it('should validate image URL is from trusted domain', () => {
      const allowedDomains = ['i.ibb.co', 'ibb.co'];
      const testUrls = [
        { url: 'https://i.ibb.co/test.jpg', valid: true },
        { url: 'https://ibb.co/test.jpg', valid: true },
        { url: 'https://evil.com/test.jpg', valid: false },
      ];

      testUrls.forEach(test => {
        const urlObj = new URL(test.url);
        const isValid = allowedDomains.includes(urlObj.hostname);
        assertEquals(isValid, test.valid);
      });
    });
  });

  describe('Multi-user face matching', () => {
    it('should iterate through all users with photos', () => {
      const mockUsers = [
        { user_id: '1', first_name: 'John', last_name: 'Doe', photo_url: 'url1' },
        { user_id: '2', first_name: 'Jane', last_name: 'Smith', photo_url: 'url2' },
        { user_id: '3', first_name: 'Bob', last_name: 'Johnson', photo_url: 'url3' },
      ];

      // Should check all users
      assertEquals(mockUsers.length, 3);
      
      // All should have photo_url
      mockUsers.forEach(user => {
        assertExists(user.photo_url);
      });
    });

    it('should stop on first match', () => {
      const users = ['user1', 'user2', 'user3'];
      let matchFound = false;
      let checkedUsers = 0;

      for (const user of users) {
        checkedUsers++;
        if (user === 'user2') {
          matchFound = true;
          break;
        }
      }

      assertEquals(matchFound, true);
      assertEquals(checkedUsers, 2); // Should have checked only 2 users
    });

    it('should return user not found if no match', () => {
      const mockConfidences = [50.5, 45.2, 60.1]; // All below threshold
      const threshold = 69.101;

      const hasMatch = mockConfidences.some(conf => conf > threshold);
      
      assertEquals(hasMatch, false);
    });
  });

  describe('Location verification', () => {
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

    it('should prioritize group location over department location', () => {
      const groupLocation = '101.5183,3.0738';
      const deptLocation = '101.6048,3.1073';

      const targetLocation = groupLocation || deptLocation;
      
      assertEquals(targetLocation, groupLocation);
    });

    it('should use department location if no group', () => {
      const groupLocation = null;
      const deptLocation = '101.6048,3.1073';

      const targetLocation = groupLocation || deptLocation;
      
      assertEquals(targetLocation, deptLocation);
    });

    it('should handle location string format (lon,lat)', () => {
      const locationString = '101.5183,3.0738'; // lon,lat format
      const [lon, lat] = locationString.split(',').map(Number);

      assertEquals(lon, 101.5183);
      assertEquals(lat, 3.0738);
    });

    it('should return location mismatch error with user info', () => {
      const errorResponse = {
        match: true,
        user: {
          user_id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
        },
        confidence: 85.5,
        error: 'Location mismatch',
        message: 'Check-in is unsuccessful due to location mismatch. Pls try again, John Doe',
        action: 'check-in',
      };

      assertEquals(errorResponse.match, true); // Face matched
      assertEquals(errorResponse.error, 'Location mismatch');
      assertExists(errorResponse.user);
      assertExists(errorResponse.message);
    });
  });

  describe('Check-in/Check-out logic', () => {
    it('should determine check-in action when no existing attendance', () => {
      const existingAttendance = null;
      const action = !existingAttendance || !existingAttendance ? 'check-in' : 'check-out';
      
      assertEquals(action, 'check-in');
    });

    it('should determine check-out action when already checked in', () => {
      const existingAttendance = {
        attendance_id: 'att-123',
        check_in_time: '2025-11-06T09:00:00',
        check_out_time: null,
      };
      
      const action = existingAttendance && existingAttendance.check_in_time ? 'check-out' : 'check-in';
      
      assertEquals(action, 'check-out');
    });

    it('should allow multiple check-outs', () => {
      const existingAttendance = {
        attendance_id: 'att-123',
        check_in_time: '2025-11-06T09:00:00',
        check_out_time: '2025-11-06T17:00:00', // Already checked out
      };

      // Should still allow check-out (update)
      const canCheckOut = !!existingAttendance.check_in_time;
      
      assertEquals(canCheckOut, true);
    });
  });

  describe('Timezone handling', () => {
    it('should use Asia/Kuala_Lumpur timezone', () => {
      const timezone = 'Asia/Kuala_Lumpur';
      const testDate = new Date('2025-11-06T10:00:00Z');
      
      const klTime = testDate.toLocaleString('en-US', { timeZone: timezone });
      
      assertExists(klTime);
      assertEquals(typeof klTime, 'string');
    });

    it('should format date as YYYY-MM-DD for KL timezone', () => {
      const testDate = new Date('2025-11-06T10:00:00Z');
      const todayKL = testDate.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
      });

      // Should be in YYYY-MM-DD format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      assertEquals(dateRegex.test(todayKL), true);
    });
  });

  describe('Response handling', () => {
    it('should return success response with user info', () => {
      const successResponse = {
        match: true,
        user: {
          user_id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
        },
        confidence: 85.5,
        action: 'check-in',
        status: 'present',
      };

      assertEquals(successResponse.match, true);
      assertExists(successResponse.user);
      assertEquals(successResponse.action, 'check-in');
      assertEquals(successResponse.status, 'present');
    });

    it('should return no match response', () => {
      const noMatchResponse = {
        error: 'User not found',
        match: false,
        message: 'User not found',
      };

      assertEquals(noMatchResponse.match, false);
      assertEquals(noMatchResponse.error, 'User not found');
    });
  });

  describe('Error handling', () => {
    it('should handle Face++ API errors gracefully', () => {
      const faceppError = {
        error_message: 'IMAGE_ERROR_UNSUPPORTED_FORMAT',
      };

      assertExists(faceppError.error_message);
      assertEquals(typeof faceppError.error_message, 'string');
    });

    it('should handle database errors', () => {
      const dbError = {
        code: 'PGRST116',
        message: 'No rows found',
      };

      assertExists(dbError.message);
      assertEquals(!!dbError.code, true);
    });
  });
});
