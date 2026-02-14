import type {
  GoogleMapsDirectionResponse,
  RouteData,
  Coordinate,
} from "../types/route.types";
import { dummyCrimes } from "../data/dummyCrimes";
import type { CrimeData } from "../data/dummyCrimes";
import {
  calculateRouteSafetyScore,
  generateRouteDescription,
} from "../utils/safetyScoring";

// Crime Statistics Interface
interface CrimeStatistics {
  total_crimes: number;
  day_crimes: number;
  night_crimes: number;
  crime_type_distribution: Record<string, number>;
  average_severity: number;
  high_severity_areas: CrimeData[];
  data_period: string;
  data_sources: string[];
}

// Backend API Response Interface
interface OSRMBackendResponse {
  distance: number;
  duration: number;
  geometry: Array<{ lat: number; lng: number }>;
  distance_text: string;
  duration_text: string;
  route_index: number;
}

// Location Suggestion Interface
export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  type: string;
  addresstype: string;
}

// Nominatim API Response Interface
interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name?: string;
  display_name: string;
  boundingbox: string[];
}

/**
 * Decode Google Maps polyline to array of coordinates
 * Implementation of the Encoded Polyline Algorithm
 */
export function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    // Decode longitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

/**
 * Geocode an address to coordinates using Nominatim (OpenStreetMap)
 * Prioritizes results from Bangladesh/Dhaka
 * @param address - Address string to geocode
 * @returns Coordinate object with lat/lng
 */
