export interface AIRecommendation {
  summary: string;
  recommendedRouteId: string;
  confidence: number;
  reasons: string[];
  chargingPlan: Array<{ stop: string; minutes: number }>; // simple, UI-friendly
  risks: string[];
}

type LatLng = [number, number];

export interface AnalyzeInput {
  origin: string;
  destination: string;
  originCoords?: LatLng;
  destinationCoords?: LatLng;
  startingBattery: number;
  evModel: {
    manufacturer: string;
    model_name: string;
    battery_capacity_kwh: number;
    efficiency_kwh_per_mile: number;
    range_miles: number;
  };
  routes: Array<{
    id: string;
    name: string;
    distance: number;
    duration: number;
    batteryUsage: number;
    chargingStops: number;
    energyEfficiency: number;
    estimatedCost: number;
  }>;
}

export interface AIPredictions {
  batteryDegradationRisk: 'low' | 'medium' | 'high';
  optimalChargingWindows: Array<{ start: string; end: string; reason: string }>;
  weatherImpact: { rangeDeltaPercent: number; notes: string[] };
}

export interface SOCChargingStop {
  stopNumber: number;
  location: string;
  targetSOC: number;
  chargingSpeed: number; // kW
  dwellTime: number; // minutes
  cost: number;
  reason: string;
}

export interface SOCOptimization {
  totalTripTime: number; // minutes
  totalChargingTime: number; // minutes
  chargingStops: SOCChargingStop[];
  strategy: 'minimize_time' | 'minimize_cost' | 'balanced';
  savings: {
    timeSaved: number; // minutes vs naive charging
    costSaved: number; // dollars
  };
}

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number; // meters
  distance: number; // miles from start
}

export interface WindCondition {
  speed: number; // mph
  direction: number; // degrees
  gust: number; // mph
}


export interface ElevationWindImpact {
  elevationGain: number; // meters
  elevationLoss: number; // meters
  netElevationChange: number; // meters
  windImpact: {
    headwind: number; // mph
    tailwind: number; // mph
    crosswind: number; // mph
  };
  rangeImpact: {
    elevationDelta: number; // percentage
    windDelta: number; // percentage
    combinedDelta: number; // percentage
  };
  recommendations: string[];
}

function buildPrompt(input: AnalyzeInput): string {
  const header = `You are analyzing EV trip routes. Pick the best route and explain why.`
  const ev = `${input.evModel.manufacturer} ${input.evModel.model_name}, range ${input.evModel.range_miles} mi, efficiency ${input.evModel.efficiency_kwh_per_mile} kWh/mi`;
  const routes = input.routes.map(r => `- ${r.id} ${r.name}: ${r.distance} mi, ${r.duration} min, battery ${r.batteryUsage}%, stops ${r.chargingStops}, cost $${r.estimatedCost}`).join("\n");
  const body = `From ${input.origin} to ${input.destination}. Starting battery ${input.startingBattery}%. EV: ${ev}. Routes:\n${routes}\nReturn JSON with keys: summary, recommendedRouteId, confidence (0-100), reasons (array), chargingPlan (array of {stop, minutes}), risks (array).`;
  return `${header}\n${body}`;
}

async function callGemini(prompt: string): Promise<AIRecommendation | null> {
  const apiKey = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
          responseMimeType: "application/json"
        },
      })
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const text = typeof data === 'object' && data !== null
      ? (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        .candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;
    if (!text) return null;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const jsonSlice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(jsonSlice) as Partial<AIRecommendation> & {
      recommendedRouteId?: string;
      reasons?: unknown[];
      chargingPlan?: Array<{ stop?: unknown; minutes?: unknown }>;
      risks?: unknown[];
      confidence?: unknown;
      summary?: unknown;
    };
    return {
      summary: String(parsed.summary || ''),
      recommendedRouteId: String(parsed.recommendedRouteId || ''),
      confidence: Number(parsed.confidence ?? 75),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((r) => String(r)) : [],
      chargingPlan: Array.isArray(parsed.chargingPlan) ? parsed.chargingPlan.map((p) => ({ stop: String(p?.stop || ''), minutes: Number(p?.minutes || 0) })) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map((r) => String(r)) : [],
    };
  } catch {
    return null;
  }
}

