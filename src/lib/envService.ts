export interface RouteEnvData {
    points: {
        lat: number;
        lng: number;
        temp: number;      // Fahrenheit
        aqi: number;       // Air Quality Index
        steepness: number; // 0-1 (0 = flat, 1 = extremely steep)
        precipitation: 'none' | 'rain' | 'snow';
    }[];
    aqiZones: {
        lat: number;
        lng: number;
        radius: number;
        aqi: number;
        label: string;
    }[];
    weatherWarnings: {
        lat: number;
        lng: number;
        type: 'rain' | 'snow';
        message: string;
    }[];
}

export const getRouteEnvData = (geometry: [number, number][]): RouteEnvData => {
    const points = geometry.map((p, i) => {
        const progress = i / geometry.length;

        // Simulate temp gradient: 65°F at start, 85°F at end
        const temp = 65 + progress * 20 + (Math.random() - 0.5) * 5;

        // Simulate AQI: mostly good (30-50), with some urban spikes
        let aqi = 30 + (Math.random() * 20);
        if (progress > 0.4 && progress < 0.5) aqi += 60; // Urban spike

        // Simulate steepness: mostly flat, with some mountain segments
        let steepness = Math.random() * 0.2;
        if (progress > 0.7 && progress < 0.8) steepness = 0.6 + Math.random() * 0.4;

        // Simulate precipitation
        let precipitation: 'none' | 'rain' | 'snow' = 'none';
        if (progress > 0.2 && progress < 0.3) precipitation = 'rain';
        if (temp < 35 && progress > 0.8) precipitation = 'snow';

        return {
            lat: p[0],
            lng: p[1],
            temp: Math.round(temp),
            aqi: Math.round(aqi),
            steepness,
            precipitation
        };
    });

    const aqiZones = [
        {
            lat: geometry[Math.floor(geometry.length * 0.45)][0],
            lng: geometry[Math.floor(geometry.length * 0.45)][1],
            radius: 5000,
            aqi: 110,
            label: 'Poor Air Quality'
        }
    ];

    const weatherWarnings: RouteEnvData['weatherWarnings'] = [];
    if (points.some(p => p.precipitation === 'rain')) {
        const p = points.find(p => p.precipitation === 'rain')!;
        weatherWarnings.push({ lat: p.lat, lng: p.lng, type: 'rain', message: 'Heavy Rain Predicted' });
    }

    return { points, aqiZones, weatherWarnings };
};
