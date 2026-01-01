
import { API_CONFIG } from '../config/api';

export interface WeatherData {
    temp: number; // Fahrenheit
    condition: string;
    description: string;
    humidity: number;
    windSpeed: number; // mph
    visibility: number; // meters
    icon?: string;
    isDay: boolean;
    impact: {
        efficiency: number; // Multiplier (e.g., 0.85 for 15% loss)
        rangeLoss: number; // Estimated % loss
        chargingSpeed: number; // Multiplier (e.g. 0.9 for slightly slower cold charging)
        message?: string;
    };
}

export class WeatherService {
    private static instance: WeatherService;
    private cache = new Map<string, { data: WeatherData; timestamp: number }>();
    private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    static getInstance(): WeatherService {
        if (!WeatherService.instance) {
            WeatherService.instance = new WeatherService();
        }
        return WeatherService.instance;
    }

    /**
     * Get current weather for a location
     */
    async getWeather(lat: number, lon: number): Promise<WeatherData> {
        const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            // Return cached copy to avoid mutation issues
            return { ...cached.data };
        }

        try {
            const apiKey = API_CONFIG.WEATHER.OPENWEATHER.API_KEY;

            if (apiKey && apiKey !== 'demo') {
                return await this.fetchFromAPI(lat, lon, apiKey);
            }
        } catch (e) {
            console.warn('Weather API failed, falling back to smart simulation', e);
        }

        // Fallback to smart simulation
        const data = this.generateSimulatedWeather(lat, lon);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    }

    /**
     * Fetch from OpenWeatherMap API
     */
    private async fetchFromAPI(lat: number, lon: number, apiKey: string): Promise<WeatherData> {
        const url = `${API_CONFIG.WEATHER.OPENWEATHER.BASE_URL}/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API Error: ${res.statusText}`);

        const data = await res.json();

        // Map API response to our interface
        const temp = data.main.temp;
        const condition = data.weather[0].main;
        const isDay = data.dt > data.sys.sunrise && data.dt < data.sys.sunset;

        const impact = this.calculateImpact(temp, condition);

        const weatherData: WeatherData = {
            temp,
            condition,
            description: data.weather[0].description,
            humidity: data.main.humidity,
            windSpeed: data.wind.speed,
            visibility: data.visibility,
            icon: data.weather[0].icon,
            isDay,
            impact
        };

        const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        this.cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
        return weatherData;
    }

    /**
     * Generate realistic weather based on latitude and season
     */
    private generateSimulatedWeather(lat: number, lon: number): WeatherData {
        const isNorthernHemisphere = lat > 0;
        const month = new Date().getMonth(); // 0-11
        // Use lon to shift the luck of the draw slightly for deterministic-ish results
        const lonOffset = Math.sin(lon) * 5;
        const isWinter = isNorthernHemisphere
            ? (month <= 2 || month >= 11)
            : (month >= 5 && month <= 7);

        // Base temp based on latitude (rough approximation)
        // Equator ~85F, Poles ~-10F
        let baseTemp = 90 - (Math.abs(lat) * 0.8) + lonOffset;

        // Adjust for season
        if (isWinter) baseTemp -= 20;
        else baseTemp += 10;

        // Add random variation
        const temp = baseTemp + (Math.random() * 20 - 10);

        // Determine condition based on temp
        let condition = 'Clear';
        let icon = '01d';

        if (Math.random() > 0.7) {
            if (temp < 32) {
                condition = 'Snow';
                icon = '13d';
            } else if (Math.random() > 0.5) {
                condition = 'Rain';
                icon = '10d';
            } else {
                condition = 'Clouds';
                icon = '03d';
            }
        }

        const impact = this.calculateImpact(temp, condition);

        return {
            temp: Math.round(temp),
            condition,
            description: `Simulated ${condition.toLowerCase()}`,
            humidity: Math.round(Math.random() * 50 + 30),
            windSpeed: Math.round(Math.random() * 15),
            visibility: 10000,
            icon,
            isDay: true,
            impact
        };
    }

    private calculateImpact(temp: number, condition: string): WeatherData['impact'] {
        let efficiency = 1.0;
        let message: string | undefined;

        // Temperature impact logic
        // Optimal range for EVs is typically 65-75F
        if (temp < 20) {
            efficiency *= 0.70; // Severe cold shock
            message = "Extreme cold reducing range by ~30%";
        } else if (temp < 40) {
            efficiency *= 0.85; // Cold
            message = "Cold weather affecting battery efficiency";
        } else if (temp > 95) {
            efficiency *= 0.85; // Heat (AC usage)
            message = "High heat increasing energy consumption";
        }

        // Weather condition impact (rolling resistance, air density)
        if (condition.includes('Rain') || condition.includes('Drizzle')) {
            efficiency *= 0.95;
        } else if (condition.includes('Snow')) {
            efficiency *= 0.90;
            message = message ? `${message} & Snow` : "Snow increasing rolling resistance";
        }

        return {
            efficiency,
            rangeLoss: Math.round((1 - efficiency) * 100),
            chargingSpeed: temp < 40 ? 0.8 : 1.0, // Cold batteries charge slower
            message
        };
    }
}

export const weatherService = WeatherService.getInstance();
