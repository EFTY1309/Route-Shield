import { useState, useEffect } from "react";
import {
  fetchLocationSuggestions,
  type LocationSuggestion,
} from "../services/routeService";

interface UseSuggestionsReturn {
  suggestions: LocationSuggestion[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  handleInput: (value: string) => void;
}

export function useSuggestions(): UseSuggestionsReturn {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (input.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await fetchLocationSuggestions(input);
        setSuggestions(results);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [input]);

  return {
    suggestions,
    isOpen,
    setIsOpen,
    handleInput: setInput,
  };
}
