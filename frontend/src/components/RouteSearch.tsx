import { useState, useEffect, useRef } from "react";
import {
  fetchLocationSuggestions,
  type LocationSuggestion,
} from "../services/routeService";

interface RouteSearchProps {
  onSearch: (origin: string, destination: string) => void;
  isSearching?: boolean;
}

function RouteSearch({ onSearch, isSearching = false }: RouteSearchProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [destSuggestions, setDestSuggestions] = useState<LocationSuggestion[]>(
    []
  );
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        originRef.current &&
        !originRef.current.contains(event.target as Node)
      ) {
        setShowOriginSuggestions(false);
      }
      if (destRef.current && !destRef.current.contains(event.target as Node)) {
        setShowDestSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions for origin
  useEffect(() => {
    const fetchOriginSuggestions = async () => {
      if (origin.trim().length < 2) {
        setOriginSuggestions([]);
        return;
      }

      try {
        const suggestions = await fetchLocationSuggestions(origin);
        setOriginSuggestions(suggestions);
      } catch (error) {
        console.error("Error fetching origin suggestions:", error);
      }
    };

    const debounceTimer = setTimeout(fetchOriginSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [origin]);

  // Fetch suggestions for destination
  useEffect(() => {
    const fetchDestSuggestions = async () => {
      if (destination.trim().length < 2) {
        setDestSuggestions([]);
        return;
      }

      try {
        const suggestions = await fetchLocationSuggestions(destination);
        setDestSuggestions(suggestions);
      } catch (error) {
        console.error("Error fetching destination suggestions:", error);
      }
    };

    const debounceTimer = setTimeout(fetchDestSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [destination]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim() && !isSearching) {
      setShowOriginSuggestions(false);
      setShowDestSuggestions(false);
      onSearch(origin, destination);
    }
  };

  const handleOriginSelect = (suggestion: LocationSuggestion) => {
    setOrigin(suggestion.display_name);
    setShowOriginSuggestions(false);
  };

  const handleDestSelect = (suggestion: LocationSuggestion) => {
    setDestination(suggestion.display_name);
    setShowDestSuggestions(false);
  };

  const quickLocations = [
    { name: "Mirpur 10", value: "Mirpur 10, Dhaka" },
    { name: "Gulshan 2", value: "Gulshan 2, Dhaka" },
    { name: "Dhanmondi 27", value: "Dhanmondi 27, Dhaka" },
    { name: "Motijheel", value: "Motijheel, Dhaka" },
    { name: "Uttara", value: "Uttara, Dhaka" },
    { name: "Banani", value: "Banani, Dhaka" },
  ];

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
              setShowOriginSuggestions(true);
            }}
            onFocus={() => setShowOriginSuggestions(true)}
            placeholder="Enter starting location..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />

          {/* Origin Suggestions Dropdown */}
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {originSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => handleOriginSelect(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                >
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {suggestion.display_name.split(",")[0]}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {suggestion.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
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
              setShowDestSuggestions(true);
            }}
            onFocus={() => setShowDestSuggestions(true)}
            placeholder="Enter destination..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />

          {/* Destination Suggestions Dropdown */}
          {showDestSuggestions && destSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {destSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => handleDestSelect(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                >
                  <div className="text-sm text-gray-900 dark:text-white font-medium">
                    {suggestion.display_name.split(",")[0]}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {suggestion.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Location Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Locations
          </label>
          <div className="grid grid-cols-3 gap-2">
            {quickLocations.map((location) => (
              <button
                key={location.name}
                type="button"
                onClick={() => {
                  if (!origin) {
                    setOrigin(location.value);
                  } else if (!destination) {
                    setDestination(location.value);
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
