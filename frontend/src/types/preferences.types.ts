/**
 * User Safety Preferences
 * Allows users to customize how safety scores are calculated based on their priorities
 */

export type RiskTolerance = "cautious" | "balanced" | "time-focused";

export interface SafetyPreferences {
  // Risk tolerance level affects overall safety weighting
  riskTolerance: RiskTolerance;
  
  // Custom weights for specific crime concerns (0.5 to 2.0)
  // Higher value = more concerned about this type
  crimeTypeConcerns: {
    violentCrimes: number;      // Robbery, Assault, Murder, Mugging
    propertyCrimes: number;     // Theft, Burglary, Vehicle Theft
    drugCrimes: number;         // Drug Trafficking, Drug Abuse
    minorCrimes: number;        // Pickpocketing, Vandalism
  };
}

export const DEFAULT_PREFERENCES: SafetyPreferences = {
  riskTolerance: "balanced",
  crimeTypeConcerns: {
    violentCrimes: 1.0,
    propertyCrimes: 1.0,
    drugCrimes: 1.0,
    minorCrimes: 1.0,
  },
};

// Map crime types to concern categories
export const CRIME_CATEGORY_MAP: { [key: string]: keyof SafetyPreferences["crimeTypeConcerns"] } = {
  // Violent crimes
  "Murder": "violentCrimes",
  "Assault": "violentCrimes",
  "Robbery": "violentCrimes",
  "Mugging": "violentCrimes",
  "Rape": "violentCrimes",
  "Kidnapping": "violentCrimes",
  "Carjacking": "violentCrimes",
  
  // Drug crimes
  "Drug Trafficking": "drugCrimes",
  "Drug Abuse": "drugCrimes",
  
  // Property crimes
  "Burglary": "propertyCrimes",
  "Theft": "propertyCrimes",
  "Vehicle Theft": "propertyCrimes",
  "Shoplifting": "propertyCrimes",
  
  // Minor crimes
  "Pickpocketing": "minorCrimes",
  "Vandalism": "minorCrimes",
  "Fraud": "minorCrimes",
  "Cybercrime": "minorCrimes",
};

// Get which category a crime type belongs to
export function getCrimeCategory(crimeType: string): keyof SafetyPreferences["crimeTypeConcerns"] | null {
  return CRIME_CATEGORY_MAP[crimeType] || null;
}

// Get risk tolerance multiplier
export function getRiskToleranceMultiplier(tolerance: RiskTolerance): number {
  const multipliers: Record<RiskTolerance, number> = {
    cautious: 1.5,      // Safety is 1.5x more important
    balanced: 1.0,      // Equal weighting
    "time-focused": 0.6, // Safety is 0.6x as important (prioritize speed)
  };
  return multipliers[tolerance];
}