async function geocodeAddress(address: string): Promise<Coordinate> {
  // Add countrycodes parameter to prioritize Bangladesh
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}&countrycodes=bd&limit=5`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SafeRouteApp/1.0",
      },
    });
    const data: NominatimResult[] = await response.json();

    if (data.length === 0) {
      throw new Error(`Could not geocode address: ${address}`);
    }

    // Prioritize results that mention Dhaka in display_name
    const dhakaResult = data.find((result: NominatimResult) =>
      result.display_name.toLowerCase().includes("dhaka")
    );

    const bestResult = dhakaResult || data[0];

    return {
      lat: parseFloat(bestResult.lat),
      lng: parseFloat(bestResult.lon),
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error(`Failed to geocode address: ${address}`);
  }
}

/**
 * Fetch location suggestions for autocomplete
 * @param query - Search query string
 * @returns Array of location suggestions
 */
export async function fetchLocationSuggestions(
  query: string
): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Prioritize Bangladesh results and limit to 10
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&countrycodes=bd&limit=10&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SafeRouteApp/1.0",
      },
    });
    const data: NominatimResult[] = await response.json();

    return data.map((item: NominatimResult) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
      place_id: item.place_id,
      type: item.type,
      addresstype: item.addresstype,
    }));
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    return [];
  }
}

/**
 * Fetch route alternatives from OSRM backend API
 * @param origin - Starting location (address or "lat,lng")
 * @param destination - Ending location (address or "lat,lng")
 * @returns Array of routes with safety scores
 */
export async function fetchRouteAlternatives(
  origin: string,
  destination: string,
  travelTime: "Day" | "Night" = "Day"
): Promise<RouteData[]> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  try {
    // Fetch real crime data from API first
    console.log("Fetching real crime data from API...");
    const crimeData = await fetchCrimeData();
    console.log(`Loaded ${crimeData.length} crime records for safety calculation`);

    // Parse or geocode origin coordinates
    let originCoord: Coordinate;
    if (origin.includes(",")) {
      const [lat, lng] = origin.split(",").map((s) => parseFloat(s.trim()));
      originCoord = { lat, lng };
    } else {
      originCoord = await geocodeAddress(origin);
    }

    // Parse or geocode destination coordinates
    let destCoord: Coordinate;
    if (destination.includes(",")) {
      const [lat, lng] = destination.split(",").map((s) => parseFloat(s.trim()));
      destCoord = { lat, lng };
    } else {
      destCoord = await geocodeAddress(destination);
    }

    // Call backend API with coordinates
    const response = await fetch(`${backendUrl}/api/routes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_lat: originCoord.lat,
        source_lng: originCoord.lng,
        dest_lat: destCoord.lat,
        dest_lng: destCoord.lng,
        alternatives: 3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Backend API error: ${response.status}`
      );
    }

    const routes: OSRMBackendResponse[] = await response.json();

    // Process each route and add safety scoring using REAL crime data
    const processedRoutes: RouteData[] = routes.map((route, index) => {
      const coordinates = route.geometry;

      // Calculate safety score based on REAL crime data from API and user's travel time
      const safetyAnalysis = calculateRouteSafetyScore(
        coordinates,
        crimeData,
        0.5, // proximityThresholdKm
        travelTime // Pass user's travel time
      );

      // Generate description
      const description = generateRouteDescription(safetyAnalysis);

      return {
        id: index + 1,
        name: `Route ${index + 1}`,
        coordinates,
        distance: route.distance_text,
        duration: route.duration_text,
        distanceValue: route.distance,
        durationValue: route.duration,
        safety_score: safetyAnalysis.safety_score,
        risk_level: safetyAnalysis.risk_level,
        crimes_on_route: safetyAnalysis.crimes_near_route,
        description,
      };
    });

    // Sort routes by safety score (highest first) as primary criteria
    // If safety scores are close (within 10 points), prefer shorter duration
    processedRoutes.sort((a, b) => {
      const scoreDiff = b.safety_score - a.safety_score;
      if (Math.abs(scoreDiff) > 10) {
        return scoreDiff; // Prioritize safety if significant difference
      }
      return a.durationValue - b.durationValue; // Otherwise prefer faster route
    });

    return processedRoutes;
  } catch (error) {
    console.error("Error fetching routes from backend:", error);
    throw error;
  }
}

/**
 * Fetch route alternatives from Google Maps Direction API via backend proxy
 * @param origin - Starting location (address or "lat,lng")
 * @param destination - Ending location (address or "lat,lng")
 * @returns Array of routes with safety scores
 */
export async function fetchRouteAlternativesFromGoogleMaps(
  origin: string,
  destination: string,
  travelTime: "Day" | "Night" = "Day"
): Promise<RouteData[]> {
  // Use backend proxy to avoid CORS issues
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const url = `${backendUrl}/api/directions?origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&alternatives=true`;

  try {
    // Fetch real crime data from API first
    console.log("Fetching real crime data from API...");
    const crimeData = await fetchCrimeData();
    console.log(`Loaded ${crimeData.length} crime records for safety calculation`);

    const response = await fetch(url);
    const data: GoogleMapsDirectionResponse = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    // Process each route alternative
    const processedRoutes: RouteData[] = data.routes.map((route, index) => {
      const leg = route.legs[0]; // For single origin-destination, we use the first leg

      // Decode the overview polyline to get route coordinates
      const coordinates = decodePolyline(route.overview_polyline.points);

      // Calculate safety score based on REAL crime data from API and user's travel time
      const safetyAnalysis = calculateRouteSafetyScore(coordinates, crimeData, 0.5, travelTime);

      // Generate description
      const description = generateRouteDescription(safetyAnalysis);

      return {
        id: index + 1,
        name: route.summary || `Route ${index + 1}`,
        coordinates,
        distance: leg.distance.text,
        duration: leg.duration.text,
        distanceValue: leg.distance.value,
        durationValue: leg.duration.value,
        safety_score: safetyAnalysis.safety_score,
        risk_level: safetyAnalysis.risk_level,
        crimes_on_route: safetyAnalysis.crimes_near_route,
        description,
      };
    });

    // Sort routes by safety score (highest first) as primary criteria
    // If safety scores are close (within 10 points), prefer shorter duration
    processedRoutes.sort((a, b) => {
      const scoreDiff = b.safety_score - a.safety_score;
      if (Math.abs(scoreDiff) > 10) {
        return scoreDiff; // Prioritize safety if significant difference
      }
      return a.durationValue - b.durationValue; // Otherwise prefer faster route
    });

    return processedRoutes;
  } catch (error) {
    console.error("Error fetching routes from Google Maps:", error);
    throw error;
  }
}

/**
 * Fetch routes with a CORS proxy (useful for development)
 * In production, this should be handled by your backend
 */
export async function fetchRouteAlternativesWithProxy(
  origin: string,
  destination: string,
  apiKey: string,
  travelTime: "Day" | "Night" = "Day"
): Promise<RouteData[]> {
  // Using a CORS proxy for development
  const corsProxy = "https://cors-anywhere.herokuapp.com/";
  const url = `${corsProxy}https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${apiKey}`;

  try {
    // Fetch real crime data from API first
    console.log("Fetching real crime data from API...");
    const crimeData = await fetchCrimeData();
    console.log(`Loaded ${crimeData.length} crime records for safety calculation`);

    const response = await fetch(url);
    const data: GoogleMapsDirectionResponse = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    const processedRoutes: RouteData[] = data.routes.map((route, index) => {
      const leg = route.legs[0];
      const coordinates = decodePolyline(route.overview_polyline.points);
      const safetyAnalysis = calculateRouteSafetyScore(coordinates, crimeData, 0.5, travelTime);
      const description = generateRouteDescription(safetyAnalysis);

      return {
        id: index + 1,
        name: route.summary || `Route ${index + 1}`,
        coordinates,
        distance: leg.distance.text,
        duration: leg.duration.text,
        distanceValue: leg.distance.value,
        durationValue: leg.duration.value,
        safety_score: safetyAnalysis.safety_score,
        risk_level: safetyAnalysis.risk_level,
        crimes_on_route: safetyAnalysis.crimes_near_route,
        description,
      };
    });

    processedRoutes.sort((a, b) => {
      const scoreDiff = b.safety_score - a.safety_score;
      if (Math.abs(scoreDiff) > 10) {
        return scoreDiff;
      }
      return a.durationValue - b.durationValue;
    });

    return processedRoutes;
  } catch (error) {
    console.error("Error fetching routes with proxy:", error);
    throw error;
  }
}

/**
 * Fetch crime data from backend API
 * @returns Array of crime records
 */
export async function fetchCrimeData(): Promise<CrimeData[]> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  
  try {
    const response = await fetch(`${backendUrl}/api/crimes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch crime data: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    
    throw new Error("Invalid response format from crime API");
  } catch (error) {
    console.error("Error fetching crime data from API:", error);
    // Fallback to dummy data if API fails
    console.warn("Falling back to dummy crime data");
    return dummyCrimes;
  }
}

