import type { Coordinate } from "../types/route.types";
import type { CrimeData } from "../data/dummyCrimes";
import type { SafetyAnalysis } from "../types/route.types";
import type { SafetyPreferences } from "../types/preferences.types";
import { getCrimeCategory, getRiskToleranceMultiplier } from "../types/preferences.types";

/**
 * Crime Type Weight Mapping
 * Higher weight = more dangerous crime type = lower safety score
 * 
 * Classification:
 * - Violent crimes (Physical harm): 1.5 - 2.0x
 * - Property crimes with violence risk: 1.2 - 1.5x
 * - Property crimes (Non-violent): 1.0x
 * - Minor crimes: 0.7 - 0.9x
 */
export const CRIME_TYPE_WEIGHTS: { [key: string]: number } = {
  // Violent Crimes (Highest Risk)
  "Murder": 2.0,
  "Assault": 1.8,
  "Robbery": 1.7,        // Armed robbery with violence
  "Mugging": 1.6,        // Street robbery
  "Rape": 2.0,
  "Kidnapping": 1.9,
  
  // Drug-Related (High Risk - unpredictable violence)
  "Drug Trafficking": 1.5,
  "Drug Abuse": 1.3,
  
  // Property Crimes with Violence Risk (Medium-High)
  "Burglary": 1.4,       // Breaking and entering
  "Carjacking": 1.6,
  
  // Property Crimes (Medium Risk)
  "Theft": 1.0,
  "Vehicle Theft": 1.2,
  "Shoplifting": 0.8,
  
  // Minor Crimes (Lower Risk)
  "Pickpocketing": 0.9,
  "Vandalism": 0.7,
  "Fraud": 0.7,
  "Cybercrime": 0.5,     // No physical danger
  
  // Traffic-Related
  "Hit and Run": 1.3,
  
  // Default for unknown crime types
  "Other": 1.0,
};

/**
 * Get crime type weight with fallback to default
 */
export function getCrimeTypeWeight(crimeType: string): number {
  return CRIME_TYPE_WEIGHTS[crimeType] || CRIME_TYPE_WEIGHTS["Other"];
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate the minimum distance from a point to a line segment
 */
export function distanceToLineSegment(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  const A = point.lat - lineStart.lat;
  const B = point.lng - lineStart.lng;
  const C = lineEnd.lat - lineStart.lat;
  const D = lineEnd.lng - lineStart.lng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.lat;
    yy = lineStart.lng;
  } else if (param > 1) {
    xx = lineEnd.lat;
    yy = lineEnd.lng;
  } else {
    xx = lineStart.lat + param * C;
    yy = lineStart.lng + param * D;
  }

  return calculateDistance(point.lat, point.lng, xx, yy);
}

/**
 * Calculate the minimum distance from a crime point to any segment of the route
 */
