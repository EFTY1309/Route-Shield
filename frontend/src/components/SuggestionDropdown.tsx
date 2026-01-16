import { type LocationSuggestion } from "../services/routeService";

interface SuggestionDropdownProps {
  suggestions: LocationSuggestion[];
  isOpen: boolean;
  onSelect: (suggestion: LocationSuggestion) => void;
}

export function SuggestionDropdown({
  suggestions,
  isOpen,
  onSelect,
}: SuggestionDropdownProps) {
  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.place_id}
          type="button"
          onClick={() => onSelect(suggestion)}
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
  );
}
