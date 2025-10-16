import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapPin, Search, Locate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationMapPickerProps {
  value?: string;
  onChange: (coordinates: string) => void;
}

export function LocationMapPicker({ value, onChange }: LocationMapPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [coordinates, setCoordinates] = useState<string>(value || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Parse initial coordinates if provided, otherwise try geolocation
    let initialCenter: [number, number] = [3.1390, 101.6869]; // Default: Kuala Lumpur [lat, lng]
    if (value) {
      const [lng, lat] = value.split(',').map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        initialCenter = [lat, lng]; // Leaflet uses [lat, lng]
      }
    }

    // Initialize map
    map.current = L.map(mapContainer.current).setView(initialCenter, 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Try to get user's location
    if (!value && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          map.current?.setView([latitude, longitude], 14);
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }

    // Add initial marker if coordinates exist
    if (value) {
      marker.current = L.marker(initialCenter, { draggable: true }).addTo(map.current);

      marker.current.on('dragend', () => {
        const latlng = marker.current!.getLatLng();
        const coords = `${latlng.lng},${latlng.lat}`;
        setCoordinates(coords);
        onChange(coords);
      });
    }

    // Add click handler to map
    map.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const coords = `${lng},${lat}`;
      
      // Remove existing marker
      if (marker.current) {
        marker.current.remove();
      }

      // Add new marker
      marker.current = L.marker([lat, lng], { draggable: true }).addTo(map.current!);

      marker.current.on('dragend', () => {
        const latlng = marker.current!.getLatLng();
        const coords = `${latlng.lng},${latlng.lat}`;
        setCoordinates(coords);
        onChange(coords);
      });

      setCoordinates(coords);
      onChange(coords);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const handleClear = () => {
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
    setCoordinates('');
    onChange('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Using Nominatim (OpenStreetMap's geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        
        // Fly to location
        map.current?.setView([lat, lng], 15);

        // Add marker
        if (marker.current) {
          marker.current.remove();
        }

        marker.current = L.marker([lat, lng], { draggable: true }).addTo(map.current!);

        marker.current.on('dragend', () => {
          const latlng = marker.current!.getLatLng();
          const coords = `${latlng.lng},${latlng.lat}`;
          setCoordinates(coords);
          onChange(coords);
        });

        const coords = `${lng},${lat}`;
        setCoordinates(coords);
        onChange(coords);

        toast({
          title: 'Location found',
          description: data[0].display_name,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Not found',
          description: 'Could not find the location. Try a different search.',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to search location.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          
          map.current?.setView([latitude, longitude], 15);

          // Add marker
          if (marker.current) {
            marker.current.remove();
          }

          marker.current = L.marker([latitude, longitude], { draggable: true }).addTo(map.current!);

          marker.current.on('dragend', () => {
            const latlng = marker.current!.getLatLng();
            const coords = `${latlng.lng},${latlng.lat}`;
            setCoordinates(coords);
            onChange(coords);
          });

          const coords = `${longitude},${latitude}`;
          setCoordinates(coords);
          onChange(coords);

          toast({
            title: 'Location detected',
            description: 'Map centered on your current location',
          });
        },
        (error) => {
          toast({
            variant: 'destructive',
            title: 'Location error',
            description: 'Could not get your location. Please enable location services.',
          });
        }
      );
    } else {
      toast({
        variant: 'destructive',
        title: 'Not supported',
        description: 'Geolocation is not supported by your browser.',
      });
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a place, building, or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
        <Button type="button" variant="outline" onClick={handleLocateMe}>
          <Locate className="h-4 w-4" />
        </Button>
      </form>
      
      <div ref={mapContainer} className="w-full h-[400px] rounded-lg border" />
      
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{coordinates || 'Click on map to select location'}</span>
        </div>
        {coordinates && (
          <Button type="button" variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
