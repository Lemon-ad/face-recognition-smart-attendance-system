import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { PublicFaceScanDialog } from '../PublicFaceScanDialog';
import { mockSupabase } from '../../tests/mocks/supabase';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('PublicFaceScanDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 3.0738,
            longitude: 101.5183,
          },
        });
      }),
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    // Mock getUserMedia
    Object.defineProperty(global.navigator.mediaDevices, 'getUserMedia', {
      value: vi.fn().mockResolvedValue(mockStream),
      writable: true,
    });
  });

  it('should render dialog when open', () => {
    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('Face Recognition Attendance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan face/i })).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    render(
      <PublicFaceScanDialog open={false} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.queryByText('Face Recognition Attendance')).not.toBeInTheDocument();
  });

  it('should start camera on dialog open', async () => {
    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'user' },
      });
    });
  });

  it('should display current GPS location', async () => {
    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Your Current GPS Location:/i)).toBeInTheDocument();
      expect(screen.getByText(/Lat: 3.073800/i)).toBeInTheDocument();
    });
  });

  it('should handle camera access error', async () => {
    const { toast } = await import('sonner');
    
    Object.defineProperty(global.navigator.mediaDevices, 'getUserMedia', {
      value: vi.fn().mockRejectedValue(new Error('Camera access denied')),
      writable: true,
    });

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to access camera');
    });
  });

  it('should capture and upload image on scan', async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke
      .mockResolvedValueOnce({
        data: { url: 'https://i.ibb.co/test.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          match: true,
          user: { first_name: 'John', last_name: 'Doe' },
          action: 'check-in',
          status: 'present',
        },
        error: null,
      });

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan face/i })).toBeEnabled();
    });

    const scanButton = screen.getByRole('button', { name: /scan face/i });
    await user.click(scanButton);

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'upload-image',
        expect.objectContaining({
          body: expect.any(FormData),
        })
      );
    });
  });

  it('should show location error when geolocation fails', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error({ code: 1, message: 'User denied geolocation' });
      }),
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: { url: 'https://i.ibb.co/test.jpg' },
      error: null,
    });

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan face/i })).toBeEnabled();
    });

    const scanButton = screen.getByRole('button', { name: /scan face/i });
    await user.click(scanButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Location access required')
      );
    });
  });

  it('should handle location mismatch error', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    mockSupabase.functions.invoke
      .mockResolvedValueOnce({
        data: { url: 'https://i.ibb.co/test.jpg' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Location mismatch',
          message: 'You are not within the allowed area',
        },
        error: null,
      });

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan face/i })).toBeEnabled();
    });

    const scanButton = screen.getByRole('button', { name: /scan face/i });
    await user.click(scanButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'You are not within the allowed area',
        expect.any(Object)
      );
    });
  });

  it('should close dialog and stop camera on cancel', async () => {
    const user = userEvent.setup();

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should disable scan button when processing', async () => {
    const user = userEvent.setup();

    mockSupabase.functions.invoke.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(
      <PublicFaceScanDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan face/i })).toBeEnabled();
    });

    const scanButton = screen.getByRole('button', { name: /scan face/i });
    await user.click(scanButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    });
  });
});
