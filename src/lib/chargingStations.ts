// OpenChargeMap API integration for dynamic charging station data
import { API_CONFIG } from '../config/api';

export interface OpenChargeStation {
  ID: number;
  UUID: string;
  AddressInfo: {
    ID: number;
    Title: string;
    AddressLine1: string;
    AddressLine2?: string;
    Town: string;
    StateOrProvince: string;
    Postcode: string;
    Country: {
      ID: number;
      ISOCode: string;
      Title: string;
    };
    Latitude: number;
    Longitude: number;
    Distance: number;
    DistanceUnit: number;
  };
  Connections: Array<{
    ID: number;
    ConnectionTypeID: number;
    ConnectionType: {
      ID: number;
      Title: string;
      FormalName: string;
    };
    Reference?: string;
    StatusTypeID: number;
    StatusType: {
      ID: number;
      Title: string;
      IsOperational: boolean;
    };
    LevelID: number;
    Level: {
      ID: number;
      Title: string;
      Comments: string;
      IsFastChargeCapable: boolean;
    };
    PowerKW: number;
    CurrentTypeID: number;
    CurrentType: {
      ID: number;
      Title: string;
      Description: string;
    };
    Quantity: number;
  }>;
  StatusType: {
    ID: number;
    Title: string;
    IsOperational: boolean;
  };
  DateLastStatusUpdate: string;
  DataQualityLevel: number;
  DateCreated: string;
  SubmissionStatusTypeID: number;
  SubmissionStatus: {
    ID: number;
    Title: string;
  };
  OperatorInfo?: {
    ID: number;
    Title: string;
    WebsiteURL?: string;
    Comments?: string;
    PhonePrimaryContact?: string;
    PhoneSecondaryContact?: string;
    IsPrivateIndividual: boolean;
    AddressInfo?: {
      ID: number;
      Title: string;
      AddressLine1: string;
      Town: string;
      StateOrProvince: string;
      Postcode: string;
      Country: {
        ID: number;
        ISOCode: string;
        Title: string;
      };
      Latitude: number;
      Longitude: number;
    };
  };
  UsageType?: {
    ID: number;
    Title: string;
    IsAccessKeyRequired: boolean;
    IsMembershipRequired: boolean;
    IsPayAtLocation: boolean;
  };
}

export interface ProcessedChargingStation {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  country: string;
  distance: number;
  powerKW: number;
  connectionType: string;
  network: string;
  isOperational: boolean;
  isFastCharge: boolean;
  quantity: number;
  status: string;
  operator?: string;
  website?: string;
  phone?: string;

  // Enhanced data
  availablePorts?: number;
  totalPorts: number;
  estimatedWaitTime?: number;
  lastUpdated?: string;
  pricing?: {
    perKWh: number;
    perMinute?: number;
    sessionFee?: number;
    currency: string;
  };
  amenities?: {
    restrooms: boolean;
    foodNearby: boolean;
    shopping: boolean;
    wifi: boolean;
    covered: boolean;
    security: boolean;
    lighting: boolean;
  };
  accessibility?: {
    wheelchairAccessible: boolean;
    disabledParking: boolean;
    audioAnnouncements: boolean;
  };
  reviews?: {
    averageRating: number;
    totalReviews: number;
    recentReviews: Array<{
      rating: number;
      comment: string;
      date: string;
      user: string;
    }>;
  };
  environmentalImpact?: {
    co2Saved: number;
    equivalentTrees: number;
    renewablePercentage: number;
  };
}

// OpenChargeMap API configuration
const OPENCHARGE_API_BASE = API_CONFIG.OPENCHARGE.BASE_URL;
const OPENCHARGE_API_KEY = API_CONFIG.OPENCHARGE.API_KEY;

export class ChargingStationService {
  private static instance: ChargingStationService;
  private cache = new Map<string, { data: ProcessedChargingStation[], timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): ChargingStationService {
    if (!ChargingStationService.instance) {
      ChargingStationService.instance = new ChargingStationService();
    }
    return ChargingStationService.instance;
  }

