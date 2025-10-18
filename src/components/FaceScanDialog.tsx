import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface FaceScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaceScanDialog({ open, onOpenChange }: FaceScanDialogProps) {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ user_id: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      startCamera();
      fetchUserProfile();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('auth_uuid', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load user profile');
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleClose = () => {
    stopCamera();
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Reset processing state
    setIsProcessing(false);
    
    onOpenChange(false);
  };

  const captureAndCompare = async () => {
    if (!videoRef.current || !canvasRef.current || !userProfile) {
      toast.error('User profile not loaded');
      return;
    }

    setIsProcessing(true);

    try {
      // Get user's current location
      let userLocation: { latitude: number; longitude: number } | null = null;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (geoError) {
        console.error('Error getting location:', geoError);
        toast.error('Unable to access location. Please enable location services.');
        setIsProcessing(false);
        return;
      }

      // Capture image from video
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        toast.error('Failed to capture image');
        setIsProcessing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
      });

      // Upload to ImgBB
      const formData = new FormData();
      formData.append('image', blob);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        'upload-image',
        {
          body: formData,
        }
      );

      if (uploadError || !uploadData?.url) {
        toast.error('Failed to upload image');
        console.error('Upload error:', uploadError);
        setIsProcessing(false);
        return;
      }

      // Compare faces using Face++
      const { data: compareData, error: compareError } = await supabase.functions.invoke(
        'compare-faces',
        {
          body: { 
            capturedImageUrl: uploadData.url,
            userId: userProfile.user_id,
            location: userLocation
          },
        }
      );

      if (compareError) {
        toast.error('Failed to compare faces');
        console.error('Compare error:', compareError);
        setIsProcessing(false);
        return;
      }

      if (compareData.matched) {
        toast.success('Attendance marked successfully!', {
          duration: 5000,
        });
        handleClose();
      } else {
        toast.error(compareData.message || 'Unsuccessful, please check with admin.', {
          duration: 5000,
        });
      }

    } catch (error) {
      console.error('Error during face scan:', error);
      toast.error('An error occurred during face recognition');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Face Recognition
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">Starting camera...</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleClose}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={captureAndCompare}
              disabled={isProcessing || !stream}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Scan Face'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
