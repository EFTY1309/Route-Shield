"""
Web Scraper Template for Crime Data Collection
This is a template for scraping crime news from Bangladesh newspapers.

IMPORTANT: 
- Always check and respect robots.txt
- Follow website Terms of Service
- Add delays between requests to avoid overloading servers
- Consider using official APIs when available

Data Sources to Consider:
1. Prothom Alo Crime Section
2. The Daily Star Crime Section  
3. Bangladesh Police Press Releases
4. Dhaka Tribune Crime News
"""

import asyncio
import json
from datetime import datetime
from typing import List, Dict, Optional
import httpx
from bs4 import BeautifulSoup


class CrimeScraper:
    """Template for scraping crime news articles"""
    
    def __init__(self):
        self.crimes: List[Dict] = []
        self.session = httpx.AsyncClient(
            timeout=30.0,
            headers={
                'User-Agent': 'Mozilla/5.0 (Educational Research Bot)'
            }
        )
    
    async def scrape_prothom_alo(self, url: str) -> List[Dict]:
        """
        Template for scraping Prothom Alo crime news
        
        NOTE: This is a template only. You need to:
        1. Check robots.txt at https://www.prothomalo.com/robots.txt
        2. Review their Terms of Service
        3. Implement actual parsing based on their HTML structure
        4. Add proper rate limiting
        """
        print("TEMPLATE: Implement actual scraping logic")
        return []
    
    async def scrape_daily_star(self, url: str) -> List[Dict]:
        """
        Template for scraping The Daily Star crime section
        
        NOTE: Implement similar to prothom_alo with proper checks
        """
        print("TEMPLATE: Implement actual scraping logic")
        return []
    
    def extract_crime_info(self, article_text: str) -> Optional[Dict]:
        """
        Extract crime information from article text
        
        Should identify:
        - Crime type (keywords: mugging, robbery, theft, etc.)
        - Location (Dhaka area names)
        - Date and time
        - Severity indicators
        """
        # TODO: Implement NLP or keyword extraction
        pass
    
    async def geocode_location(self, location_name: str) -> Optional[tuple]:
        """
        Convert location name to coordinates using Nominatim API
        
        Example: "Gulshan 1, Dhaka" -> (23.7808, 90.4142)
        """
        try:
            url = f"https://nominatim.openstreetmap.org/search"
            params = {
                'q': f"{location_name}, Dhaka, Bangladesh",
                'format': 'json',
                'limit': 1
            }
            
            response = await self.session.get(url, params=params)
            data = response.json()
            
            if data:
                return (float(data[0]['lat']), float(data[0]['lon']))
            
            return None
        
        except Exception as e:
            print(f"Geocoding error for {location_name}: {e}")
            return None
    
    def calculate_severity(self, crime_type: str, description: str) -> int:
        """
        Calculate severity score (1-10) based on crime type and details
        """
        severity_map = {
            'murder': 10,
            'robbery': 9,
            'drug trafficking': 9,
            'mugging': 8,
            'assault': 7,
            'burglary': 6,
            'vehicle theft': 7,
            'snatching': 6,
            'theft': 5,
            'pickpocketing': 4,
            'fraud': 5,
            'cyber crime': 5,
        }
        
        crime_lower = crime_type.lower()
        
        # Check for violence indicators in description
        violence_keywords = ['weapon', 'injured', 'shot', 'stabbed', 'beaten']
        has_violence = any(keyword in description.lower() for keyword in violence_keywords)
        
        base_severity = severity_map.get(crime_lower, 5)
        
        if has_violence and base_severity < 8:
            base_severity += 1
        
        return min(10, base_severity)
    
    def determine_time_of_day(self, time_str: str) -> str:
        """
        Determine if crime occurred during Day or Night
        Day: 6 AM - 6 PM
        Night: 6 PM - 6 AM
        """
        # TODO: Parse time string and determine day/night
        # For now, return based on keywords
        if any(word in time_str.lower() for word in ['night', 'evening', 'midnight']):
            return "Night"
        return "Day"
    
    def get_police_station(self, lat: float, lng: float) -> str:
        """
        Map coordinates to police station jurisdiction
        This is a simplified version - in production, use a proper mapping
        """
        # Simplified mapping (expand this with actual jurisdictions)
        stations = {
            (23.71, 90.40, 23.72, 90.42): "Kotwali",
            (23.78, 90.40, 23.80, 90.42): "Gulshan",
            (23.74, 90.37, 23.76, 90.38): "Dhanmondi",
            (23.82, 90.36, 23.83, 90.37): "Mirpur",
            # Add more station boundaries
        }
        
        for bounds, station in stations.items():
            if bounds[0] <= lat <= bounds[2] and bounds[1] <= lng <= bounds[3]:
                return station
        
        return "Unknown"
    
    async def save_to_json(self, filename: str = "scraped_crimes.json"):
        """Save scraped crime data to JSON file"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.crimes, f, indent=2, ensure_ascii=False)
        
        print(f"Saved {len(self.crimes)} crime records to {filename}")
    
    async def close(self):
        """Close the HTTP session"""
        await self.session.aclose()


# Example usage
async def main():
    """
    Example of how to use the scraper
    
    IMPORTANT: Implement actual scraping logic before using!
    """
    scraper = CrimeScraper()
    
    print("=" * 60)
    print("CRIME DATA SCRAPER TEMPLATE")
    print("=" * 60)
    print("\nThis is a TEMPLATE ONLY. To use it:")
    print("1. Check robots.txt of target websites")
    print("2. Review Terms of Service")
    print("3. Implement actual HTML parsing")
    print("4. Add rate limiting (e.g., 1 request per second)")
    print("5. Handle errors gracefully")
    print("6. Store data ethically and responsibly")
    print("\nRECOMMENDATION:")
    print("- Contact websites for data partnership")
    print("- Use official APIs when available")
    print("- Consider manual data collection for better accuracy")
    print("=" * 60)
    
    # Example: Geocode a location
    coords = await scraper.geocode_location("Gulshan 1")
    if coords:
        print(f"\nExample geocoding: Gulshan 1 -> {coords}")
    
    await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