export function minDistanceToRoute(
  crime: Coordinate,
  routeCoordinates: Coordinate[]
): number {
  let minDistance = Infinity;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const distance = distanceToLineSegment(
      crime,
      routeCoordinates[i],
      routeCoordinates[i + 1]
    );
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Calculate safety score for a route based on nearby crimes
 * @param routeCoordinates - Array of coordinates that make up the route
 * @param crimeData - Array of crime data points
 * @param proximityThresholdKm - Distance threshold in km to consider a crime "near" the route
 * @param travelTime - User's travel time (Day/Night)
 * @param preferences - User's safety preferences for personalized scoring
 * @returns SafetyAnalysis object with score and details
 */
export function calculateRouteSafetyScore(
  routeCoordinates: Coordinate[],
  crimeData: CrimeData[],
  proximityThresholdKm: number = 0.5, // 500 meters default
  travelTime: "Day" | "Night" = "Day", // User's travel time
  preferences?: SafetyPreferences // User's personalized preferences
): SafetyAnalysis {
  let totalRiskScore = 0;
  let crimesNearRoute = 0;
  const highRiskSegments: Array<{
    lat: number;
    lng: number;
    crime_count: number;
  }> = [];

  // Get risk tolerance multiplier (affects all crimes)
  const riskToleranceMultiplier = preferences 
    ? getRiskToleranceMultiplier(preferences.riskTolerance)
    : 1.0;

  // Track crimes near each route segment
  const segmentCrimeCount = new Map<number, number>();

  // Analyze each crime point
  crimeData.forEach((crime) => {
    const distanceToRoute = minDistanceToRoute(
      { lat: crime.lat, lng: crime.lng },
      routeCoordinates
    );

    // If crime is within proximity threshold
    if (distanceToRoute <= proximityThresholdKm) {
      crimesNearRoute++;

      // Calculate risk contribution based on:
      // 1. Distance from route (closer = higher risk)
      // 2. Crime severity score (1-10 scale)
      // 3. Time of day - DYNAMIC based on user's travel time
      //    - If crime happened during user's travel time: 2.0x weight (higher risk)
      //    - If crime happened at different time: 0.5x weight (lower risk)
      // 4. Crime type weight - Different crime types have different risk levels
      //    - Violent crimes: 1.5-2.0x (Murder, Assault, Robbery)
      //    - Property crimes: 1.0-1.4x (Theft, Burglary)
      //    - Minor crimes: 0.7-0.9x (Pickpocketing, Vandalism)
      // 5. User's crime category concern (if preferences provided)
      //    - Higher concern = higher weight for that category
      // 6. Risk tolerance (overall multiplier affecting all crimes)
      const distanceFactor = 1 - distanceToRoute / proximityThresholdKm; // 1 to 0
      const severityFactor = crime.severity_score / 10; // 0 to 1
      const timeFactor = crime.time_of_day === travelTime ? 2.0 : 0.5; // Match travel time = higher risk
      const crimeTypeWeight = getCrimeTypeWeight(crime.crime_type); // Different crime types weighted differently
      
      // Apply user's crime category concern if preferences exist
      let userConcernMultiplier = 1.0;
      if (preferences) {
        const category = getCrimeCategory(crime.crime_type);
        if (category) {
          userConcernMultiplier = preferences.crimeTypeConcerns[category];
        }
      }

      const riskContribution = 
        distanceFactor * 
        severityFactor * 
        timeFactor * 
        crimeTypeWeight * 
        userConcernMultiplier * // User's personal concern for this crime category
        riskToleranceMultiplier * // Overall risk tolerance
        10;
      
      totalRiskScore += riskContribution;

      // Find closest route segment to mark as high risk
      let closestSegmentIndex = 0;
      let minSegmentDistance = Infinity;

      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const distance = distanceToLineSegment(
          { lat: crime.lat, lng: crime.lng },
          routeCoordinates[i],
          routeCoordinates[i + 1]
        );
        if (distance < minSegmentDistance) {
          minSegmentDistance = distance;
          closestSegmentIndex = i;
        }
      }

      // Track crimes per segment
      const currentCount = segmentCrimeCount.get(closestSegmentIndex) || 0;
      segmentCrimeCount.set(closestSegmentIndex, currentCount + 1);
    }
  });

  // Identify high-risk segments (segments with 3+ crimes nearby)
  segmentCrimeCount.forEach((count, segmentIndex) => {
    if (count >= 3 && segmentIndex < routeCoordinates.length) {
      highRiskSegments.push({
        lat: routeCoordinates[segmentIndex].lat,
        lng: routeCoordinates[segmentIndex].lng,
        crime_count: count,
      });
    }
  });

  // Calculate safety score (0-100, where 100 is safest)
  // Base score starts at 100
  let safetyScore = 100;

  // Deduct points based on total risk
  // Average risk per crime * number of crimes
  const avgRiskPerCrime = crimesNearRoute > 0 ? totalRiskScore / crimesNearRoute : 0;
  const riskPenalty = Math.min(avgRiskPerCrime * crimesNearRoute * 0.5, 80); // Max 80 point penalty

  safetyScore = Math.max(0, safetyScore - riskPenalty);

  // Additional penalty for high-risk segments
  const highRiskPenalty = highRiskSegments.length * 5; // 5 points per high-risk segment
  safetyScore = Math.max(0, safetyScore - highRiskPenalty);

  // Determine risk level based on safety score
  let riskLevel: "Low" | "Medium" | "High";
  if (safetyScore >= 75) {
    riskLevel = "Low";
  } else if (safetyScore >= 50) {
    riskLevel = "Medium";
  } else {
    riskLevel = "High";
  }

  return {
    safety_score: Math.round(safetyScore),
    risk_level: riskLevel,
    crimes_near_route: crimesNearRoute,
    high_risk_segments: highRiskSegments,
  };
}

/**
 * Generate a human-readable description of the route safety
 */
export function generateRouteDescription(analysis: SafetyAnalysis): string {
  const { safety_score, crimes_near_route, high_risk_segments } = analysis;

  if (safety_score >= 85) {
    return `This route is very safe with minimal crime activity. Only ${crimes_near_route} crime(s) reported nearby. Recommended for all times.`;
  } else if (safety_score >= 70) {
    return `This route is relatively safe with ${crimes_near_route} crime(s) nearby. ${
      high_risk_segments.length > 0
        ? `Be cautious in ${high_risk_segments.length} area(s).`
        : "Generally safe for travel."
    }`;
  } else if (safety_score >= 50) {
    return `This route passes through ${crimes_near_route} crime-prone area(s). ${
      high_risk_segments.length > 0
        ? `${high_risk_segments.length} high-risk segment(s) identified.`
        : ""
    } Consider alternative routes if possible.`;
  } else {
    return `This route has significant safety concerns with ${crimes_near_route} crimes nearby and ${high_risk_segments.length} high-risk area(s). Not recommended, especially at night.`;
  }
}