/**
 * Fetch crime statistics from backend API
 * @returns Crime statistics object
 */
export async function fetchCrimeStatistics(): Promise<CrimeStatistics> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  
  try {
    const response = await fetch(`${backendUrl}/api/crimes/statistics`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch crime statistics: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    
    throw new Error("Invalid response format from crime statistics API");
  } catch (error) {
    console.error("Error fetching crime statistics from API:", error);
    throw error;
  }
}

/**
 * Fetch crimes within a specific area
 * @param lat - Latitude of center point
 * @param lng - Longitude of center point
 * @param radius - Search radius in kilometers (default: 5km)
 * @returns Array of crime records within the specified radius
 */
export async function fetchCrimesByArea(
  lat: number,
  lng: number,
  radius: number = 5.0
): Promise<CrimeData[]> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  
  try {
    const response = await fetch(
      `${backendUrl}/api/crimes/area?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch area crime data: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data;
    }
    
    throw new Error("Invalid response format from area crime API");
  } catch (error) {
    console.error("Error fetching area crime data from API:", error);
    throw error;
  }
}

/**
 * Mock function for testing without API key
 * This simulates the API response for development
 */
export async function fetchRouteAlternativesMock(
  origin: string,
  destination: string
): Promise<RouteData[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Return mock routes similar to Google Maps
  // In real implementation, these would come from the API
  console.log(`Mock: Fetching routes from "${origin}" to "${destination}"`);

  // Use dummy routes as fallback with added fields
  const { dummyRoutes } = await import("../data/dummyRoutes");
  
  // Add missing fields to match RouteData interface
  return dummyRoutes.map(route => ({
    ...route,
    distanceValue: parseFloat(route.distance.replace(' km', '')) * 1000, // Convert to meters
    durationValue: parseInt(route.duration) * 60, // Convert to seconds
  }));
}
