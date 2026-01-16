import type { RouteData } from "../types/route.types";

interface RouteComparisonProps {
  selectedRoutes: number[];
  onRouteToggle: (routeId: number) => void;
  routes: RouteData[];
  isLoading?: boolean;
  error?: string | null;
}

function RouteComparison({
  selectedRoutes,
  onRouteToggle,
  routes,
  isLoading = false,
  error = null,
}: RouteComparisonProps) {
  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "Low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Medium":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "High":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSafetyScoreBarColor = (score: number) => {
    if (score >= 85) return "bg-green-500";
    if (score >= 70) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Route Comparison
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Compare different routes based on safety scores, duration, and risk
        levels. Click on a route card to toggle its visibility on the map.
      </p>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <svg
            className="animate-spin h-12 w-12 text-blue-500 mb-4"
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
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Analyzing route safety...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Fetching alternatives and calculating scores
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                Error Loading Routes
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && routes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Routes Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            Enter your origin and destination above to find safe routes with
            crime-based safety scoring.
          </p>
        </div>
      )}

      {/* Routes List */}
      {!isLoading && !error && routes.length > 0 && (
        <div className="space-y-4">
          {routes.map((route: RouteData) => {
            const isSelected = selectedRoutes.includes(route.id);

            return (
              <div
                key={route.id}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750 hover:border-blue-300 dark:hover:border-blue-600"
                }`}
                onClick={() => onRouteToggle(route.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {route.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getRiskBadgeColor(
                          route.risk_level
                        )}`}
                      >
                        {route.risk_level} Risk
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {route.crimes_on_route} crimes on route
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onRouteToggle(route.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Safety Score */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Safety Score
                    </span>
                    <span
                      className={`text-2xl font-bold ${getSafetyScoreColor(
                        route.safety_score
                      )}`}
                    >
                      {route.safety_score}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${getSafetyScoreBarColor(
                        route.safety_score
                      )}`}
                      style={{ width: `${route.safety_score}%` }}
                    ></div>
                  </div>
                </div>

                {/* Route Details */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Duration
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {route.duration}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Distance
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {route.distance}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {route.description}
                </p>

                {/* Action Hint */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      ✓ Visible on map • Click to hide
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Comparison Summary */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-750 rounded-lg border border-blue-200 dark:border-gray-600">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              💡 Quick Tip
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Routes are sorted by safety score. Select multiple routes to
              compare them side-by-side on the map. Hover over routes for
              detailed information.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteComparison;
