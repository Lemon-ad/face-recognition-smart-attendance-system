import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapPin, Search, Locate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationMapPickerProps {
  value?: string;
  onChange: (coordinates: string) => void;
}

export function LocationMapPicker({ value, onChange }: LocationMapPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [coordinates, setCoordinates] = useState<string>(value || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = '4bb748cd56d517de39f2a93e88ab9c3bf69c06ed38d134940f3f718c5d8b7b71';

    // Parse initial coordinates if provided, otherwise try geolocation
    let initialCenter: [number, number] = [101.6869, 3.1390]; // Default: Kuala Lumpur
    if (value) {
      const [lng, lat] = value.split(',').map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        initialCenter = [lng, lat];
      }
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: 12,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Try to get user's location
    if (!value && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 14,
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }

    // Add initial marker if coordinates exist
    if (value) {
      marker.current = new mapboxgl.Marker({ draggable: true })
        .setLngLat(initialCenter)
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        const coords = `${lngLat.lng},${lngLat.lat}`;
        setCoordinates(coords);
        onChange(coords);
      });
    }

    // Add click handler to map
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      const coords = `${lng},${lat}`;
      
      // Remove existing marker
      if (marker.current) {
        marker.current.remove();
      }

      // Add new marker
      marker.current = new mapboxgl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        const coords = `${lngLat.lng},${lngLat.lat}`;
        setCoordinates(coords);
        onChange(coords);
      });

      setCoordinates(coords);
      onChange(coords);
    });

    return () => {
      map.current?.remove();
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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=4bb748cd56d517de39f2a93e88ab9c3bf69c06ed38d134940f3f718c5d8b7b71&limit=1`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        
        // Fly to location
        map.current?.flyTo({
          center: [lng, lat],
          zoom: 15,
        });

        // Add marker
        if (marker.current) {
          marker.current.remove();
        }

        marker.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        marker.current.on('dragend', () => {
          const lngLat = marker.current!.getLngLat();
          const coords = `${lngLat.lng},${lngLat.lat}`;
          setCoordinates(coords);
          onChange(coords);
        });

        const coords = `${lng},${lat}`;
        setCoordinates(coords);
        onChange(coords);

        toast({
          title: 'Location found',
          description: data.features[0].place_name,
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
          
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 15,
          });

          // Add marker
          if (marker.current) {
            marker.current.remove();
          }

          marker.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);

          marker.current.on('dragend', () => {
            const lngLat = marker.current!.getLngLat();
            const coords = `${lngLat.lng},${lngLat.lat}`;
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
