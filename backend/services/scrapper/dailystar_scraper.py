"""
The Daily Star Crime Scraper — Dhaka Only
Scrapes /historical/crime, /crime/news and /news/bangladesh/crime-justice
sections, filters articles mentioning Dhaka locations, extracts structured
crime data and geocodes using Nominatim.

Usage:
    python dailystar_scraper.py                     # scrape & save
    python dailystar_scraper.py --pages 5           # limit listing pages
    python dailystar_scraper.py --out my_data.json  # custom output file
    python dailystar_scraper.py --pages 3 --delay 2.0

robots.txt: User-agent: * Allow: /  (no restrictions on these paths)
Rate-limit: 1.5 s between requests — respectful crawling.
"""

import asyncio
import json
import re
import logging
import argparse
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
BASE_URL = "https://www.thedailystar.net"
DELAY_SECONDS = 1.5
OUTPUT_FILE = Path(__file__).parent / "data" / "dailystar_crimes.json"

# Listing sections to crawl
LISTING_SECTIONS = [
    "/historical/crime",
    "/news/bangladesh/crime-justice",
]

# ── Dhaka area keyword map (English) ─────────────────────────────────────────
# Maps a keyword that appears in article text → canonical English area name
DHAKA_AREAS: Dict[str, str] = {
    # ── General ──
    "Dhaka": "Dhaka",
    "dhaka": "Dhaka",
    "Old Dhaka": "Old Dhaka",
    "old dhaka": "Old Dhaka",
    "capital": "Dhaka",

    # ── Old Dhaka ──
    "Sadarghat": "Sadarghat",
    "Kotwali": "Kotwali",
    "Bangshal": "Bangshal",
    "Chawkbazar": "Chawkbazar",
    "Chawk Bazar": "Chawkbazar",
    "Lalbagh": "Lalbagh",
    "Hazaribagh": "Hazaribagh",
    "Kamrangirchar": "Kamrangirchar",

    # ── Motijheel ──
    "Motijheel": "Motijheel",
    "Gulistan": "Gulistan",
    "Paltan": "Paltan",
    "Shahbagh": "Shahbagh",
    "Ramna": "Ramna",
    "Segunbagicha": "Segunbagicha",
    "Moghbazar": "Moghbazar",
    "Mughda": "Mughda",

    # ── Mirpur ──
    "Mirpur": "Mirpur",
    "Pallabi": "Pallabi",
    "Kafrul": "Kafrul",
    "Sheorapara": "Sheorapara",
    "Rupnagar": "Mirpur",

    # ── Mohammadpur / Dhanmondi ──
    "Mohammadpur": "Mohammadpur",
    "Dhanmondi": "Dhanmondi",
    "Adabar": "Adabar",
    "Shyamoli": "Shyamoli",
    "Rayerbazar": "Rayerbazar",
    "Rayer Bazar": "Rayerbazar",

    # ── Gulshan / Banani / Baridhara ──
    "Gulshan": "Gulshan",
    "Banani": "Banani",
    "Baridhara": "Baridhara",
    "Nikunja": "Nikunja",
    "Khilkhet": "Khilkhet",

    # ── Uttara ──
    "Uttara": "Uttara",
    "Turag": "Turag",
    "Dakshin Khan": "Dakshin Khan",
    "Uttarkhan": "Uttarkhan",
    "Dakshinkhan": "Dakshin Khan",

    # ── Tejgaon ──
    "Tejgaon": "Tejgaon",
    "Farmgate": "Farmgate",
    "Farm Gate": "Farmgate",

    # ── Badda / Rampura / Khilgaon ──
    "Badda": "Badda",
    "Rampura": "Rampura",
    "Banasree": "Banasree",
    "Khilgaon": "Khilgaon",
    "Sabujbagh": "Sabujbagh",
    "Basabo": "Basabo",

    # ── Jatrabari / Demra ──
    "Demra": "Demra",
    "Jatrabari": "Jatrabari",
    "Matuail": "Matuail",

    # ── Keraniganj ──
    "Keraniganj": "Keraniganj",

    # ── Wari / Sutrapur ──
    "Wari": "Wari",
    "Sutrapur": "Sutrapur",
    "Azimpur": "Azimpur",
    "Shyampur": "Shyampur",
    "Kadamtali": "Kadamtali",
    "Hatirjheel": "Hatirjheel",
    "Hatirjeel": "Hatirjheel",

    # ── Airport / Cantonment ──
    "Cantonment": "Cantonment",
    "Airport": "Airport",
    "Ashkona": "Airport",

    # ── Savar / Ashulia (Greater Dhaka) ──
    "Savar": "Savar",
    "Ashulia": "Ashulia",
    "Tongi": "Tongi",
    "Gazipur": "Gazipur",

    # ── Narayanganj (adjacent) ──
    "Narayanganj": "Narayanganj",
}