function localHeuristic(input: AnalyzeInput): AIRecommendation {
  const best = input.routes.reduce((a, b) => (a.energyEfficiency <= b.energyEfficiency ? a : b));
  const fastest = input.routes.reduce((a, b) => (a.duration <= b.duration ? a : b));
  const recommended = best.duration - fastest.duration > 20 ? fastest : best;
  const reasons = [
    `Energy efficiency ${recommended.energyEfficiency} kWh/mi`,
    `Duration ${recommended.duration} min`,
    `Estimated cost $${recommended.estimatedCost}`,
  ];
  const risks = [] as string[];
  if (recommended.batteryUsage > input.startingBattery) risks.push('Requires at least one charging stop');
  if (recommended.duration - fastest.duration > 15) risks.push('Significantly slower than the fastest route');
  const chargingPlan = recommended.chargingStops > 0 ? [{ stop: 'Mid-route fast charger', minutes: 25 * recommended.chargingStops }] : [];
  return {
    summary: `Recommended ${recommended.name} balancing time and efficiency`,
    recommendedRouteId: recommended.id,
    confidence: 80,
    reasons,
    chargingPlan,
    risks,
  };
}

export async function analyzeTrip(input: AnalyzeInput): Promise<AIRecommendation> {
  const prompt = buildPrompt(input);
  const gemini = await callGemini(prompt);
  if (gemini && gemini.recommendedRouteId) return gemini;
  return localHeuristic(input);
}

function buildPredictionsPrompt(params: {
  startingBattery: number;
  evModel: AnalyzeInput['evModel'];
  route: { distance: number; duration: number };
  weather: Array<{ point: 'start' | 'midpoint' | 'end'; tempF: number; condition: string }>;
}): string {
  const { startingBattery, evModel, route, weather } = params;
  const weatherText = weather.map(w => `${w.point}: ${w.tempF}F, ${w.condition}`).join("; ");
  return [
    'Analyze EV trip risks and recommendations. Return JSON with keys: ',
    'batteryDegradationRisk (low|medium|high), ',
    'optimalChargingWindows (array of {start, end, reason}), ',
    'weatherImpact ({rangeDeltaPercent, notes}).',
    `EV: ${evModel.manufacturer} ${evModel.model_name}, range ${evModel.range_miles}mi, eff ${evModel.efficiency_kwh_per_mile}kWh/mi, battery ${evModel.battery_capacity_kwh}kWh.`,
    `Trip: distance ${route.distance}mi, duration ${route.duration}min, startingBattery ${startingBattery}%.`,
    `Weather: ${weatherText}.`,
    'Assume typical U.S. TOU: off-peak 10pm-6am; prefer windows that minimize cost and degradation.'
  ].join('\n');
}

function localPredictions(params: {
  startingBattery: number;
  evModel: AnalyzeInput['evModel'];
  route: { distance: number; duration: number };
  weather: Array<{ point: 'start' | 'midpoint' | 'end'; tempF: number; condition: string }>;
}): AIPredictions {
  const temps = params.weather.map(w => w.tempF);
  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 70;
  let rangeDeltaPercent = 0;
  if (avgTemp < 40) rangeDeltaPercent = -15;
  else if (avgTemp < 55) rangeDeltaPercent = -8;
  else if (avgTemp > 95) rangeDeltaPercent = -10;
  else if (avgTemp > 85) rangeDeltaPercent = -6;

  const batteryDegradationRisk: AIPredictions['batteryDegradationRisk'] = params.startingBattery > 90 ? 'medium' : 'low';

  const optimalChargingWindows = [
    { start: '22:00', end: '06:00', reason: 'Off-peak rates and reduced battery stress' },
  ];

  const notes: string[] = [];
  if (rangeDeltaPercent < 0) notes.push('Expect reduced range due to temperature');
  if (params.weather.some(w => /rain|snow|storm|wind/i.test(w.condition))) notes.push('Adverse weather can increase consumption');

  return { batteryDegradationRisk, optimalChargingWindows, weatherImpact: { rangeDeltaPercent, notes } };
}

