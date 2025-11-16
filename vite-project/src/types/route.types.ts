// Types for Google Maps Direction API and Route processing

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RouteData {
  id: number;
  name: string;
  coordinates: Coordinate[];
  distance: string;
  duration: string;
  safety_score: number;
  risk_level: "Low" | "Medium" | "High";
  crimes_on_route: number;
  description: string;
  distanceValue: number; // in meters
  durationValue: number; // in seconds
}

export interface GoogleMapsRoute {
  legs: Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    steps: Array<{
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
      polyline: { points: string };
      distance: { text: string; value: number };
      duration: { text: string; value: number };
    }>;
  }>;
  overview_polyline: { points: string };
  summary: string;
}

export interface GoogleMapsDirectionResponse {
  routes: GoogleMapsRoute[];
  status: string;
}

export interface SafetyAnalysis {
  safety_score: number;
  risk_level: "Low" | "Medium" | "High";
  crimes_near_route: number;
  high_risk_segments: Array<{
    lat: number;
    lng: number;
    crime_count: number;
  }>;
}