# ── Crime type keyword map ─────────────────────────────────────────────────
CRIME_KEYWORDS: List[Tuple[str, str, int]] = [
    # (English keyword, crime_type, base_severity)
    ("murder",           "Murder",               10),
    ("killed",           "Murder",               10),
    ("dead body",        "Murder",                9),
    ("body found",       "Murder",                9),
    ("shot dead",        "Shooting",             10),
    ("shot to death",    "Shooting",             10),
    ("shoot",            "Shooting",              9),
    ("shooting",         "Shooting",              9),
    ("stab",             "Stabbing",              9),
    ("stabbed",          "Stabbing",              9),
    ("rape",             "Rape",                 10),
    ("gang-rape",        "Rape",                 10),
    ("sexual assault",   "Sexual Assault",       10),
    ("sexual harassment","Sexual Harassment",     8),
    ("robbery",          "Robbery",               9),
    ("robber",           "Robbery",               9),
    ("snatch",           "Snatching",             8),
    ("mug",              "Mugging",               8),
    ("mugger",           "Mugging",               8),
    ("theft",            "Theft",                 5),
    ("stolen",           "Theft",                 5),
    ("extortion",        "Extortion",             7),
    ("abduct",           "Kidnapping",            9),
    ("kidnap",           "Kidnapping",            9),
    ("missing",          "Missing Person",        5),
    ("drug",             "Drug Trafficking",      8),
    ("yaba",             "Drug Trafficking",      8),
    ("heroin",           "Drug Trafficking",      8),
    ("narcotics",        "Drug Trafficking",      8),
    ("bomb",             "Bomb/Explosion",        9),
    ("explosion",        "Bomb/Explosion",        9),
    ("arson",            "Arson/Fire",            7),
    ("fire",             "Arson/Fire",            6),
    ("assault",          "Assault",               6),
    ("beat",             "Assault",               6),
    ("attack",           "Assault",               6),
    ("torture",          "Torture",               7),
    ("fraud",            "Fraud",                 5),
    ("forgery",          "Fraud",                 5),
    ("laundering",       "Money Laundering",      7),
    ("corruption",       "Corruption",            6),
    ("trafficking",      "Human Trafficking",     8),
    ("arms",             "Arms/Weapons",          7),
    ("weapon",           "Arms/Weapons",          7),
    ("arrested",         "Arrest",                4),
    ("detained",         "Arrest",                4),
    ("remand",           "Arrest",                4),
    ("suicide",          "Suspicious Death",      4),
    ("clash",            "Clash/Violence",        7),
    ("cyber",            "Cyber Crime",           5),
]

# ── Police station approximate mapping ──────────────────────────────────────
AREA_TO_STATION: Dict[str, str] = {
    "Old Dhaka":     "Kotwali",
    "Sadarghat":     "Kotwali",
    "Kotwali":       "Kotwali",
    "Bangshal":      "Bangshal",
    "Chawkbazar":    "Chawkbazar",
    "Lalbagh":       "Lalbagh",
    "Hazaribagh":    "Hazaribagh",
    "Kamrangirchar": "Kamrangirchar",
    "Motijheel":     "Motijheel",
    "Gulistan":      "Paltan",
    "Paltan":        "Paltan",
    "Shahbagh":      "Shahbagh",
    "Ramna":         "Ramna",
    "Segunbagicha":  "Ramna",
    "Moghbazar":     "Ramna",
    "Mughda":        "Khilgaon",
    "Mirpur":        "Mirpur",
    "Pallabi":       "Pallabi",
    "Kafrul":        "Kafrul",
    "Sheorapara":    "Mirpur",
    "Mohammadpur":   "Mohammadpur",
    "Dhanmondi":     "Dhanmondi",
    "Adabar":        "Adabar",
    "Shyamoli":      "Mohammadpur",
    "Rayerbazar":    "Mohammadpur",
    "Gulshan":       "Gulshan",
    "Banani":        "Gulshan",
    "Baridhara":     "Gulshan",
    "Nikunja":       "Khilkhet",
    "Khilkhet":      "Khilkhet",
    "Uttara":        "Uttara",
    "Turag":         "Turag",
    "Dakshin Khan":  "Dakshin Khan",
    "Uttarkhan":     "Uttarkhan",
    "Tejgaon":       "Tejgaon",
    "Farmgate":      "Tejgaon",
    "Badda":         "Badda",
    "Rampura":       "Rampura",
    "Banasree":      "Rampura",
    "Hatirjheel":    "Rampura",
    "Khilgaon":      "Khilgaon",
    "Sabujbagh":     "Sabujbagh",
    "Basabo":        "Sabujbagh",
    "Demra":         "Demra",
    "Jatrabari":     "Jatrabari",
    "Matuail":       "Demra",
    "Keraniganj":    "Keraniganj",
    "Wari":          "Wari",
    "Sutrapur":      "Sutrapur",
    "Azimpur":       "Lalbagh",
    "Shyampur":      "Shyampur",
    "Kadamtali":     "Kadamtali",
    "Cantonment":    "Cantonment",
    "Airport":       "Airport",
    "Savar":         "Savar",
    "Ashulia":       "Ashulia",
    "Tongi":         "Tongi",
    "Narayanganj":   "Narayanganj Sadar",
    "Gazipur":       "Gazipur Sadar",
    "Dhaka":         "Dhaka",
}

