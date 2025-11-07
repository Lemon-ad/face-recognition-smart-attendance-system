import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { mockSupabase } from '../../tests/mocks/supabase';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );

  describe('signIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockEmail = 'user@example.com';
      const mockUser = { id: 'user-123', email: mockEmail };
      
      // Mock RPC call to get email from username
      mockSupabase.rpc.mockResolvedValue({
        data: mockEmail,
        error: null,
      });
      
      // Mock successful sign in
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: { user: mockUser } },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn('testuser', 'password123');

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_email_for_login', {
        username_input: 'testuser',
      });
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockEmail,
        password: 'password123',
      });
    });

    it('should return error for invalid username', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn('invaliduser', 'password123');

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Invalid username or password');
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('should return error for wrong password', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'user@example.com',
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn('testuser', 'wrongpassword');

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Invalid username or password');
    });

    it('should handle RPC errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn('testuser', 'password123');

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Authentication failed');
    });
  });

  describe('signOut', () => {
    it('should sign out and navigate to auth page', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/auth');
      expect(result.current.userRole).toBeNull();
    });
  });

  describe('fetchUserRole', () => {
    it('should fetch and set user role on session change', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const mockSession = { user: mockUser };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null,
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe('admin');
      });
    });

    it('should handle missing user role gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'newuser@example.com' };
      const mockSession = { user: mockUser };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.userRole).toBeNull();
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
