import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import { Icon, LatLngBounds } from "leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteData } from "../types/route.types";
import { dummyCrimes } from "../data/dummyCrimes";
import type { CrimeData } from "../data/dummyCrimes";
import { useTheme } from "../context/ThemeContext";

// Fix Leaflet default icon issue with Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapViewProps {
  selectedRoutes: number[];
  showHeatmap: boolean;
  showPoliceStations: boolean;
  routes: RouteData[];
  origin?: string;
  destination?: string;
  travelTime?: "Day" | "Night";
  highlightedCrimes?: CrimeData[] | null;
  crimes?: CrimeData[];
}

// Component to auto-fit map bounds when routes change
function MapBoundsFitter({ routes }: { routes: RouteData[] }) {
  const map = useMap();

  useEffect(() => {
    if (routes.length > 0) {
      const allCoords = routes.flatMap((route) =>
        route.coordinates.map(
          (coord) => [coord.lat, coord.lng] as [number, number],
        ),
      );

      if (allCoords.length > 0) {
        const bounds = new LatLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [routes, map]);

  return null;
}

// Derive police station centroids from crime data
function derivePoliceStations(crimes: CrimeData[]) {
  const stationMap = new Map<
    string,
    { lat: number; lng: number; count: number }
  >();
  crimes.forEach((crime) => {
    const stationName = crime.police_station;
    if (!stationName) return;
    const existing = stationMap.get(stationName);
    if (existing) {
      existing.lat =
        (existing.lat * existing.count + crime.lat) / (existing.count + 1);
      existing.lng =
        (existing.lng * existing.count + crime.lng) / (existing.count + 1);
      existing.count++;
    } else {
      stationMap.set(stationName, {
        lat: crime.lat,
        lng: crime.lng,
        count: 1,
      });
    }
  });
  return Array.from(stationMap.entries()).map(([name, coords]) => ({
    name,
    lat: coords.lat,
    lng: coords.lng,
    count: coords.count,
  }));
}

function MapView({
  selectedRoutes,
  showHeatmap,
  showPoliceStations,
  routes,
  origin,
  destination,
  travelTime = "Day",
  highlightedCrimes,
  crimes: crimesProp,
}: MapViewProps) {
  const { theme } = useTheme();
  const [hoveredRoute, setHoveredRoute] = useState<number | null>(null);
  // Use crimes passed from App (loaded on app mount). Fall back to dummyCrimes.
  const crimes = crimesProp && crimesProp.length > 0 ? crimesProp : dummyCrimes;

  const center: LatLngExpression = [23.7808, 90.4142]; // Center on Dhaka (Gulshan area)

  // Get color based on route safety score (0-10 scale)
  const getRouteColor = (route: RouteData) => {
    if (hoveredRoute === route.id) {
      return "#FFD700"; // Gold when hovered
    }
    if (route.safety_score >= 7.5) return "#22c55e"; // Green for safe (Low risk)
    if (route.safety_score >= 5.0) return "#f97316"; // Orange for moderate (Medium risk)
    return "#ef4444"; // Red for risky (High risk)
  };

  // Get color based on crime severity
  const getCrimeColor = (severity: number) => {
    if (severity >= 8) return "#dc2626"; // Dark red
    if (severity >= 6) return "#f97316"; // Orange
    if (severity >= 4) return "#fbbf24"; // Yellow
    return "#86efac"; // Light green
  };

  // Get radius based on severity
  const getCrimeRadius = (severity: number) => {
    return severity * 3; // Scale radius with severity (much smaller for clarity)
  };

  // Create custom icons for start/end
  const startIcon = new Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const endIcon = new Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const policeIcon = new Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: markerShadow,
    iconSize: [20, 33],
    iconAnchor: [10, 33],
    popupAnchor: [1, -28],
    shadowSize: [33, 33],
  });

  // Show ALL crimes on the heatmap regardless of travel time.
  // When routes exist, additionally highlight crimes that match the user's travel time
  // by giving mismatched-time crimes lower opacity (handled in pathOptions below).
  const filteredCrimes = crimes;

  // Derive police station locations from crime data
  const policeStations = derivePoliceStations(crimes);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full rounded-lg shadow-lg"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={
            theme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />

        {/* Crime Heatmap Overlay - shows ALL crimes; crimes matching travel time are brighter */}
        {showHeatmap &&
          filteredCrimes.map((crime: CrimeData) => {
            const matchesTime = crime.time_of_day === travelTime;
            return (
              <CircleMarker
                key={crime.id}
                center={[crime.lat, crime.lng]}
                radius={getCrimeRadius(crime.severity_score)}
                pathOptions={{
                  fillColor: getCrimeColor(crime.severity_score),
                  color: getCrimeColor(crime.severity_score),
                  weight: 1,
                  opacity: matchesTime ? 0.8 : 0.3,
                  fillOpacity: matchesTime ? 0.55 : 0.15,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-gray-900">
                      {crime.crime_type}
                    </h3>
                    <p className="text-gray-700">{crime.location_name}</p>
                    <p className="text-gray-600">Time: {crime.time_of_day}</p>
                    <p className="text-gray-500 text-xs">{crime.date}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* Police Station Markers */}
        {showPoliceStations &&
          policeStations.map((station) => (
            <Marker
              key={station.name}
              position={[station.lat, station.lng]}
              icon={policeIcon}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-blue-700">🚔 Police Station</h3>
                  <p className="text-gray-800 font-medium">{station.name}</p>
                  <p className="text-gray-600 text-xs">
                    {station.count} incident{station.count !== 1 ? "s" : ""}{" "}
                    reported nearby
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Highlighted crimes from "See Crimes" — shown regardless of time filter */}

        {/* Auto-fit bounds when routes change */}
        <MapBoundsFitter routes={routes} />

        {/* Draw Routes */}
        {routes
          .filter((route: RouteData) => selectedRoutes.includes(route.id))
          .map((route: RouteData) => (
            <Polyline
              key={route.id}
              positions={route.coordinates.map(
                (coord) => [coord.lat, coord.lng] as LatLngExpression,
              )}
              pathOptions={{
                color: getRouteColor(route),
                weight: hoveredRoute === route.id ? 6 : 4,
                opacity: 0.8,
              }}
              eventHandlers={{
                mouseover: () => setHoveredRoute(route.id),
                mouseout: () => setHoveredRoute(null),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-gray-900">{route.name}</h3>
                  <p className="text-gray-700">Distance: {route.distance}</p>
                  <p className="text-gray-700">
                    Safety Score: {route.safety_score}/10
                  </p>
                  <p className="text-gray-700">
                    Risk Level: {route.risk_level}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    {route.description}
                  </p>
                </div>
              </Popup>
            </Polyline>
          ))}

        {/* Start Marker - show only if routes exist */}
        {routes.length > 0 && routes[0].coordinates.length > 0 && (
          <Marker
            position={[
              routes[0].coordinates[0].lat,
              routes[0].coordinates[0].lng,
            ]}
            icon={startIcon}
          >
            <Popup>
              <div className="text-sm">
                <h3 className="font-bold text-green-700">Start Point</h3>
                <p className="text-gray-700">{origin || "Origin"}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* End Marker - show only if routes exist */}
        {routes.length > 0 && routes[0].coordinates.length > 0 && (
          <Marker
            position={[
              routes[0].coordinates[routes[0].coordinates.length - 1].lat,
              routes[0].coordinates[routes[0].coordinates.length - 1].lng,
            ]}
            icon={endIcon}
          >
            <Popup>
              <div className="text-sm">
                <h3 className="font-bold text-red-700">Destination</h3>
                <p className="text-gray-700">{destination || "Destination"}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Highlighted crimes from "See Crimes" — rendered last so they appear on top */}
        {highlightedCrimes &&
          highlightedCrimes.map((crime: CrimeData) => (
            <CircleMarker
              key={`highlight-outer-${crime.id}`}
              center={[crime.lat, crime.lng]}
              radius={16}
              pathOptions={{
                fillColor: "#7c3aed",
                color: "#7c3aed",
                weight: 2,
                opacity: 0.5,
                fillOpacity: 0.2,
              }}
            />
          ))}
        {highlightedCrimes &&
          highlightedCrimes.map((crime: CrimeData) => (
            <CircleMarker
              key={`highlight-inner-${crime.id}`}
              center={[crime.lat, crime.lng]}
              radius={9}
              pathOptions={{
                fillColor:
                  crime.severity_score >= 8
                    ? "#dc2626"
                    : crime.severity_score >= 6
                      ? "#f97316"
                      : "#fbbf24",
                color: "#7c3aed",
                weight: 2.5,
                opacity: 1,
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-purple-700">
                    ⚠️ {crime.crime_type}
                  </h3>
                  <p className="text-gray-700">{crime.location_name}</p>
                  <p className="text-gray-600">
                    Time:{" "}
                    {crime.time_of_day === "Night" ? "🌙 Night" : "☀️ Day"}
                  </p>
                  <p className="text-gray-600">
                    Severity: {crime.severity_score}/10
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(crime.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000] text-xs">
        <h4 className="font-bold mb-2 text-gray-900 dark:text-white">Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Safe (7.5–10)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Moderate (5–7.4)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Risky (&lt;5)
            </span>
          </div>
          {showHeatmap && (
            <>
              <hr className="my-1 border-gray-300 dark:border-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 italic">
                Bright = {travelTime === "Day" ? "☀️ Day" : "🌙 Night"} crimes
              </p>
              <p className="text-gray-400 dark:text-gray-500 italic text-xs">
                Faded = opposite time
              </p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600 opacity-40"></div>
                <span className="text-gray-700 dark:text-gray-300">
                  High Crime
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-40"></div>
                <span className="text-gray-700 dark:text-gray-300">
                  Low Crime
                </span>
              </div>
            </>
          )}
          {showPoliceStations && (
            <>
              <hr className="my-1 border-gray-300 dark:border-gray-600" />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700 dark:text-gray-300">
                  Police Station
                </span>
              </div>
            </>
          )}
          {highlightedCrimes && highlightedCrimes.length > 0 && (
            <>
              <hr className="my-1 border-gray-300 dark:border-gray-600" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-400"></div>
                  <span className="text-purple-700 dark:text-purple-300 font-medium">
                    Route crimes ({highlightedCrimes.length})
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Dispatch a custom event to clear highlights from App
                    window.dispatchEvent(
                      new CustomEvent("clearHighlightedCrimes"),
                    );
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                  title="Clear highlights"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapView;