# ── Known coordinates for common Dhaka areas ─────────────────────────────────
KNOWN_COORDS: Dict[str, Tuple[float, float]] = {
    "Old Dhaka":     (23.7104, 90.4074),
    "Sadarghat":     (23.7104, 90.4074),
    "Kotwali":       (23.7200, 90.4100),
    "Bangshal":      (23.7165, 90.4080),
    "Chawkbazar":    (23.7185, 90.4095),
    "Lalbagh":       (23.7225, 90.3960),
    "Hazaribagh":    (23.7260, 90.3840),
    "Kamrangirchar": (23.7140, 90.3830),
    "Motijheel":     (23.7330, 90.4177),
    "Gulistan":      (23.7230, 90.4120),
    "Paltan":        (23.7340, 90.4155),
    "Shahbagh":      (23.7388, 90.3955),
    "Ramna":         (23.7360, 90.4060),
    "Segunbagicha":  (23.7350, 90.4120),
    "Moghbazar":     (23.7501, 90.4063),
    "Mughda":        (23.7350, 90.4340),
    "Mirpur":        (23.8050, 90.3660),
    "Pallabi":       (23.8237, 90.3635),
    "Kafrul":        (23.7930, 90.3780),
    "Sheorapara":    (23.7980, 90.3660),
    "Mohammadpur":   (23.7626, 90.3607),
    "Dhanmondi":     (23.7461, 90.3742),
    "Adabar":        (23.7570, 90.3530),
    "Shyamoli":      (23.7718, 90.3620),
    "Rayerbazar":    (23.7510, 90.3680),
    "Gulshan":       (23.7808, 90.4142),
    "Banani":        (23.7934, 90.4040),
    "Baridhara":     (23.7960, 90.4245),
    "Nikunja":       (23.8270, 90.4083),
    "Khilkhet":      (23.8310, 90.4200),
    "Uttara":        (23.8759, 90.3795),
    "Turag":         (23.8994, 90.3527),
    "Dakshin Khan":  (23.8617, 90.4239),
    "Uttarkhan":     (23.8980, 90.4068),
    "Tejgaon":       (23.7670, 90.3930),
    "Farmgate":      (23.7545, 90.3878),
    "Badda":         (23.7766, 90.4263),
    "Rampura":       (23.7620, 90.4220),
    "Banasree":      (23.7580, 90.4353),
    "Hatirjheel":    (23.7607, 90.4170),
    "Khilgaon":      (23.7413, 90.4286),
    "Sabujbagh":     (23.7290, 90.4330),
    "Basabo":        (23.7334, 90.4357),
    "Demra":         (23.7223, 90.4640),
    "Jatrabari":     (23.7163, 90.4315),
    "Matuail":       (23.7049, 90.4600),
    "Keraniganj":    (23.6994, 90.3725),
    "Wari":          (23.7193, 90.4210),
    "Sutrapur":      (23.7188, 90.4178),
    "Azimpur":       (23.7255, 90.3900),
    "Shyampur":      (23.7038, 90.4440),
    "Kadamtali":     (23.7078, 90.4380),
    "Cantonment":    (23.7960, 90.3980),
    "Airport":       (23.8433, 90.3978),
    "Savar":         (23.8583, 90.2667),
    "Ashulia":       (23.9023, 90.2984),
    "Tongi":         (23.9910, 90.4120),
    "Gazipur":       (23.9999, 90.4203),
    "Narayanganj":   (23.6238, 90.4996),
    "Dhaka":         (23.7561, 90.3861),
}