export async function analyzePredictions(params: {
  startingBattery: number;
  evModel: AnalyzeInput['evModel'];
  route: { distance: number; duration: number };
  weather: Array<{ point: 'start' | 'midpoint' | 'end'; tempF: number; condition: string }>;
}): Promise<AIPredictions> {
  const prompt = buildPredictionsPrompt(params);
  const apiKey = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (apiKey) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400,
            responseMimeType: "application/json"
          }
        })
      });
      if (res.ok) {
        const data: unknown = await res.json();
        const text = typeof data === 'object' && data !== null
          ? (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
            .candidates?.[0]?.content?.parts?.[0]?.text
          : undefined;
        if (text) {
          const jsonStart = text.indexOf('{');
          const jsonEnd = text.lastIndexOf('}');
          const jsonSlice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
          const parsed = JSON.parse(jsonSlice) as {
            batteryDegradationRisk?: 'low' | 'medium' | 'high';
            optimalChargingWindows?: Array<{ start?: unknown; end?: unknown; reason?: unknown }>;
            weatherImpact?: { rangeDeltaPercent?: unknown; notes?: unknown[] };
          };
          const out: AIPredictions = {
            batteryDegradationRisk: (parsed.batteryDegradationRisk || 'medium') as AIPredictions['batteryDegradationRisk'],
            optimalChargingWindows: Array.isArray(parsed.optimalChargingWindows) ? parsed.optimalChargingWindows.map((w) => ({ start: String(w?.start || ''), end: String(w?.end || ''), reason: String(w?.reason || '') })) : [],
            weatherImpact: {
              rangeDeltaPercent: Number(parsed.weatherImpact?.rangeDeltaPercent ?? 0),
              notes: Array.isArray(parsed.weatherImpact?.notes) ? parsed.weatherImpact.notes.map((n) => String(n as unknown as string)) : []
            }
          };
          return out;
        }
      }
    } catch {
      // fall through to local
    }
  }
  return localPredictions(params);
}

function calculateSOCOptimization(params: {
  distance: number;
  startingBattery: number;
  evModel: AnalyzeInput['evModel'];
  chargingStations: Array<{ name: string; powerKW: number; costPerKWh: number; distanceFromRoute: number }>;
  strategy: 'minimize_time' | 'minimize_cost' | 'balanced';
}): SOCOptimization {
  const { distance, startingBattery, evModel, chargingStations, strategy } = params;
  const batteryCapacity = evModel.battery_capacity_kwh;
  const efficiency = evModel.efficiency_kwh_per_mile;
  // const range = evModel.range_miles; // For future use

  // Calculate energy needed for trip
  const energyNeeded = distance * efficiency;
  const batteryNeeded = (energyNeeded / batteryCapacity) * 100;

  // Determine if charging is needed
  const needsCharging = batteryNeeded > startingBattery - 10; // 10% safety buffer

  if (!needsCharging) {
    return {
      totalTripTime: (distance / 60) * 60, // Assume 60 mph average
      totalChargingTime: 0,
      chargingStops: [],
      strategy,
      savings: { timeSaved: 0, costSaved: 0 }
    };
  }

  // Calculate optimal charging strategy
  const chargingStops: SOCChargingStop[] = [];
  let currentBattery = startingBattery;
  let totalChargingTime = 0;
  let totalCost = 0;
  let stopNumber = 1;

  // Find best charging stations along route
  const sortedStations = chargingStations
    .filter(s => s.powerKW >= 50) // Minimum 50kW
    .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)
    .slice(0, 3); // Max 3 stops

  for (const station of sortedStations) {
    const distanceToStation = station.distanceFromRoute;
    const energyToStation = distanceToStation * efficiency;
    const batteryToStation = (energyToStation / batteryCapacity) * 100;

    if (currentBattery - batteryToStation < 20) { // Need to charge
      // Calculate optimal target SOC
      let targetSOC: number;
      if (strategy === 'minimize_time') {
        targetSOC = Math.min(80, currentBattery + 30); // Fast charging to 80%
      } else if (strategy === 'minimize_cost') {
        targetSOC = Math.min(90, currentBattery + 40); // More charging for efficiency
      } else { // balanced
        targetSOC = Math.min(85, currentBattery + 35);
      }

      const energyToAdd = ((targetSOC - currentBattery) / 100) * batteryCapacity;
      const chargingSpeed = Math.min(station.powerKW, 150); // Cap at 150kW
      const dwellTime = Math.ceil((energyToAdd / chargingSpeed) * 60); // minutes

      const cost = energyToAdd * station.costPerKWh;

      chargingStops.push({
        stopNumber,
        location: station.name,
        targetSOC,
        chargingSpeed,
        dwellTime,
        cost,
        reason: strategy === 'minimize_time' ? 'Fast charging for time efficiency' :
          strategy === 'minimize_cost' ? 'Optimal charging for cost efficiency' :
            'Balanced charging strategy'
      });

      currentBattery = targetSOC;
      totalChargingTime += dwellTime;
      totalCost += cost;
      stopNumber++;
    }
  }

  // Calculate total trip time
  const drivingTime = (distance / 60) * 60; // Assume 60 mph
  const totalTripTime = drivingTime + totalChargingTime;

  // Calculate savings vs naive charging (charge to 100% at each stop)
  const naiveChargingTime = chargingStops.reduce((sum, stop) => {
    const energyToAdd = ((100 - stop.targetSOC) / 100) * batteryCapacity;
    return sum + Math.ceil((energyToAdd / stop.chargingSpeed) * 60);
  }, 0);

  const timeSaved = Math.max(0, naiveChargingTime - totalChargingTime);
  const costSaved = Math.max(0, totalCost * 0.1); // Assume 10% savings

  return {
    totalTripTime,
    totalChargingTime,
    chargingStops,
    strategy,
    savings: { timeSaved, costSaved }
  };
}