  private processStationData(station: OpenChargeStation): ProcessedChargingStation {
    const address = station.AddressInfo;
    const connections = station.Connections || [];

    // Find the highest power connection
    const maxPowerConnection = connections.reduce((max, conn) =>
      conn.PowerKW > max.PowerKW ? conn : max,
      connections[0] || { PowerKW: 0, ConnectionType: { Title: 'Unknown' }, Level: { IsFastChargeCapable: false }, Quantity: 1 }
    );

    // Calculate total ports
    const totalPorts = connections.reduce((sum, conn) => sum + (conn.Quantity || 1), 0);

    // Generate enhanced data (simulated for demo purposes)
    const availablePorts = Math.floor(Math.random() * (totalPorts + 1));
    const estimatedWaitTime = availablePorts === 0 ? Math.floor(Math.random() * 30) + 5 : 0;

    // Generate pricing data (simulated)
    const pricing = {
      perKWh: Math.round((Math.random() * 0.3 + 0.1) * 100) / 100, // $0.10 - $0.40 per kWh
      perMinute: maxPowerConnection.PowerKW > 50 ? Math.round((Math.random() * 0.5 + 0.1) * 100) / 100 : undefined,
      sessionFee: Math.random() > 0.7 ? Math.round((Math.random() * 5 + 1) * 100) / 100 : 0,
      currency: 'USD'
    };

    // Generate amenities data (simulated)
    const amenities = {
      restrooms: Math.random() > 0.3,
      foodNearby: Math.random() > 0.4,
      shopping: Math.random() > 0.6,
      wifi: Math.random() > 0.5,
      covered: Math.random() > 0.7,
      security: Math.random() > 0.6,
      lighting: Math.random() > 0.2
    };

    // Generate accessibility data (simulated)
    const accessibility = {
      wheelchairAccessible: Math.random() > 0.4,
      disabledParking: Math.random() > 0.5,
      audioAnnouncements: Math.random() > 0.8
    };

    // Generate reviews data (simulated)
    const averageRating = Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0 - 5.0
    const totalReviews = Math.floor(Math.random() * 50) + 5;
    const reviews = {
      averageRating,
      totalReviews,
      recentReviews: Array.from({ length: Math.min(3, totalReviews) }, (_, i) => ({
        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        comment: ['Great station!', 'Fast charging', 'Clean and safe', 'Good location', 'Easy to find'][Math.floor(Math.random() * 5)],
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user: `User${i + 1}`
      }))
    };

    // Calculate environmental impact
    const co2Saved = Math.round((Math.random() * 50 + 20) * 100) / 100; // 20-70 kg CO2 saved
    const environmentalImpact = {
      co2Saved,
      equivalentTrees: Math.round(co2Saved / 22), // 1 tree absorbs ~22 kg CO2/year
      renewablePercentage: Math.round(Math.random() * 40 + 30) // 30-70% renewable
    };

    return {
      id: station.ID,
      title: address.Title || 'Charging Station',
      latitude: address.Latitude,
      longitude: address.Longitude,
      address: [address.AddressLine1, address.AddressLine2, address.Town, address.StateOrProvince, address.Postcode]
        .filter(Boolean)
        .join(', '),
      city: address.Town || '',
      state: address.StateOrProvince || '',
      country: address.Country.Title || '',
      distance: address.Distance || 0,
      powerKW: maxPowerConnection.PowerKW || 0,
      connectionType: maxPowerConnection.ConnectionType?.Title || 'Unknown',
      network: station.OperatorInfo?.Title || 'Unknown',
      isOperational: station.StatusType?.IsOperational || false,
      isFastCharge: maxPowerConnection.Level?.IsFastChargeCapable || false,
      quantity: maxPowerConnection.Quantity || 1,
      status: station.StatusType?.Title || 'Unknown',
      operator: station.OperatorInfo?.Title,
      website: station.OperatorInfo?.WebsiteURL,
      phone: station.OperatorInfo?.PhonePrimaryContact,

      // Enhanced data
      availablePorts,
      totalPorts,
      estimatedWaitTime: estimatedWaitTime > 0 ? estimatedWaitTime : undefined,
      lastUpdated: new Date().toISOString(),
      pricing,
      amenities,
      accessibility,
      reviews,
      environmentalImpact
    };
  }

  async getChargingStations(
    latitude: number,
    longitude: number,
    radius: number = 10,
    maxResults: number = 50,
    preferredAmenities: string[] = []
  ): Promise<ProcessedChargingStation[]> {
    const cacheKey = `${latitude},${longitude},${radius}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const baseUrl = OPENCHARGE_API_BASE.startsWith('http')
        ? OPENCHARGE_API_BASE
        : `${window.location.origin}${OPENCHARGE_API_BASE}`;
      const url = new URL(`${baseUrl}/poi/`);
      url.searchParams.set('output', 'json');
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
      url.searchParams.set('distance', radius.toString());
      url.searchParams.set('distanceunit', 'Miles');
      url.searchParams.set('maxresults', maxResults.toString());
      url.searchParams.set('key', OPENCHARGE_API_KEY);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`OpenChargeMap API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenChargeStation[] = await response.json();

      // Process and filter the data
      const processedStations = data
        .map(station => this.processStationData(station))
        .filter(station => {
          if (!station.isOperational) return false;
          if (preferredAmenities.length === 0) return true;

          // Check if station has at least one of the preferred amenities
          return preferredAmenities.some(amenity => {
            const a = station.amenities as any;
            if (amenity === 'restrooms') return a?.restrooms;
            if (amenity === 'food') return a?.foodNearby;
            if (amenity === 'shopping') return a?.shopping;
            if (amenity === 'wifi') return a?.wifi;
            return true;
          });
        })
        .sort((a, b) => a.distance - b.distance); // Sort by distance

      // Cache the results
      this.cache.set(cacheKey, {
        data: processedStations,
        timestamp: Date.now()
      });

      return processedStations;
    } catch (error) {
      console.error('Error fetching charging stations:', error);

      // Return empty array on error, but don't cache the error
      return [];
    }
  }

  async getChargingStationsAlongRoute(
    routeGeometry: [number, number][],
    radius: number = 6.2, // 10km in miles
    preferredAmenities: string[] = []
  ): Promise<ProcessedChargingStation[]> {
    if (!routeGeometry || routeGeometry.length === 0) {
      return [];
    }

    try {
      // Sample points along the route (every 10th point or at least 5 points)
      const samplePoints = routeGeometry.filter((_, index) =>
        index % Math.max(1, Math.floor(routeGeometry.length / 5)) === 0
      );

      const allStations = new Map<number, ProcessedChargingStation>();

      // Fetch stations for each sample point
      for (const [lat, lng] of samplePoints) {
        const stations = await this.getChargingStations(lat, lng, radius, 20, preferredAmenities);
        stations.forEach(station => {
          allStations.set(station.id, station);
        });
      }

      return Array.from(allStations.values())
        .sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Error fetching charging stations along route:', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const chargingStationService = ChargingStationService.getInstance();