# ═══════════════════════════════════════════════════════════════════════════
class DailyStarScraper:
    """Async scraper for The Daily Star crime articles (Dhaka only)."""

    def __init__(self, delay: float = DELAY_SECONDS):
        self.delay = delay
        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://www.thedailystar.net/",
            },
        )
        self._geocode_cache: Dict[str, Optional[Tuple[float, float]]] = {}

    # ── HTTP helpers ─────────────────────────────────────────────────────────
    async def _get(self, url: str) -> Optional[str]:
        """GET a URL and return HTML text, or None on error."""
        try:
            await asyncio.sleep(self.delay)
            r = await self.client.get(url)
            r.raise_for_status()
            return r.text
        except Exception as exc:
            log.warning("GET %s → %s", url, exc)
            return None

    # ── URL collection: listing pages ─────────────────────────────────────────
    async def get_article_urls_from_listing(
        self, section: str, max_pages: int = 10
    ) -> List[str]:
        """
        Collect article URLs from a paginated listing page.
        Daily Star listing pages render links in static HTML (no JS required).
        Pagination: /historical/crime?page=0, ?page=1, ...
        """
        seen: set = set()
        matched: List[str] = []

        for page_num in range(max_pages):
            url = f"{BASE_URL}{section}?page={page_num}"
            log.info("Listing  %s", url)
            html = await self._get(url)
            if not html:
                break

            soup = BeautifulSoup(html, "html.parser")

            # Extract all article links on the page
            new_count = 0
            for a_tag in soup.find_all("a", href=True):
                href: str = a_tag["href"]
                # Match article URL patterns
                if re.search(
                    r"/(historical/crime|crime|news/bangladesh/crime-justice|news/bangladesh/accidents-fires)/news/",
                    href,
                ):
                    full = href if href.startswith("http") else BASE_URL + href
                    # Strip query strings
                    full = full.split("?")[0]
                    if full not in seen:
                        seen.add(full)
                        matched.append(full)
                        new_count += 1

            log.info("  → %d new URLs on page %d (total: %d)", new_count, page_num, len(matched))

            # Stop if no new articles (end of pagination)
            if new_count == 0 and page_num > 0:
                log.info("  No new URLs on page %d — stopping.", page_num)
                break

        return matched

    # ── URL collection: sitemap fallback ─────────────────────────────────────
    async def get_article_urls_from_sitemap(self, max_pages: int = 5) -> List[str]:
        """
        Collect crime/justice article URLs from the sitemap as a supplement.
        Sitemap pages are slow (112 pages total) so limit to recent ones.
        """
        seen: set = set()
        matched: List[str] = []

        # Start from the most recent sitemap page (page=1 is newest)
        for page_num in range(1, max_pages + 1):
            url = f"https://www.thedailystar.net/sitemap.xml?page={page_num}"
            log.info("Sitemap  %s", url)
            html = await self._get(url)
            if not html:
                break

            found = re.findall(
                r"https://www\.thedailystar\.net/((?:historical/crime|crime|news/bangladesh/crime-justice)/news/[^\s<|]+)",
                html,
            )
            new_count = 0
            for path in found:
                full = "https://www.thedailystar.net/" + path
                full = full.split("?")[0]
                if full not in seen:
                    seen.add(full)
                    matched.append(full)
                    new_count += 1

            log.info("  → %d new crime URLs in sitemap page %d", new_count, page_num)

        return matched

    # ── Article parsing ──────────────────────────────────────────────────────
    async def parse_article(self, url: str) -> Optional[Dict]:
        """Fetch and parse a single article. Returns None if not Dhaka crime."""
        html = await self._get(url)
        if not html:
            return None

        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else ""

        # Body text
        body_div = (
            soup.find("div", class_=re.compile(r"article.?body|story.?content|detail|content", re.I))
            or soup.find("article")
            or soup.find("div", id=re.compile(r"content|story|article", re.I))
        )
        body_text = body_div.get_text(" ", strip=True) if body_div else ""
        full_text = title + " " + body_text

        # ── Dhaka filter ──────────────────────────────────────────────────
        dhaka_area = self._detect_dhaka_area(full_text)
        if dhaka_area is None:
            log.debug("Skip (not Dhaka): %s", title[:60])
            return None

        # ── Date ─────────────────────────────────────────────────────────
        pub_date = self._extract_date(soup)

        # ── Crime type & severity ─────────────────────────────────────────
        crime_type, severity = self._classify_crime(full_text)

        # ── Time of day ──────────────────────────────────────────────────
        time_of_day = self._classify_time(full_text)

        # ── Coordinates ──────────────────────────────────────────────────
        coords = await self._get_coords(dhaka_area)
        if coords is None:
            log.debug("Skip (no coords): %s", title[:50])
            return None
        lat, lng = coords

        # ── Police station ────────────────────────────────────────────────
        police_station = AREA_TO_STATION.get(dhaka_area, dhaka_area)

        return {
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "crime_type": crime_type,
            "time_of_day": time_of_day,
            "severity_score": severity,
            "location_name": dhaka_area,
            "date": pub_date,
            "police_station": police_station,
            "source": "The Daily Star",
            "_title": title,
            "_url": url,
        }

    # ── Date extraction ──────────────────────────────────────────────────────
    def _extract_date(self, soup: BeautifulSoup) -> str:
        """Extract publication date as YYYY-MM-DD."""
        # 1. <meta property="article:published_time">
        meta = soup.find("meta", property="article:published_time")
        if meta and meta.get("content"):
            try:
                return datetime.fromisoformat(meta["content"][:10]).strftime("%Y-%m-%d")
            except ValueError:
                pass

        # 2. <meta name="publish_date"> or similar
        for attr in [{"name": "publish_date"}, {"name": "date"}, {"itemprop": "datePublished"}]:
            tag = soup.find("meta", attr)
            if tag and tag.get("content"):
                try:
                    return datetime.fromisoformat(tag["content"][:10]).strftime("%Y-%m-%d")
                except ValueError:
                    pass

        # 3. <time> tag
        time_tag = soup.find("time")
        if time_tag:
            dt_val = time_tag.get("datetime") or time_tag.get_text(strip=True)
            if dt_val:
                for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M", "%Y-%m-%d",
                            "%d %B %Y", "%B %d, %Y"):
                    try:
                        return datetime.strptime(dt_val[:20].strip(), fmt).strftime("%Y-%m-%d")
                    except ValueError:
                        continue

        # 4. Regex in page text: "15 JANUARY 2026" or "January 15, 2026"
        text = soup.get_text(" ")
        m = re.search(
            r"(\d{1,2})\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|"
            r"SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})",
            text, re.I
        )
        if m:
            try:
                return datetime.strptime(
                    f"{m.group(1)} {m.group(2).capitalize()} {m.group(3)}", "%d %B %Y"
                ).strftime("%Y-%m-%d")
            except ValueError:
                pass

        return date.today().strftime("%Y-%m-%d")

    # ── Dhaka area detection ─────────────────────────────────────────────────
    def _detect_dhaka_area(self, text: str) -> Optional[str]:
        """
        Return the most-specific Dhaka area found in the text.
        Prioritise longer/more-specific matches over generic "Dhaka".
        """
        best_area: Optional[str] = None
        best_len = 0
        for keyword, area_name in DHAKA_AREAS.items():
            if keyword in text and len(keyword) > best_len:
                best_area = area_name
                best_len = len(keyword)
        return best_area

    # ── Crime classification ─────────────────────────────────────────────────
    def _classify_crime(self, text: str) -> Tuple[str, int]:
        """Return (crime_type, severity_score 1-10)."""
        text_lower = text.lower()
        for keyword, crime_type, base_sev in CRIME_KEYWORDS:
            if keyword.lower() in text_lower:
                # Boost for fatality / injury indicators
                violence_words = ["killed", "dead", "death", "injured", "hurt", "wounded", "victim"]
                boost = 1 if any(w in text_lower for w in violence_words) else 0
                return crime_type, min(10, base_sev + boost)
        return "Crime", 5

    # ── Time of day ──────────────────────────────────────────────────────────
    def _classify_time(self, text: str) -> str:
        """Return 'Day' or 'Night' based on article text clues."""
        text_lower = text.lower()
        night_phrases = [
            "at night", "last night", "midnight", "in the night", "late night",
            "early morning", "dawn", "in the evening", "evening",
            "11pm", "12pm", "1am", "2am", "3am", "4am", "10pm", "11am",
        ]
        day_phrases = [
            "morning", "afternoon", "noon", "midday", "daytime",
            "in the day", "broad daylight",
        ]
        night_score = sum(1 for w in night_phrases if w in text_lower)
        day_score   = sum(1 for w in day_phrases   if w in text_lower)
        return "Night" if night_score >= day_score else "Day"

    # ── Geocoding ────────────────────────────────────────────────────────────
    async def _get_coords(self, area: str) -> Optional[Tuple[float, float]]:
        if area in self._geocode_cache:
            return self._geocode_cache[area]
        if area in KNOWN_COORDS:
            self._geocode_cache[area] = KNOWN_COORDS[area]
            return KNOWN_COORDS[area]
        # Nominatim fallback
        coords = await self._nominatim(f"{area}, Dhaka, Bangladesh")
        if coords is None:
            coords = await self._nominatim("Dhaka, Bangladesh")
        self._geocode_cache[area] = coords
        return coords

    async def _nominatim(self, query: str) -> Optional[Tuple[float, float]]:
        try:
            await asyncio.sleep(1.0)
            r = await self.client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": "1"},
                headers={"User-Agent": "DhakaCrimeScraper/1.0 (academic research)"},
            )
            data = r.json()
            if data:
                return (float(data[0]["lat"]), float(data[0]["lon"]))
        except Exception as ex:
            log.warning("Nominatim '%s': %s", query, ex)
        return None

    # ── Main run ─────────────────────────────────────────────────────────────
    async def run(self, max_pages: int = 10, out_file: Path = OUTPUT_FILE) -> List[Dict]:
        """Full pipeline: collect URLs → parse → assign IDs → save JSON."""
        all_urls: List[str] = []

        # Crawl each listing section
        for section in LISTING_SECTIONS:
            urls = await self.get_article_urls_from_listing(section, max_pages=max_pages)
            all_urls.extend(urls)

        # Deduplicate
        all_urls = list(dict.fromkeys(all_urls))
        log.info("Total unique article URLs: %d", len(all_urls))

        if not all_urls:
            log.warning("No article URLs found! The listing pages may have changed structure.")
            log.info("Falling back to sitemap-based URL collection...")
            all_urls = await self.get_article_urls_from_sitemap(max_pages=min(5, max_pages))
            all_urls = list(dict.fromkeys(all_urls))
            log.info("Sitemap fallback: %d URLs found", len(all_urls))

        crimes: List[Dict] = []
        for idx, url in enumerate(all_urls, 1):
            log.info("[%d/%d] Parsing %s", idx, len(all_urls), url)
            record = await self.parse_article(url)
            if record:
                crimes.append(record)
                log.info(
                    "  ✓  %s  (%s, %s)",
                    record["location_name"], record["crime_type"], record["date"]
                )

        # Assign IDs and strip internal debug fields
        final: List[Dict] = []
        for i, c in enumerate(crimes, start=1):
            final.append({
                "id": i,
                "lat": c["lat"],
                "lng": c["lng"],
                "crime_type": c["crime_type"],
                "time_of_day": c["time_of_day"],
                "severity_score": c["severity_score"],
                "location_name": c["location_name"],
                "date": c["date"],
                "police_station": c["police_station"],
                "source": c["source"],
            })

        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=2, ensure_ascii=False)

        log.info("Saved %d Dhaka crime records → %s", len(final), out_file)
        return final

    async def close(self):
        await self.client.aclose()


# ── CLI ──────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Scrape The Daily Star crime news for Dhaka"
    )
    p.add_argument("--pages",  type=int,   default=10,
                   help="Max listing pages per section (default: 10)")
    p.add_argument("--out",    type=str,   default=str(OUTPUT_FILE),
                   help="Output JSON file path")
    p.add_argument("--delay",  type=float, default=DELAY_SECONDS,
                   help="Delay between requests in seconds (default: 1.5)")
    return p.parse_args()


async def main():
    args = parse_args()
    scraper = DailyStarScraper(delay=args.delay)
    try:
        results = await scraper.run(
            max_pages=args.pages,
            out_file=Path(args.out),
        )
        print(f"\n{'='*55}")
        print(f"  Done!  {len(results)} Dhaka crime records collected.")
        print(f"  Output: {args.out}")
        print(f"{'='*55}")
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