export async function optimizeSOCCharging(params: {
  distance: number;
  startingBattery: number;
  evModel: AnalyzeInput['evModel'];
  chargingStations: Array<{ name: string; powerKW: number; costPerKWh: number; distanceFromRoute: number }>;
  strategy?: 'minimize_time' | 'minimize_cost' | 'balanced';
}): Promise<SOCOptimization> {
  const strategy = params.strategy || 'balanced';

  // For now, use local optimization
  // In the future, this could call Gemini for more sophisticated analysis
  return calculateSOCOptimization({
    ...params,
    strategy
  });
}

function calculateElevationWindImpact(params: {
  route: { distance: number; originCoords: [number, number]; destinationCoords: [number, number] };
  elevationPoints: ElevationPoint[];
  windConditions: WindCondition[];
}): ElevationWindImpact {
  const { elevationPoints, windConditions } = params;

  // Calculate elevation changes
  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 1; i < elevationPoints.length; i++) {
    const prev = elevationPoints[i - 1];
    const curr = elevationPoints[i];
    const change = curr.elevation - prev.elevation;

    if (change > 0) {
      elevationGain += change;
    } else {
      elevationLoss += Math.abs(change);
    }
  }

  const netElevationChange = elevationGain - elevationLoss;

  // Calculate wind impact
  const avgWindSpeed = windConditions.reduce((sum, w) => sum + w.speed, 0) / windConditions.length;
  const avgWindDirection = windConditions.reduce((sum, w) => sum + w.direction, 0) / windConditions.length;

  // Simplified wind calculation (in real app, would use route bearing)
  const headwind = Math.max(0, avgWindSpeed * Math.cos((avgWindDirection - 180) * Math.PI / 180));
  const tailwind = Math.max(0, avgWindSpeed * Math.cos(avgWindDirection * Math.PI / 180));
  const crosswind = Math.abs(avgWindSpeed * Math.sin(avgWindDirection * Math.PI / 180));

  // Calculate range impact
  const elevationDelta = (netElevationChange / 1000) * 2; // 2% per 1000m elevation gain
  const windDelta = (headwind - tailwind) * 0.5; // 0.5% per mph net headwind
  const combinedDelta = elevationDelta + windDelta;

  // Generate recommendations
  const recommendations: string[] = [];

  if (elevationGain > 500) {
    recommendations.push(`Expect 15-25% range reduction due to ${Math.round(elevationGain)}m elevation gain`);
  }

  if (headwind > 10) {
    recommendations.push(`Strong headwind (${Math.round(headwind)} mph) will reduce range by 5-10%`);
  }

  if (tailwind > 10) {
    recommendations.push(`Tailwind (${Math.round(tailwind)} mph) will improve range by 3-7%`);
  }

  if (crosswind > 15) {
    recommendations.push(`Crosswind (${Math.round(crosswind)} mph) may affect stability`);
  }

  if (Math.abs(netElevationChange) < 100) {
    recommendations.push("Route is relatively flat - minimal elevation impact");
  }

  return {
    elevationGain,
    elevationLoss,
    netElevationChange,
    windImpact: { headwind, tailwind, crosswind },
    rangeImpact: { elevationDelta, windDelta, combinedDelta },
    recommendations
  };
}

