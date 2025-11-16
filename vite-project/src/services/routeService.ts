import type {
  GoogleMapsDirectionResponse,
  RouteData,
  Coordinate,
} from "../types/route.types";
import { dummyCrimes } from "../data/dummyCrimes";
import {
  calculateRouteSafetyScore,
  generateRouteDescription,
} from "../utils/safetyScoring";

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
 * Fetch route alternatives from Google Maps Direction API
 * @param origin - Starting location (address or "lat,lng")
 * @param destination - Ending location (address or "lat,lng")
 * @param apiKey - Google Maps API key
 * @returns Array of routes with safety scores
 */
export async function fetchRouteAlternatives(
  origin: string,
  destination: string,
  apiKey: string
): Promise<RouteData[]> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${apiKey}`;

  try {
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

      // Calculate safety score based on crime data
      const safetyAnalysis = calculateRouteSafetyScore(coordinates, dummyCrimes);

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
  apiKey: string
): Promise<RouteData[]> {
  // Using a CORS proxy for development
  const corsProxy = "https://cors-anywhere.herokuapp.com/";
  const url = `${corsProxy}https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data: GoogleMapsDirectionResponse = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Google Maps API error: ${data.status}`);
    }

    const processedRoutes: RouteData[] = data.routes.map((route, index) => {
      const leg = route.legs[0];
      const coordinates = decodePolyline(route.overview_polyline.points);
      const safetyAnalysis = calculateRouteSafetyScore(coordinates, dummyCrimes);
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
