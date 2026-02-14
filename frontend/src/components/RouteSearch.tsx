import { useState, useEffect, useRef } from "react";
import { useSuggestions } from "../hooks/useSuggestions";
import { SuggestionDropdown } from "./SuggestionDropdown";
import { QUICK_LOCATIONS } from "../constants/locations";
import type { LocationSuggestion } from "../services/routeService";
import type { SafetyPreferences } from "../types/preferences.types";
import SafetyPreferencesPanel from "./SafetyPreferencesPanel";
import {
  loadPreferences,
  savePreferences,
  resetPreferences,
} from "../utils/preferences";

interface RouteSearchProps {
  onSearch: (
    origin: string,
    destination: string,
    travelTime: "Day" | "Night",
    preferences: SafetyPreferences,
  ) => void;
  isSearching?: boolean;
}

function RouteSearch({ onSearch, isSearching = false }: RouteSearchProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelTime, setTravelTime] = useState<"Day" | "Night">("Day");
  const [preferences, setPreferences] = useState<SafetyPreferences>(() =>
    loadPreferences(),
  );
  const [originCoords, setOriginCoords] = useState<{
    lat: string;
    lng: string;
  } | null>(null);
  const [destCoords, setDestCoords] = useState<{
    lat: string;
    lng: string;
  } | null>(null);

  const originInput = useSuggestions();
  const destInput = useSuggestions();

  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        originRef.current &&
        !originRef.current.contains(event.target as Node)
      ) {
        originInput.setIsOpen(false);
      }
      if (destRef.current && !destRef.current.contains(event.target as Node)) {
        destInput.setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [originInput, destInput]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim() && !isSearching) {
      originInput.setIsOpen(false);
      destInput.setIsOpen(false);

      const originValue = originCoords
        ? `${originCoords.lat},${originCoords.lng}`
        : origin;
      const destValue = destCoords
        ? `${destCoords.lat},${destCoords.lng}`
        : destination;

      onSearch(originValue, destValue, travelTime, preferences);
    }
  };

  const handlePreferencesChange = (newPreferences: SafetyPreferences) => {
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const handlePreferencesReset = () => {
    const defaults = resetPreferences();
    setPreferences(defaults);
  };

  const handleOriginSelect = (suggestion: LocationSuggestion) => {
    setOrigin(suggestion.display_name);
    setOriginCoords({ lat: suggestion.lat, lng: suggestion.lon });
    originInput.setIsOpen(false);
  };

  const handleDestSelect = (suggestion: LocationSuggestion) => {
    setDestination(suggestion.display_name);
    setDestCoords({ lat: suggestion.lat, lng: suggestion.lon });
    destInput.setIsOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Search Safe Routes
      </h3>

      <form onSubmit={handleSearch} className="space-y-3">
        {/* Origin Input */}
        <div ref={originRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From (Origin)
          </label>
          <input
            type="text"
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setOriginCoords(null);
              originInput.handleInput(e.target.value);
            }}
            onFocus={() => originInput.setIsOpen(true)}
            placeholder="Enter starting location..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          <SuggestionDropdown
            suggestions={originInput.suggestions}
            isOpen={originInput.isOpen}
            onSelect={handleOriginSelect}
          />
        </div>

        {/* Destination Input */}
        <div ref={destRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To (Destination)
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setDestCoords(null);
              destInput.handleInput(e.target.value);
            }}
            onFocus={() => destInput.setIsOpen(true)}
            placeholder="Enter destination..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          <SuggestionDropdown
            suggestions={destInput.suggestions}
            isOpen={destInput.isOpen}
            onSelect={handleDestSelect}
          />
        </div>

        {/* Travel Time Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Travel Time
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTravelTime("Day")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                travelTime === "Day"
                  ? "bg-yellow-500 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
              Day (6 AM - 6 PM)
            </button>
            <button
              type="button"
              onClick={() => setTravelTime("Night")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                travelTime === "Night"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/20"
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              Night (6 PM - 6 AM)
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {travelTime === "Day"
              ? "☀️ Daytime crimes will be weighted higher in safety scores"
              : "🌙 Nighttime crimes will be weighted higher in safety scores"}
          </p>
        </div>

        {/* Safety Preferences */}
        <SafetyPreferencesPanel
          preferences={preferences}
          onChange={handlePreferencesChange}
          onReset={handlePreferencesReset}
        />

        {/* Quick Location Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Locations
          </label>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LOCATIONS.map((location) => (
              <button
                key={location.name}
                type="button"
                onClick={() => {
                  if (!origin) {
                    setOrigin(location.value);
                    originInput.handleInput(location.value);
                  } else if (!destination) {
                    setDestination(location.value);
                    destInput.handleInput(location.value);
                  }
                }}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-300 rounded transition-colors"
              >
                {location.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={!origin.trim() || !destination.trim() || isSearching}
          className={`w-full py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            !origin.trim() || !destination.trim() || isSearching
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg"
          }`}
        >
          {isSearching ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Searching Routes...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Find Safe Routes
            </>
          )}
        </button>
      </form>

      {/* Info Text */}
      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          💡 <strong>How it works:</strong> Enter your origin and destination.
          We'll fetch multiple route options from Google Maps Direction API and
          calculate safety scores based on crime heatmap data along each route.
        </p>
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <strong>Analyzing routes...</strong> Fetching alternatives and
            calculating safety scores
          </p>
        </div>
      )}
    </div>
  );
}

export default RouteSearch;