export async function analyzeElevationWindImpact(params: {
  route: { distance: number; originCoords: [number, number]; destinationCoords: [number, number] };
  elevationPoints: ElevationPoint[];
  windConditions: WindCondition[];
}): Promise<ElevationWindImpact> {
  // For now, use local calculation
  // In the future, this could integrate with elevation APIs and weather services
  return calculateElevationWindImpact(params);
}



export interface TripMetrics {
  efficiencyScore: number;
  co2Saved: number;
  equivalentTrees: number;
  fuelCostSaved: number;
}

export function calculateTripMetrics(
  route: { distance: number; energyEfficiency: number },
  evModel: AnalyzeInput['evModel']
): TripMetrics {
  // Deterministic calculations based on inputs

  // CO2 Savings: Avg gas car emits ~404g/mile. EV emissions depend on grid, but we assume ~0 tailpipe.
  // We'll use a standard factor: 0.404 kg/mile savings.
  const co2Saved = Number((route.distance * 0.404).toFixed(1));

  // Trees: A mature tree absorbs ~22kg of CO2 per year.
  // This is a "trip equivalent" - how many trees would it take to absorb the CO2 *saved*?
  // Or more commonly, how many trees does this saving represent in annual terms?
  // Let's use: Savings / 20kg per tree.
  const equivalentTrees = Math.max(1, Math.round(co2Saved / 20));

  // Fuel Cost Savings:
  // Gas: 25 mpg @ .50/gal -> /bin/zsh.14/mile
  // EV: 3.5 miles/kWh @ /bin/zsh.15/kWh -> /bin/zsh.04/mile
  // Use model efficiency if available, otherwise heuristic.
  const gasCost = route.distance * 0.14;
  const evCost = route.distance * (evModel.efficiency_kwh_per_mile * 0.15); // Assume /bin/zsh.15/kWh
  const fuelCostSaved = Number(Math.max(0, gasCost - evCost).toFixed(2));

  // Efficiency Score:
  // 100 is "perfect" (rated efficiency). Lower if route efficiency < rated efficiency.
  // Example: Route efficiency 0.3 kWh/mi, Rated 0.25 kWh/mi -> (0.25/0.3) * 100 = 83
  const efficiencyRatio = evModel.efficiency_kwh_per_mile / (route.energyEfficiency || evModel.efficiency_kwh_per_mile);
  // Cap at 100, min 40.
  const efficiencyScore = Math.min(100, Math.max(40, Math.round(efficiencyRatio * 100)));

  return {
    efficiencyScore,
    co2Saved,
    equivalentTrees,
    fuelCostSaved
  };
}

export interface ParsedTripCommand {
  origin?: string;
  destination?: string;
  batteryPercent?: number;
  preferences: string[];
  confidence: number;
}

export async function parseTripCommand(text: string): Promise<ParsedTripCommand | null> {
  const apiKey = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const prompt = `
    Extract EV trip parameters from this command: "${text}".
    Return JSON with keys:
    - origin (string, infer from context or null)
    - destination (string, infer from context or null)
    - batteryPercent (number, if mentioned, default null)
    - preferences (array of strings, e.g. "avoid tolls", "fastest", "scenic")
    - confidence (number 0-100)
    Only return valid JSON. Do not include markdown code blocks.
  `;

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!res.ok) return null;
    const data: unknown = await res.json();
    const resultText = typeof data === 'object' && data !== null
      ? (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        .candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;

    if (!resultText) return null;

    // Clean markdown code blocks if present
    const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText) as ParsedTripCommand;
  } catch {
    console.error("AI Parse Error");
    return null;
  }
}

export async function generateStopDescription(stationName: string, amenities: string[]): Promise<string> {
  const apiKey = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return "A convenient charging stop with nearby amenities.";

  const prompt = `
    Write a short, inviting 1-sentence "pitch" for an EV charging stop at "${stationName}".
    Amenities available: ${amenities.join(', ')}.
    Make it sound like a nice break. Max 20 words.
  `;

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 60,
        }
      })
    });

    if (!res.ok) return "Recharge your vehicle and yourself at this convenient location.";
    const data: unknown = await res.json();
    const text = typeof data === 'object' && data !== null
      ? (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        .candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;

    return text?.trim() || "Enjoy a quick break while your vehicle charges.";
  } catch {
    return "A great spot to stretch your legs while charging.";
  }
}
