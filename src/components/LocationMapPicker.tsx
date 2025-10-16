import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { MapPin } from 'lucide-react';

interface LocationMapPickerProps {
  value?: string;
  onChange: (coordinates: string) => void;
}

export function LocationMapPicker({ value, onChange }: LocationMapPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [coordinates, setCoordinates] = useState<string>(value || '');

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = '4bb748cd56d517de39f2a93e88ab9c3bf69c06ed38d134940f3f718c5d8b7b71';

    // Parse initial coordinates if provided
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

  return (
    <div className="space-y-2">
      <div ref={mapContainer} className="w-full h-[300px] rounded-lg border" />
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
