import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PublicFaceScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicFaceScanDialog({ open, onOpenChange }: PublicFaceScanDialogProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      startCamera();
      // Get current location when dialog opens
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      stopCamera();
      setCurrentLocation(null);
    }

    return () => {
      stopCamera();
    };
  }, [open]);

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
      toast.error('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleClose = () => {
    // Stop camera
    stopCamera();
    
    // Clear canvas and reset dimensions
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      canvasRef.current.width = 0;
      canvasRef.current.height = 0;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Reset processing state
    setIsProcessing(false);
    
    // Close dialog
    onOpenChange(false);
  };

  const captureAndCompare = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera not ready');
      return;
    }

    setIsProcessing(true);

    try {
      // Get device location first
      let userLocation: { longitude: number; latitude: number } | null = null;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        userLocation = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude
        };
      } catch (geoError) {
        toast.error('Location access required for check-in. Please enable location services.');
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

      // Compare faces using Face++ (public scan - no userId)
      const response = await supabase.functions.invoke(
        'compare-faces-public',
        {
          body: { 
            capturedImageUrl: uploadData.url,
            userLocation: userLocation
          },
        }
      );

      console.log('Face scan response:', { data: response.data, error: response.error });

      // Check if there's data returned (even with error status)
      if (response.data) {
        // Check for location mismatch or other errors in the response data
        if (response.data.error === 'Location mismatch') {
          toast.error(response.data.message, {
            duration: 5000,
          });
          setIsProcessing(false);
          return;
        }
        
        // Check for any other error
        if (response.data.error && response.data.error !== 'Location mismatch') {
          toast.error(response.data.message || response.data.error, {
            duration: 5000,
          });
          setIsProcessing(false);
          return;
        }

        // Check for successful match
        if (response.data.match) {
          const userName = `${response.data.user.first_name} ${response.data.user.last_name}`;
          const action = response.data.action === 'check-out' ? 'Check-out' : 'Check-in';
          
          if (response.data.message && response.data.message.includes('Already checked')) {
            toast.info(response.data.message, {
              duration: 4000,
            });
            handleClose();
            return;
          }
          
          let message = `${action} successful! Welcome, ${userName}`;
          if (response.data.action === 'check-in') {
            if (response.data.status === 'present') {
              message += ' - You\'re on time! ✓';
            } else if (response.data.status === 'late') {
              message += ' - Marked as late';
            }
          } else if (response.data.action === 'check-out') {
            if (response.data.status === 'early_out') {
              message += ' - Early checkout noted';
            }
          }
          
          toast.success(message, {
            duration: 5000,
          });
          handleClose();
        } else {
          toast.error(response.data.error || 'Face not recognized. Please try again.', {
            duration: 5000,
          });
          setIsProcessing(false);
        }
      } else if (response.error) {
        console.error('Compare error:', response.error);
        toast.error('Failed to scan face. Please try again.', {
          duration: 5000,
        });
        setIsProcessing(false);
      }

    } catch (error) {
      console.error('Error during face scan:', error);
      toast.error('An error occurred during face recognition');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Face Recognition Attendance
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentLocation && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <div className="font-medium text-foreground">Your Current GPS Location:</div>
              <div className="text-muted-foreground">
                Lat: {currentLocation.latitude.toFixed(6)}, Lon: {currentLocation.longitude.toFixed(6)}
              </div>
              <div className="text-muted-foreground text-[10px]">
                (This will be compared with your department location)
              </div>
            </div>
          )}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
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
