import { useState, useEffect, useRef } from "react";
import { useSuggestions } from "../hooks/useSuggestions";
import { SuggestionDropdown } from "./SuggestionDropdown";
import { QUICK_LOCATIONS } from "../constants/locations";
import type { LocationSuggestion } from "../services/routeService";

interface RouteSearchProps {
  onSearch: (origin: string, destination: string) => void;
  isSearching?: boolean;
}

function RouteSearch({ onSearch, isSearching = false }: RouteSearchProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
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

      onSearch(originValue, destValue);
    }
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
