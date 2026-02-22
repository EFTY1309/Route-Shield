import { useState } from "react";
import type {
  SafetyPreferences,
  RiskTolerance,
} from "../types/preferences.types";

interface SafetyPreferencesProps {
  preferences: SafetyPreferences;
  onChange: (preferences: SafetyPreferences) => void;
  onReset: () => void;
}

// Traveler profile presets — readable names, hidden multipliers
const TRAVELER_PROFILES: {
  id: string;
  label: string;
  emoji: string;
  description: string;
  riskTolerance: RiskTolerance;
  crimeTypeConcerns: SafetyPreferences["crimeTypeConcerns"];
}[] = [
  {
    id: "family",
    label: "Family",
    emoji: "👨‍👩‍👧",
    description: "Maximum safety, avoid all risky areas",
    riskTolerance: "cautious",
    crimeTypeConcerns: {
      violentCrimes: 2.0,
      propertyCrimes: 1.5,
      drugCrimes: 1.5,
      minorCrimes: 1.0,
    },
  },
  {
    id: "solo",
    label: "Solo",
    emoji: "🚶",
    description: "Balanced safety and convenience",
    riskTolerance: "balanced",
    crimeTypeConcerns: {
      violentCrimes: 1.5,
      propertyCrimes: 1.0,
      drugCrimes: 1.0,
      minorCrimes: 0.7,
    },
  },
  {
    id: "night",
    label: "Night Trip",
    emoji: "🌙",
    description: "Extra caution for late-night travel",
    riskTolerance: "cautious",
    crimeTypeConcerns: {
      violentCrimes: 2.0,
      propertyCrimes: 1.5,
      drugCrimes: 1.5,
      minorCrimes: 1.5,
    },
  },
  {
    id: "commuter",
    label: "Commuter",
    emoji: "⚡",
    description: "Fastest route, tolerate minor risk",
    riskTolerance: "time-focused",
    crimeTypeConcerns: {
      violentCrimes: 1.0,
      propertyCrimes: 0.7,
      drugCrimes: 0.7,
      minorCrimes: 0.5,
    },
  },
];

function getActiveProfile(preferences: SafetyPreferences): string | null {
  for (const profile of TRAVELER_PROFILES) {
    if (
      profile.riskTolerance === preferences.riskTolerance &&
      Math.abs(
        profile.crimeTypeConcerns.violentCrimes -
          preferences.crimeTypeConcerns.violentCrimes,
      ) < 0.05 &&
      Math.abs(
        profile.crimeTypeConcerns.propertyCrimes -
          preferences.crimeTypeConcerns.propertyCrimes,
      ) < 0.05 &&
      Math.abs(
        profile.crimeTypeConcerns.drugCrimes -
          preferences.crimeTypeConcerns.drugCrimes,
      ) < 0.05 &&
      Math.abs(
        profile.crimeTypeConcerns.minorCrimes -
          preferences.crimeTypeConcerns.minorCrimes,
      ) < 0.05
    ) {
      return profile.id;
    }
  }
  return null;
}

function getSummary(preferences: SafetyPreferences): string {
  const { riskTolerance } = preferences;
  if (riskTolerance === "cautious")
    return "Prioritising safety — routes may be slightly longer";
  if (riskTolerance === "time-focused")
    return "Prioritising speed — accepting some risk";
  return "Balancing safety and travel time equally";
}

export default function SafetyPreferencesPanel({
  preferences,
  onChange,
  onReset,
}: SafetyPreferencesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeProfile = getActiveProfile(preferences);

  const handleProfileSelect = (profileId: string) => {
    const profile = TRAVELER_PROFILES.find((p) => p.id === profileId);
    if (profile) {
      onChange({
        riskTolerance: profile.riskTolerance,
        crimeTypeConcerns: { ...profile.crimeTypeConcerns },
      });
    }
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

  const concernLevelLabel = (v: number) => {
    if (v <= 0.7) return "Not concerned";
    if (v <= 1.1) return "Somewhat";
    if (v <= 1.5) return "Concerned";
    return "Very concerned";
  };

  return (
    <div className="mb-4 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <span className="font-medium text-gray-900 dark:text-white">
            Who are you travelling as?
          </span>
          {activeProfile ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {TRAVELER_PROFILES.find((p) => p.id === activeProfile)?.emoji}{" "}
              {TRAVELER_PROFILES.find((p) => p.id === activeProfile)?.label}
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              Custom
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pick the option that best describes your trip. Safety scores will
            adapt automatically.
          </p>

          {/* Traveler Profile Selector */}
          <div className="grid grid-cols-2 gap-2">
            {TRAVELER_PROFILES.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileSelect(profile.id)}
                className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                  activeProfile === profile.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{profile.emoji}</span>
                  <span
                    className={`font-semibold text-sm ${
                      activeProfile === profile.id
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {profile.label}
                  </span>
                  {activeProfile === profile.id && (
                    <span className="ml-auto text-blue-500">✓</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {profile.description}
                </p>
              </button>
            ))}
          </div>

          {/* Live summary */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-blue-500">ℹ️</span>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              {getSummary(preferences)}
            </p>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Advanced: fine-tune crime concerns
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Adjust how much each crime category affects your safety score.
              </p>
              {(
                [
                  {
                    key: "violentCrimes" as const,
                    label: "🔪 Violent Crimes",
                    accent: "accent-red-600",
                  },
                  {
                    key: "propertyCrimes" as const,
                    label: "💼 Property Crimes",
                    accent: "accent-blue-600",
                  },
                  {
                    key: "drugCrimes" as const,
                    label: "💊 Drug-Related",
                    accent: "accent-purple-600",
                  },
                  {
                    key: "minorCrimes" as const,
                    label: "👝 Minor Crimes",
                    accent: "accent-yellow-600",
                  },
                ] as const
              ).map(({ key, label, accent }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {concernLevelLabel(preferences.crimeTypeConcerns[key])}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={preferences.crimeTypeConcerns[key]}
                    onChange={(e) =>
                      handleConcernChange(key, parseFloat(e.target.value))
                    }
                    className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${accent}`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>Not concerned</span>
                    <span>Very concerned</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ↺ Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
