"""
Prothom Alo Crime Scraper — Dhaka Only
Scrapes /bangladesh/crime and /bangladesh/capital sections,
filters articles mentioning Dhaka locations, extracts structured
crime data and geocodes using Nominatim.

Usage:
    python prothomalo_scraper.py                     # scrape & save
    python prothomalo_scraper.py --pages 5           # limit listing pages per section
    python prothomalo_scraper.py --out my_data.json  # custom output file

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
BASE_URL = "https://www.prothomalo.com"
SECTIONS = [
    "/bangladesh/crime",
    "/bangladesh/capital",
]
DELAY_SECONDS = 1.5   # between every HTTP request
OUTPUT_FILE = Path(__file__).parent / "data" / "scraped_crimes.json"


# ── Bengali → English month map ─────────────────────────────────────────────
BN_MONTHS = {
    "জানুয়ারি": "January", "ফেব্রুয়ারি": "February",
    "মার্চ": "March",       "এপ্রিল": "April",
    "মে": "May",            "জুন": "June",
    "জুলাই": "July",        "আগস্ট": "August",
    "সেপ্টেম্বর": "September", "অক্টোবর": "October",
    "নভেম্বর": "November",  "ডিসেম্বর": "December",
}

# Bengali digit → ASCII digit
BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


# ── Dhaka thana / area keyword map ──────────────────────────────────────────
# Maps a Bengali keyword that appears in article text → canonical English name
DHAKA_AREAS: Dict[str, str] = {
    # ── Old Dhaka ──
    "সদরঘাট": "Sadarghat", "কোতোয়ালি": "Kotwali", "কোতওয়ালি": "Kotwali",
    "বাংশাল": "Bangshal", "চকবাজার": "Chawkbazar", "চকবাজারে": "Chawkbazar",
    "লালবাগ": "Lalbagh", "হাজারীবাগ": "Hazaribagh", "কামরাঙ্গীরচর": "Kamrangirchar",
    # ── Motijheel / Gulistan ──
    "মতিঝিল": "Motijheel", "গুলিস্তান": "Gulistan", "পল্টন": "Paltan",
    "শাহবাগ": "Shahbagh", "রমনা": "Ramna", "সেগুনবাগিচা": "Segunbagicha",
    # ── Mirpur ──
    "মিরপুর": "Mirpur", "পল্লবী": "Pallabi", "কাফরুল": "Kafrul",
    "শেওড়াপাড়া": "Sheorapara", "মিরপুরে": "Mirpur",
    # ── Mohammadpur / Dhanmondi ──
    "মোহাম্মদপুর": "Mohammadpur", "ধানমণ্ডি": "Dhanmondi", "ধানমন্ডি": "Dhanmondi",
    "আদাবর": "Adabar", "শ্যামলী": "Shyamoli", "রায়েরবাজার": "Rayerbazar",
    # ── Gulshan / Banani / Baridhara ──
    "গুলশান": "Gulshan", "বনানী": "Banani", "বারিধারা": "Baridhara",
    "নিকুঞ্জ": "Nikunja", "গুলশানে": "Gulshan",
    # ── Uttara ──
    "উত্তরা": "Uttara", "তুরাগ": "Turag", "দক্ষিণখান": "Dakshin Khan",
    "উত্তরখান": "Uttarkhan",
    # ── Tejgaon ──
    "তেজগাঁও": "Tejgaon", "শেরেবাংলানগর": "Sher-e-Banglanagar",
    "ফার্মগেট": "Farmgate",
    # ── Badda / Rampura ──
    "বাড্ডা": "Badda", "রামপুরা": "Rampura", "বনশ্রী": "Banasree",
    "মেরুল বাড্ডা": "Merul Badda",
    # ── Khilgaon / Sabujbagh ──
    "খিলগাঁও": "Khilgaon", "সবুজবাগ": "Sabujbagh", "বাসাবো": "Basabo",
    # ── Demra / Jatrabari ──
    "ডেমরা": "Demra", "যাত্রাবাড়ী": "Jatrabari", "যাত্রাবাড়ি": "Jatrabari",
    "মাতুয়াইল": "Matuail", "ডেমরায়": "Demra",
    # ── Keraniganj ──
    "কেরানীগঞ্জ": "Keraniganj",
    # ── Cantonment / Airport ──
    "ক্যান্টনমেন্ট": "Cantonment", "বিমানবন্দর": "Airport",
    # ── Wari / Sutrapur ──
    "ওয়ারী": "Wari", "সূত্রাপুর": "Sutrapur",
    # ── Lalbagh ──
    "আজিমপুর": "Azimpur",
    # ── Shyampur / Kadamtali ──
    "শ্যামপুর": "Shyampur", "কদমতলী": "Kadamtali",
    # ── Hatirjheel / Rayer Bazar ──
    "হাতিরঝিল": "Hatirjheel",
    # ── Narayanganj (nearby, sometimes lumped) ──
    # (exclude — not Dhaka city proper)

    # Generic "Dhaka" mentions
    "রাজধানী": "Dhaka",  # "rājdhānī" = capital city
    "ঢাকা": "Dhaka",
}

# ── Crime type keyword map (Bengali → English) ──────────────────────────────
CRIME_KEYWORDS: List[Tuple[str, str, int]] = [
    # (Bengali keyword, English type, base_severity)
    ("হত্যা",        "Murder",             10),
    ("খুন",          "Murder",             10),
    ("গুলি",         "Shooting",            9),
    ("ছুরিকাঘাত",   "Stabbing",            9),
    ("ছুরি",         "Stabbing",            8),
    ("ধর্ষণ",        "Rape",               10),
    ("যৌন নির্যাতন","Sexual Assault",      10),
    ("ডাকাতি",       "Robbery",             9),
    ("ছিনতাই",       "Snatching",           8),
    ("রাহাজানি",     "Mugging",             8),
    ("চুরি",         "Theft",               5),
    ("চাঁদাবাজি",   "Extortion",           7),
    ("অপহরণ",        "Kidnapping",          9),
    ("গুম",          "Enforced Disappearance", 9),
    ("মাদক",         "Drug Trafficking",    8),
    ("মাদকদ্রব্য",  "Drug Trafficking",    8),
    ("বোমা",         "Bomb/Explosion",      9),
    ("বিস্ফোরণ",    "Bomb/Explosion",      9),
    ("অগ্নিকাণ্ড",  "Arson/Fire",          7),
    ("আগুন",         "Arson/Fire",          6),
    ("মারপিট",       "Assault",             6),
    ("নির্যাতন",     "Torture/Assault",     7),
    ("আত্মহত্যা",   "Suspicious Death",    4),
    ("প্রতারণা",     "Fraud",               5),
    ("সাইবার",       "Cyber Crime",         5),
    ("জালিয়াতি",   "Fraud",               5),
    ("ধাওয়া",       "Chase/Attack",        6),
    ("সংঘর্ষ",      "Clash/Violence",      7),
    ("অস্ত্র",      "Arms/Weapons",        7),
    ("গ্রেপ্তার",   "Arrest",              4),
    ("আটক",         "Arrest",              4),
]

# ── Police station approximate mapping ──────────────────────────────────────
AREA_TO_STATION: Dict[str, str] = {
    "Sadarghat": "Kotwali", "Kotwali": "Kotwali", "Bangshal": "Bangshal",
    "Chawkbazar": "Chawkbazar", "Lalbagh": "Lalbagh", "Hazaribagh": "Hazaribagh",
    "Kamrangirchar": "Kamrangirchar", "Motijheel": "Motijheel",
    "Gulistan": "Paltan", "Paltan": "Paltan", "Shahbagh": "Shahbagh",
    "Ramna": "Ramna", "Segunbagicha": "Ramna", "Mirpur": "Mirpur",
    "Pallabi": "Pallabi", "Kafrul": "Kafrul", "Sheorapara": "Mirpur",
    "Mohammadpur": "Mohammadpur", "Dhanmondi": "Dhanmondi",
    "Adabar": "Adabar", "Shyamoli": "Mohammadpur", "Rayerbazar": "Mohammadpur",
    "Gulshan": "Gulshan", "Banani": "Gulshan", "Baridhara": "Gulshan",
    "Nikunja": "Khilkhet", "Uttara": "Uttara", "Turag": "Turag",
    "Dakshin Khan": "Dakshin Khan", "Uttarkhan": "Uttarkhan",
    "Tejgaon": "Tejgaon", "Farmgate": "Tejgaon",
    "Badda": "Badda", "Rampura": "Rampura", "Banasree": "Rampura",
    "Khilgaon": "Khilgaon", "Sabujbagh": "Sabujbagh", "Basabo": "Sabujbagh",
    "Demra": "Demra", "Jatrabari": "Jatrabari", "Matuail": "Demra",
    "Keraniganj": "Keraniganj", "Wari": "Wari", "Sutrapur": "Sutrapur",
    "Azimpur": "Lalbagh", "Shyampur": "Shyampur", "Kadamtali": "Kadamtali",
    "Hatirjheel": "Rampura",
}

# ── Known coordinates for common Dhaka areas ─────────────────────────────────
# Fallback if Nominatim fails; avoids spamming the geocoding API
KNOWN_COORDS: Dict[str, Tuple[float, float]] = {
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
    "Uttara":        (23.8759, 90.3795),
    "Turag":         (23.8994, 90.3527),
    "Dakshin Khan":  (23.8617, 90.4239),
    "Uttarkhan":     (23.8980, 90.4068),
    "Tejgaon":       (23.7670, 90.3930),
    "Farmgate":      (23.7545, 90.3878),
    "Badda":         (23.7766, 90.4263),
    "Rampura":       (23.7620, 90.4220),
    "Banasree":      (23.7580, 90.4353),
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
    "Hatirjheel":    (23.7607, 90.4170),
    "Cantonment":    (23.7960, 90.3980),
    "Dhaka":         (23.7561, 90.3861),
}


# ════════════════════════════════════════════════════════════════════════════
class ProthomAloScraper:
    """Async scraper for Prothom Alo crime articles (Dhaka only)."""

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
                "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

    # ── Sitemap-based URL collection ─────────────────────────────────────────
    async def get_article_urls(self, section: str, max_pages: int = 10) -> List[str]:
        """
        Collect article URLs from the news sitemap.
        `section` is used as a URL path filter (e.g. '/bangladesh/crime').
        `max_pages` controls how many sitemap pages to fetch (each ~1000 URLs).
        """
        # Prothom Alo publishes a news sitemap; also has paginated sitemaps
        sitemap_urls = [
            "https://www.prothomalo.com/news_sitemap.xml",
        ]
        # Add paginated sitemaps up to max_pages
        for i in range(1, max_pages):
            sitemap_urls.append(
                f"https://www.prothomalo.com/news_sitemap.xml?page={i}"
            )

        seen: set = set()
        matched: List[str] = []

        for sitemap_url in sitemap_urls:
            log.info("Sitemap  %s", sitemap_url)
            html = await self._get(sitemap_url)
            if not html:
                break

            # Extract all prothomalo.com article URLs from sitemap text
            found_urls = re.findall(
                r"https://www\.prothomalo\.com(/bangladesh/(?:crime|capital)/[A-Za-z0-9_-]+)",
                html,
            )
            new_count = 0
            for path in found_urls:
                full = BASE_URL + path
                if full not in seen:
                    seen.add(full)
                    matched.append(full)
                    new_count += 1

            log.info("  → %d new crime/capital URLs (total: %d)", new_count, len(matched))

            if new_count == 0:
                log.info("  No new URLs — stopping sitemap pagination.")
                break

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

        # Body text — look for article-body section
        body_div = (
            soup.find("div", class_=re.compile(r"article.?body|story.?content|detail", re.I))
            or soup.find("article")
        )
        body_text = body_div.get_text(" ", strip=True) if body_div else ""
        full_text = title + " " + body_text

        # ── Dhaka filter ──────────────────────────────────────────────────────
        dhaka_area = self._detect_dhaka_area(full_text)
        if dhaka_area is None:
            log.debug("Skip (not Dhaka): %s", title[:60])
            return None

        # ── Date ─────────────────────────────────────────────────────────────
        pub_date = self._extract_date(soup, full_text)

        # ── Crime type & severity ─────────────────────────────────────────────
        crime_type, severity = self._classify_crime(full_text)

        # ── Time of day ──────────────────────────────────────────────────────
        time_of_day = self._classify_time(full_text)

        # ── Coordinates ──────────────────────────────────────────────────────
        coords = await self._get_coords(dhaka_area)
        if coords is None:
            log.debug("Skip (no coords): %s — %s", dhaka_area, title[:50])
            return None

        lat, lng = coords

        # ── Police station ────────────────────────────────────────────────────
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
            "source": "Prothom Alo",
            "_title": title,
            "_url": url,
        }

    # ── Date extraction ──────────────────────────────────────────────────────
    def _extract_date(self, soup: BeautifulSoup, text: str) -> str:
        """Extract publication date as YYYY-MM-DD."""
        # Try <meta property="article:published_time">
        meta = soup.find("meta", property="article:published_time")
        if meta and meta.get("content"):
            try:
                return datetime.fromisoformat(meta["content"][:10]).strftime("%Y-%m-%d")
            except ValueError:
                pass

        # Try <time> tag
        time_tag = soup.find("time")
        if time_tag:
            dt = time_tag.get("datetime") or time_tag.get_text(strip=True)
            if dt:
                parsed = self._parse_bengali_date(dt)
                if parsed:
                    return parsed

        # Regex in body text: "০৮ ফেব্রুয়ারি ২০২৬"
        m = re.search(r"([\u09E6-\u09EF]{1,2})\s+([\u0980-\u09FF]+)\s+([\u09E6-\u09EF]{4})", text)
        if m:
            parsed = self._parse_bengali_date(m.group(0))
            if parsed:
                return parsed

        return date.today().strftime("%Y-%m-%d")

    def _parse_bengali_date(self, text: str) -> Optional[str]:
        """Try to parse a Bengali date string like '০৮ ফেব্রুয়ারি ২০২৬'."""
        text = text.translate(BN_DIGITS).strip()
        for bn, en in BN_MONTHS.items():
            text = text.replace(bn, en)
        # Try common formats
        for fmt in ("%d %B %Y", "%B %d, %Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M"):
            try:
                return datetime.strptime(text[:20].strip(), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None

    # ── Dhaka area detection ─────────────────────────────────────────────────
    def _detect_dhaka_area(self, text: str) -> Optional[str]:
        """
        Return the first matching Dhaka area found in the text,
        or None if the article is not about Dhaka.
        """
        for keyword, area_name in DHAKA_AREAS.items():
            if keyword in text:
                return area_name
        return None

    # ── Crime classification ─────────────────────────────────────────────────
    def _classify_crime(self, text: str) -> Tuple[str, int]:
        """Return (crime_type_en, severity_score)."""
        for keyword, crime_type, base_sev in CRIME_KEYWORDS:
            if keyword in text:
                # Boost severity if violence indicators present
                violence_words = ["আহত", "নিহত", "রক্ত", "গুলি", "ছুরি", "মারধর", "মৃত্যু"]
                boost = 1 if any(w in text for w in violence_words) else 0
                severity = min(10, base_sev + boost)
                return crime_type, severity
        return "Crime", 5

    # ── Time of day ──────────────────────────────────────────────────────────
    def _classify_time(self, text: str) -> str:
        """Return 'Day' or 'Night' based on article text clues."""
        night_words = [
            "রাত", "রাতে", "রাতের", "মধ্যরাত", "ভোররাত",
            "সন্ধ্যা", "সন্ধ্যায়", "সন্ধ্যার", "রাত্রি",
            "রাত ১", "রাত ২", "রাত ৩", "রাত ৪", "রাত ৫",
            "রাত ১১", "রাত ১২", "রাত ১০",
        ]
        day_words = [
            "সকাল", "দুপুর", "বিকেল", "ভোর",
            "সকালে", "দুপুরে", "বিকেলে",
        ]
        night_score = sum(1 for w in night_words if w in text)
        day_score   = sum(1 for w in day_words   if w in text)
        return "Night" if night_score >= day_score else "Day"

    # ── Geocoding ────────────────────────────────────────────────────────────
    async def _get_coords(self, area: str) -> Optional[Tuple[float, float]]:
        """
        Return (lat, lng) for an area name.
        Uses in-memory lookup first, then Nominatim as fallback.
        Results are cached.
        """
        if area in self._geocode_cache:
            return self._geocode_cache[area]

        # Known coords — no network needed
        if area in KNOWN_COORDS:
            self._geocode_cache[area] = KNOWN_COORDS[area]
            return KNOWN_COORDS[area]

        # Nominatim fallback
        coords = await self._nominatim(f"{area}, Dhaka, Bangladesh")
        if coords is None:
            coords = await self._nominatim(f"Dhaka, Bangladesh")

        self._geocode_cache[area] = coords
        return coords

    async def _nominatim(self, query: str) -> Optional[Tuple[float, float]]:
        """Call Nominatim geocoding API."""
        try:
            await asyncio.sleep(1.0)  # Nominatim rate-limit: 1 req/s
            r = await self.client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": "1"},
                headers={"User-Agent": "DhakaCrimeScraper/1.0 (academic research)"},
            )
            data = r.json()
            if data:
                return (float(data[0]["lat"]), float(data[0]["lon"]))
        except Exception as ex:
            log.warning("Nominatim error for '%s': %s", query, ex)
        return None

    # ── Main run ─────────────────────────────────────────────────────────────
    async def run(self, max_pages: int = 10, out_file: Path = OUTPUT_FILE) -> List[Dict]:
        """
        Full pipeline:
          1. Collect article URLs from listing pages
          2. Parse each article
          3. Assign sequential IDs
          4. Save JSON
        """
        all_urls: List[str] = []
        # Sitemap collects crime+capital URLs in one pass; section arg is unused
        urls = await self.get_article_urls("/bangladesh/crime", max_pages=max_pages)
        all_urls.extend(urls)

        # Deduplicate
        all_urls = list(dict.fromkeys(all_urls))
        log.info("Total unique article URLs: %d", len(all_urls))

        crimes: List[Dict] = []
        for idx, url in enumerate(all_urls, 1):
            log.info("[%d/%d] Parsing %s", idx, len(all_urls), url)
            record = await self.parse_article(url)
            if record:
                crimes.append(record)
                log.info("  ✓  %s  (%s, %s)", record["location_name"],
                         record["crime_type"], record["date"])

        # Assign IDs and strip internal fields
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

        # Save
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=2, ensure_ascii=False)

        log.info("Saved %d Dhaka crime records → %s", len(final), out_file)
        return final

    async def close(self):
        await self.client.aclose()


# ── CLI ──────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Scrape Prothom Alo crime news for Dhaka")
    p.add_argument("--pages",  type=int,  default=10,
                   help="Max listing pages per section (default: 10)")
    p.add_argument("--out",    type=str,  default=str(OUTPUT_FILE),
                   help="Output JSON file path")
    p.add_argument("--delay",  type=float, default=DELAY_SECONDS,
                   help="Delay between requests in seconds (default: 1.5)")
    return p.parse_args()


async def main():
    args = parse_args()
    scraper = ProthomAloScraper(delay=args.delay)
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
