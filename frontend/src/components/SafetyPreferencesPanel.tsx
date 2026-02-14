import React, { useState } from "react";
import type {
  SafetyPreferences,
  RiskTolerance,
} from "../types/preferences.types";

interface SafetyPreferencesProps {
  preferences: SafetyPreferences;
  onChange: (preferences: SafetyPreferences) => void;
  onReset: () => void;
}

export default function SafetyPreferencesPanel({
  preferences,
  onChange,
  onReset,
}: SafetyPreferencesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRiskToleranceChange = (tolerance: RiskTolerance) => {
    onChange({ ...preferences, riskTolerance: tolerance });
  };

  const handleConcernChange = (
    concern: keyof SafetyPreferences["crimeTypeConcerns"],
    value: number,
  ) => {
    onChange({
      ...preferences,
      crimeTypeConcerns: {
        ...preferences.crimeTypeConcerns,
        [concern]: value,
      },
    });
  };

  return (
    <div className="mb-4 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="font-medium text-gray-900 dark:text-white">
            Safety Preferences
          </span>
          {preferences.riskTolerance !== "balanced" && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              Customized
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Customize how safety scores are calculated based on your priorities.
          </p>

          {/* Risk Tolerance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Risk Tolerance
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRiskToleranceChange("cautious")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  preferences.riskTolerance === "cautious"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                🛡️ Cautious
              </button>
              <button
                onClick={() => handleRiskToleranceChange("balanced")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  preferences.riskTolerance === "balanced"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                ⚖️ Balanced
              </button>
              <button
                onClick={() => handleRiskToleranceChange("time-focused")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  preferences.riskTolerance === "time-focused"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                ⚡ Fast
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {preferences.riskTolerance === "cautious" &&
                "Prioritize safety heavily, avoid risky areas"}
              {preferences.riskTolerance === "balanced" &&
                "Balance safety and travel time equally"}
              {preferences.riskTolerance === "time-focused" &&
                "Prioritize faster routes, accept moderate risk"}
            </p>
          </div>

          {/* Crime Type Concerns */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Crime Type Concerns
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Adjust how much each crime category affects your safety scores
            </p>

            <div className="space-y-3">
              {/* Violent Crimes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    🔪 Violent Crimes
                  </span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {preferences.crimeTypeConcerns.violentCrimes.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={preferences.crimeTypeConcerns.violentCrimes}
                  onChange={(e) =>
                    handleConcernChange(
                      "violentCrimes",
                      parseFloat(e.target.value),
                    )
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Less concerned</span>
                  <span>More concerned</span>
                </div>
              </div>

              {/* Property Crimes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    💼 Property Crimes
                  </span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {preferences.crimeTypeConcerns.propertyCrimes.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={preferences.crimeTypeConcerns.propertyCrimes}
                  onChange={(e) =>
                    handleConcernChange(
                      "propertyCrimes",
                      parseFloat(e.target.value),
                    )
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Less concerned</span>
                  <span>More concerned</span>
                </div>
              </div>

              {/* Drug Crimes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    💊 Drug-Related Crimes
                  </span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {preferences.crimeTypeConcerns.drugCrimes.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={preferences.crimeTypeConcerns.drugCrimes}
                  onChange={(e) =>
                    handleConcernChange(
                      "drugCrimes",
                      parseFloat(e.target.value),
                    )
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Less concerned</span>
                  <span>More concerned</span>
                </div>
              </div>

              {/* Minor Crimes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    👝 Minor Crimes
                  </span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {preferences.crimeTypeConcerns.minorCrimes.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={preferences.crimeTypeConcerns.minorCrimes}
                  onChange={(e) =>
                    handleConcernChange(
                      "minorCrimes",
                      parseFloat(e.target.value),
                    )
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Less concerned</span>
                  <span>More concerned</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
