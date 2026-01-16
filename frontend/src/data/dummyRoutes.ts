export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteData {
  id: number;
  name: string;
  coordinates: RouteCoordinate[];
  safety_score: number;
  duration: string;
  distance: string;
  risk_level: "Low" | "Medium" | "High";
  crimes_on_route: number;
  description: string;
}

// Route 1: Mirpur 10 to Gulshan 2 (Fastest but riskier - passes through high-crime areas)
const route1Coordinates: RouteCoordinate[] = [
  { lat: 23.8223, lng: 90.3654 }, // Start: Mirpur 10
  { lat: 23.8150, lng: 90.3700 },
  { lat: 23.8100, lng: 90.3720 },
  { lat: 23.8050, lng: 90.3750 }, // Passes through Mirpur 12
  { lat: 23.8000, lng: 90.3800 },
  { lat: 23.7950, lng: 90.3850 },
  { lat: 23.7900, lng: 90.3900 },
  { lat: 23.7875, lng: 90.3950 },
  { lat: 23.7890, lng: 90.4000 },
  { lat: 23.7920, lng: 90.4050 },
  { lat: 23.7925, lng: 90.4077 }, // End: Gulshan 2
];

// Route 2: Mirpur 10 to Gulshan 2 (Safer but longer - avoids high-crime zones)
const route2Coordinates: RouteCoordinate[] = [
  { lat: 23.8223, lng: 90.3654 }, // Start: Mirpur 10
  { lat: 23.8300, lng: 90.3700 },
  { lat: 23.8400, lng: 90.3750 },
  { lat: 23.8500, lng: 90.3800 },
  { lat: 23.8600, lng: 90.3850 },
  { lat: 23.8650, lng: 90.3900 }, // Passes through safer Uttara areas
  { lat: 23.8600, lng: 90.3950 },
  { lat: 23.8500, lng: 90.4000 },
  { lat: 23.8350, lng: 90.4050 },
  { lat: 23.8200, lng: 90.4100 },
  { lat: 23.8100, lng: 90.4120 },
  { lat: 23.8000, lng: 90.4100 },
  { lat: 23.7925, lng: 90.4077 }, // End: Gulshan 2
];

// Route 3: Dhanmondi 27 to Motijheel (Fast but passes through crime hotspot)
const route3Coordinates: RouteCoordinate[] = [
  { lat: 23.7461, lng: 90.3742 }, // Start: Dhanmondi 27
  { lat: 23.7450, lng: 90.3800 },
  { lat: 23.7420, lng: 90.3850 },
  { lat: 23.7390, lng: 90.3900 },
  { lat: 23.7370, lng: 90.3950 }, // Shahbagh area
  { lat: 23.7350, lng: 90.4000 },
  { lat: 23.7340, lng: 90.4050 },
  { lat: 23.7335, lng: 90.4100 },
  { lat: 23.7330, lng: 90.4170 }, // End: Motijheel
];

// Route 4: Dhanmondi 27 to Motijheel (Safer alternative)
const route4Coordinates: RouteCoordinate[] = [
  { lat: 23.7461, lng: 90.3742 }, // Start: Dhanmondi 27
  { lat: 23.7500, lng: 90.3780 },
  { lat: 23.7550, lng: 90.3830 },
  { lat: 23.7600, lng: 90.3900 }, // Farmgate
  { lat: 23.7580, lng: 90.3950 },
  { lat: 23.7540, lng: 90.4000 },
  { lat: 23.7480, lng: 90.4050 },
  { lat: 23.7420, lng: 90.4100 },
  { lat: 23.7360, lng: 90.4140 },
  { lat: 23.7330, lng: 90.4170 }, // End: Motijheel
];

export const dummyRoutes: RouteData[] = [
  {
    id: 1,
    name: "Route 1 – Fastest, Higher Risk",
    coordinates: route1Coordinates,
    safety_score: 68,
    duration: "22 min",
    distance: "8.5 km",
    risk_level: "High",
    crimes_on_route: 5,
    description: "Quickest route but passes through Mirpur 11 and 12 with recent night robberies and muggings."
  },
  {
    id: 2,
    name: "Route 2 – Safer, Slightly Longer",
    coordinates: route2Coordinates,
    safety_score: 89,
    duration: "28 min",
    distance: "10.2 km",
    risk_level: "Low",
    crimes_on_route: 2,
    description: "Recommended route through safer Uttara sectors with minimal crime reports."
  },
  {
    id: 3,
    name: "Route 3 – Direct, Moderate Risk",
    coordinates: route3Coordinates,
    safety_score: 72,
    duration: "18 min",
    distance: "6.8 km",
    risk_level: "Medium",
    crimes_on_route: 4,
    description: "Direct route but passes through Shahbagh area with moderate night crime activity."
  },
  {
    id: 4,
    name: "Route 4 – Balanced Route",
    coordinates: route4Coordinates,
    safety_score: 82,
    duration: "21 min",
    distance: "7.5 km",
    risk_level: "Low",
    crimes_on_route: 2,
    description: "Good balance of time and safety, avoiding high-crime zones while maintaining reasonable duration."
  }
];

// Start and end markers for the map
export const startLocation = {
  lat: 23.8223,
  lng: 90.3654,
  name: "Mirpur 10"
};

export const endLocation = {
  lat: 23.7925,
  lng: 90.4077,
  name: "Gulshan 2"
};
