import type { Coordinate } from "../types/route.types";
import type { CrimeData } from "../data/dummyCrimes";
import type { SafetyAnalysis } from "../types/route.types";

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
 * @returns SafetyAnalysis object with score and details
 */
export function calculateRouteSafetyScore(
  routeCoordinates: Coordinate[],
  crimeData: CrimeData[],
  proximityThresholdKm: number = 0.5 // 500 meters default
): SafetyAnalysis {
  let totalRiskScore = 0;
  let crimesNearRoute = 0;
  const highRiskSegments: Array<{
    lat: number;
    lng: number;
    crime_count: number;
  }> = [];

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
      // 2. Crime severity score
      // 3. Time of day (night crimes weighted more)
      const distanceFactor = 1 - distanceToRoute / proximityThresholdKm; // 1 to 0
      const severityFactor = crime.severity_score / 10; // 0 to 1
      const timeFactor = crime.time_of_day === "Night" ? 1.5 : 1.0; // Night crimes are riskier

      const riskContribution = distanceFactor * severityFactor * timeFactor * 10;
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
