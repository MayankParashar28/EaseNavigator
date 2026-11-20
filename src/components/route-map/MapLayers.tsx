import { useEffect, useState } from 'react';
import { useMapsLibrary, useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useLatest } from './useLatest';

export interface CircleProps extends google.maps.CircleOptions {
  center: google.maps.LatLngLiteral;
  radius: number;
}

export const Circle = (props: CircleProps) => {
  const map = useMap();
  const [circle, setCircle] = useState<google.maps.Circle | null>(null);
  const propsRef = useLatest(props);

  useEffect(() => {
    if (!map) return;
    const newCircle = new google.maps.Circle({
      ...propsRef.current,
      map
    });
    setCircle(newCircle);

    return () => {
      newCircle.setMap(null);
    };
  }, [map, propsRef]);

  useEffect(() => {
    if (circle) {
      circle.setOptions(props);
    }
  }, [circle, props]);

  return null;
};

export function Directions({
  origin,
  destination,
  onRouteChanged
}: {
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  onRouteChanged?: (res: google.maps.DirectionsResult) => void
}) {
  const map = useMap();
  const onRouteChangedRef = useLatest(onRouteChanged);
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  // Initialize services
  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#10b981',
        strokeWeight: 4,
        strokeOpacity: 0.9,
      }
    }));
  }, [routesLibrary, map]);

  // Calculate Route
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) return;

    // cleanup previous route
    directionsRenderer.setMap(map);

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }).then(response => {
      directionsRenderer.setDirections(response);
      onRouteChangedRef.current?.(response);
    }).catch(err => {
      console.error("Directions request failed", err);
    });

    return () => {
      // Optional: clear directions when unmounting or changing specific dependencies if needed.
      // directionsRenderer.setDirections({ routes: [] }); 
    }

  }, [directionsService, directionsRenderer, origin, destination, map, onRouteChangedRef]);

  return null;
}

export function TrafficLayer({ show }: { show: boolean }) {
  const map = useMap();
  const mapsLibrary = useMapsLibrary('maps');
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer>();

  useEffect(() => {
    if (!mapsLibrary || !map) return;
    const layer = new mapsLibrary.TrafficLayer();
    setTrafficLayer(layer);

    return () => {
      layer.setMap(null);
    };
  }, [mapsLibrary, map]);

  useEffect(() => {
    if (trafficLayer) {
      trafficLayer.setMap(show ? map : null);
    }
  }, [trafficLayer, show, map]);

  return null;
}

export function Map3DController({ tilt, heading }: { tilt: number, heading: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.moveCamera({ tilt, heading });
    }
  }, [map, tilt, heading]);
  return null;
}

export function UserLocationMarker() {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Could not get user location", err)
      );
    }
  }, []);

  if (!position) return null;

  return (
    <AdvancedMarker position={position} zIndex={100}>
      <div className="relative flex items-center justify-center">
        <div className="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping" />
        <div className="w-4 h-4 bg-white rounded-full border-4 border-blue-500 shadow-xl" />
      </div>
    </AdvancedMarker>
  );
}
