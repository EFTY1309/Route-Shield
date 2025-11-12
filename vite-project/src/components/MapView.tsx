import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import { Icon } from "leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { dummyRoutes, startLocation, endLocation } from "../data/dummyRoutes";
import type { RouteData } from "../data/dummyRoutes";
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
}

function MapView({ selectedRoutes, showHeatmap }: MapViewProps) {
  const { theme } = useTheme();
  const [hoveredRoute, setHoveredRoute] = useState<number | null>(null);

  const center: LatLngExpression = [23.7808, 90.4142]; // Center on Dhaka (Gulshan area)

  // Get color based on route safety score
  const getRouteColor = (route: RouteData) => {
    if (hoveredRoute === route.id) {
      return "#FFD700"; // Gold when hovered
    }
    if (route.safety_score >= 85) return "#22c55e"; // Green for safe
    if (route.safety_score >= 70) return "#f59e0b"; // Orange for moderate
    return "#ef4444"; // Red for risky
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
    return severity * 50; // Scale radius with severity
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

        {/* Crime Heatmap Overlay */}
        {showHeatmap &&
          dummyCrimes.map((crime: CrimeData) => (
            <CircleMarker
              key={crime.id}
              center={[crime.lat, crime.lng]}
              radius={getCrimeRadius(crime.severity_score)}
              pathOptions={{
                fillColor: getCrimeColor(crime.severity_score),
                color: getCrimeColor(crime.severity_score),
                weight: 1,
                opacity: 0.4,
                fillOpacity: 0.3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-gray-900">
                    {crime.crime_type}
                  </h3>
                  <p className="text-gray-700">{crime.location_name}</p>
                  <p className="text-gray-600">Time: {crime.time_of_day}</p>
                  <p className="text-gray-600">
                    Severity: {crime.severity_score}/10
                  </p>
                  <p className="text-gray-500 text-xs">{crime.date}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Draw Routes */}
        {dummyRoutes
          .filter((route: RouteData) => selectedRoutes.includes(route.id))
          .map((route: RouteData) => (
            <Polyline
              key={route.id}
              positions={route.coordinates.map(
                (coord) => [coord.lat, coord.lng] as LatLngExpression
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
                  <p className="text-gray-700">Duration: {route.duration}</p>
                  <p className="text-gray-700">Distance: {route.distance}</p>
                  <p className="text-gray-700">
                    Safety Score: {route.safety_score}/100
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

        {/* Start Marker */}
        <Marker
          position={[startLocation.lat, startLocation.lng]}
          icon={startIcon}
        >
          <Popup>
            <div className="text-sm">
              <h3 className="font-bold text-green-700">Start Point</h3>
              <p className="text-gray-700">{startLocation.name}</p>
            </div>
          </Popup>
        </Marker>

        {/* End Marker */}
        <Marker position={[endLocation.lat, endLocation.lng]} icon={endIcon}>
          <Popup>
            <div className="text-sm">
              <h3 className="font-bold text-red-700">Destination</h3>
              <p className="text-gray-700">{endLocation.name}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000] text-xs">
        <h4 className="font-bold mb-2 text-gray-900 dark:text-white">Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Safe Route (85+)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Moderate (70-84)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Risky (&lt;70)
            </span>
          </div>
          {showHeatmap && (
            <>
              <hr className="my-1 border-gray-300 dark:border-gray-600" />
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
        </div>
      </div>
    </div>
  );
}

export default MapView;
