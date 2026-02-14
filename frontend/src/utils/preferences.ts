import type { SafetyPreferences } from "../types/preferences.types";
import { DEFAULT_PREFERENCES } from "../types/preferences.types";

const STORAGE_KEY = "dhaka-safe-routes-preferences";

/**
 * Save user preferences to localStorage
 */
export function savePreferences(preferences: SafetyPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save preferences:", error);
  }
}

/**
 * Load user preferences from localStorage
 * Returns default preferences if none are saved
 */
export function loadPreferences(): SafetyPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate and merge with defaults to handle any missing fields
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        crimeTypeConcerns: {
          ...DEFAULT_PREFERENCES.crimeTypeConcerns,
          ...(parsed.crimeTypeConcerns || {}),
        },
      };
    }
  } catch (error) {
    console.error("Failed to load preferences:", error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Reset preferences to defaults
 */
export function resetPreferences(): SafetyPreferences {
  savePreferences(DEFAULT_PREFERENCES);
  return DEFAULT_PREFERENCES;
}

/**
 * Check if user has customized preferences
 */
export function hasCustomPreferences(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
