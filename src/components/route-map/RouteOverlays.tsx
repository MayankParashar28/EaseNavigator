import { useEffect, useState } from 'react';
import { useMapsLibrary, useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { CloudRain, Snowflake } from 'lucide-react';
import { getRouteEnvData, RouteEnvData } from '../../lib/envService';
import type { RouteWithGeom, RouteSegment } from './types';
import { Circle } from './MapLayers';

export function WeatherOverlay({
  geometry
}: {
  geometry: [number, number][]
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const [envData, setEnvData] = useState<RouteEnvData | null>(null);

  useEffect(() => {
    if (geometry.length > 0) {
      setEnvData(getRouteEnvData(geometry));
    }
  }, [geometry]);

  useEffect(() => {
    if (!map || !maps || !envData) return;

    // 1. Temperature Gradient Polylines
    // Break geometry into small chunks for gradient effect
    const polylines: google.maps.Polyline[] = [];
    const chunkSize = 5;

    for (let i = 0; i < envData.points.length - 1; i += chunkSize) {
      const chunk = envData.points.slice(i, i + chunkSize + 1);
      const avgTemp = chunk.reduce((acc, p) => acc + p.temp, 0) / chunk.length;

      // Interpolate color: Blue (32F) -> Yellow (70F) -> Red (100F)
      let color = '#3b82f6'; // blue
      if (avgTemp > 80) color = '#ef4444'; // red
      else if (avgTemp > 65) color = '#eab308'; // yellow

      const polyline = new google.maps.Polyline({
        path: chunk.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 6,
        map,
        zIndex: 1
      });
      polylines.push(polyline);
    }

    return () => {
      polylines.forEach(p => p.setMap(null));
    };
  }, [map, maps, envData]);

  if (!envData) return null;

  return (
    <>
      {/* 2. AQI Zones */}
      {envData.aqiZones.map((zone, i) => (
        <Circle
          key={`aqi-${i}`}
          center={{ lat: zone.lat, lng: zone.lng }}
          radius={zone.radius}
          fillColor={zone.aqi > 100 ? '#ef4444' : '#eab308'}
          fillOpacity={0.2}
          strokeColor={zone.aqi > 100 ? '#ef4444' : '#eab308'}
          strokeOpacity={0.5}
          strokeWeight={2}
        />
      ))}

      {/* 3. Precipitation & Weather Warnings */}
      {envData.weatherWarnings.map((warning, i) => (
        <AdvancedMarker
          key={`weather-warn-${i}`}
          position={{ lat: warning.lat, lng: warning.lng }}
          zIndex={20}
        >
          <div className="flex flex-col items-center">
            <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-blue-100 animate-bounce">
              {warning.type === 'rain' ?
                <CloudRain className="w-6 h-6 text-blue-500" /> :
                <Snowflake className="w-6 h-6 text-indigo-400" />
              }
            </div>
            <div className="mt-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              {warning.message}
            </div>
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

export function MultiRouteDisplay({
  routes,
  activeRouteId,
  onSelect,
  onHover
}: {
  routes: RouteWithGeom[],
  activeRouteId: string,
  onSelect?: (route: RouteWithGeom) => void,
  onHover?: (route: RouteWithGeom | null, event?: google.maps.MapMouseEvent) => void
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || !routes) return;

    const polylines: google.maps.Polyline[] = [];

    routes.forEach((route) => {
      if (!route.geometry) return;

      const isActive = route.id === activeRouteId;
      const path = route.geometry.map(p => ({ lat: p[0], lng: p[1] }));

      // Determine semantic color
      let color = '#94a3b8'; // default grey
      if (route.type === 'fastest') color = '#10b981'; // green
      if (route.type === 'efficient') color = '#0ea5e9'; // blue

      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: isActive ? 1.0 : 0.5,
        strokeWeight: isActive ? 5 : 3,
        map,
        zIndex: isActive ? 10 : 5,
        clickable: true
      });

      polyline.addListener('click', () => {
        if (onSelect) onSelect(route);
      });

      polyline.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
        if (!isActive) polyline.setOptions({ strokeOpacity: 0.8, strokeWeight: 4 });
        if (onHover) onHover(route, e);
      });

      polyline.addListener('mouseout', () => {
        if (!isActive) polyline.setOptions({ strokeOpacity: 0.5, strokeWeight: 3 });
        if (onHover) onHover(null);
      });

      polylines.push(polyline);
      // Removed inline info window markers logic
    });

    return () => {
      polylines.forEach(p => p.setMap(null));
    };
  }, [map, maps, routes, activeRouteId, onSelect, onHover]);

  return null;
}

export function RouteSegments({
  segments,
  hoveredIndex,
  onHoverSegment,
  onSelectSegment
}: {
  segments: RouteSegment[],
  hoveredIndex?: number | null,
  onHoverSegment?: (index: number | null) => void,
  onSelectSegment?: (segment: RouteSegment) => void
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || !segments || segments.length === 0) return;

    const polylines: google.maps.Polyline[] = [];
    const segmentsWithIcons: google.maps.InfoWindow[] = [];

    segments.forEach((segment, i) => {
      const isHovered = hoveredIndex === i;

      // Traffic colors
      let strokeColor = '#10b981'; // default green (low)
      if (segment.trafficLevel === 'moderate') strokeColor = '#eab308'; // yellow
      if (segment.trafficLevel === 'heavy') strokeColor = '#ef4444'; // red

      const polyline = new google.maps.Polyline({
        path: segment.points.map(p => ({ lat: p[0], lng: p[1] })),
        strokeColor: isHovered ? '#00d2ff' : strokeColor,
        strokeOpacity: isHovered ? 1.0 : 0.8,
        strokeWeight: isHovered ? 12 : 8,
        map,
        zIndex: isHovered ? 10 : 5
      });

      polyline.addListener('mouseover', () => {
        polyline.setOptions({ strokeColor: '#00d2ff', strokeWeight: 12, strokeOpacity: 1 });
        if (onHoverSegment) onHoverSegment(i);
      });

      polyline.addListener('mouseout', () => {
        if (!isHovered) {
          // Restore this segment's own traffic color (not always green)
          polyline.setOptions({ strokeColor, strokeWeight: 8, strokeOpacity: 0.8 });
        }
        if (onHoverSegment) onHoverSegment(null);
      });

      polyline.addListener('click', () => {
        if (onSelectSegment) onSelectSegment(segment);
      });

      polylines.push(polyline);

      // Add Weather/Traffic Icon at Segment Midpoint if severe
      if (segment.trafficLevel === 'heavy' || segment.weather !== 'Clear') {
        const midPointIdx = Math.floor(segment.points.length / 2);
        const midPoint = segment.points[midPointIdx];

        const content = document.createElement('div');
        content.className = 'flex flex-col items-center animate-bounce-slow pointer-events-none';

        let iconHtml = '';
        if (segment.trafficLevel === 'heavy') iconHtml = '🚗';
        else if (segment.weather.includes('Rain')) iconHtml = '🌧️';
        else if (segment.weather.includes('Snow')) iconHtml = '❄️';
        else iconHtml = '🌤️';

        content.innerHTML = `<div class="bg-midnight/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl text-xs">${iconHtml}</div>`;

        const infoWindow = new google.maps.InfoWindow({
          position: { lat: midPoint[0], lng: midPoint[1] },
          content: content,
          disableAutoPan: true,
          headerDisabled: true
        });

        infoWindow.open(map);
        segmentsWithIcons.push(infoWindow);
      }
    });

    return () => {
      polylines.forEach(s => s.setMap(null));
      segmentsWithIcons.forEach(iw => iw.close());
    };
  }, [map, maps, segments, hoveredIndex, onHoverSegment, onSelectSegment]);

  return null;
}
