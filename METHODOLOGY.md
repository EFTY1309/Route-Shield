# Route Shield — Technical Documentation

## Crime-Aware Smart Navigation for Dhaka City

---

## 7. Applied Methodology

This chapter is me walking through how **Route Shield** actually works. I split it into the big pieces: how we take input, how we process it, and how we show the result. Breaking it up like this makes it easier to see what each part is doing at any point.

---

### 7.1 Workflow

At the top level, Route Shield has three chunks: **Input**, **Processing**, and **Output**. Keeping them separate helps keep the code and the mental model clear. I cover each chunk below.

Fig 1: High-level view of the Route Shield workflow

---

### 7.2 Input

The Input module is everything we take in: the locations you type, your travel preferences, and the crime data we use for scoring. I split it into three small parts.

#### 7.2.1 Location Input and Address Search

Getting location input reliable was tricky. I use live geocoding with the OpenStreetMap Nominatim API. As you type, it hits Nominatim and shows a dropdown of possible places.

One early headache was ambiguity. "Mirpur" exists in more than one country. By default, Nominatim cannot guess Dhaka. So I filter by Bangladesh and prefer results with "Dhaka" in the display name. It works well most of the time, though very generic names can still slip through.

- **Autocomplete Suggestions:** Live suggestions from Nominatim, filtered to favor Dhaka, Bangladesh.
- **Suggestion Dropdown:** `SuggestionDropdown.tsx` lists ranked results with their place type so you can pick the right one.
- **Geocoding:** Once you choose a place, we store its latitude and longitude for all later routing and scoring.

Fig 2: Route Search panel with the autocomplete dropdown open

**Implementation Details:**
Location input lives in `RouteSearch.tsx`, `SuggestionDropdown.tsx`, the `useSuggestions.ts` hook, and the `geocodeAddress()` helper in `routeService.ts`.

#### 7.2.2 Travel Time and Safety Preferences

This is where Route Shield feels different from a regular navigation app. Instead of a one-size safety score, it asks about your travel context before scoring anything.

- **Travel Time Selection:** You pick **Day** or **Night**. Crimes from that period get a 2.0x weight; crimes from the other period drop to 0.5x. A midnight assault matters more to someone traveling at midnight.
- **Risk Tolerance Level:** Three choices — _Cautious_ (1.5x multiplier), _Balanced_ (1.0x default), _Time-Focused_ (0.6x if speed matters more).
- **Crime Type Concerns:** You set concern levels (0.5 to 2.0) for Violent, Property, Drug, and Minor crimes. If theft worries you, you can bump Property crimes higher.

Fig 3: Safety Preferences panel with time selector, tolerance, and category sliders

**Implementation Details:**
Controls are in `SafetyPreferencesPanel.tsx`. Types and weights are in `preferences.types.ts`.

#### 7.2.3 Crime Data Ingestion and Preprocessing

The scoring only works if the crime data is decent. This part explains how we collect, clean, and store it so queries stay fast.

- **Data Sources:** Two JSON datasets for 2024 and 2025 plus scrapers for Bangladeshi news sites.
- **Web Scraping:** Two scrapers. The _Prothom Alo_ scraper handles Bengali news and matches article text against a Bengali place-name dictionary (100+ entries) to find Dhaka incidents. The _Daily Star_ scraper does the English side. They are not perfect — keyword matching can miss or misplace some articles — but over many articles the signal holds.
- **Text Normalization:** Bengali digits and month names are converted to ASCII so dates store and parse cleanly.
- **Geocoding:** Matched place names go through Nominatim to get lat/long coordinates.
- **Metadata Annotation:** Each record gets crime type, severity (1–10), time of day, date, police station area, and source.
- **Storage:** Records are stored in MongoDB Atlas as GeoJSON Points with a `2dsphere` index, so we can use `$near` for fast radius queries.
- **Crawl Rate Limiting:** Both scrapers wait 1.5 seconds between requests. Slower would be gentler but too slow to be practical.

**Implementation Details:**
Pipelines live in `prothomalo_scraper.py`, `dailystar_scraper.py`, and `crime_service.py`. Schemas are `CrimeRecord` and `CrimeInDB` in `crime_models.py`.

---

### 7.3 Processing

This is where input turns into something useful. It includes route aggregation, crime retrieval, the safety scoring math, and deduping similar routes.

#### 7.3.1 Multi-Service Route Aggregation

Using one routing engine alone did not cut it. In Dhaka, a single service often sticks to the same big roads. So I call **three services at once**:

- **OSRM (Open Source Routing Machine):** Fast, public, OSM-based.
- **GraphHopper:** Graph-based, 500 free requests per day.
- **OpenRouteService (ORS):** Feature-rich, 2,000 free requests per day.

All three fire in parallel. If one times out, I just return an empty list for that service and keep the others. The pipeline:

1. **Parallel Fetch** — hit all three together.
2. **Merge** — pool all returned routes.
3. **Sort by Duration** — fastest first.
4. **Deduplicate** — drop near-identical routes (see 7.3.4).
5. **Re-Index** — renumber from 1.
6. **Slice** — keep the top N (default 3) for the frontend.

Fig 4: Three routing calls merging into one deduped, ranked list

**Implementation Details:**
Handled by `MultiRouteService` in `multi_route_service.py`, wrapping `osrm_service.py`, `graphhopper_service.py`, and `ors_service.py`.

#### 7.3.2 Crime Data Analysis

The backend pulls crimes from MongoDB both for scoring and for the dashboard. A few key points:

- **Geospatial Querying:** Uses MongoDB `$near` on `2dsphere` GeoJSON Points so the DB handles the spatial filter.
- **Time-Based Filtering:** Day/night filters keep only relevant crimes for the search.
- **Statistics Aggregation:** Computes totals, day/night split, type distribution, mean severity, and hotspots over a severity threshold.
- **Data Sources:** Dhaka Metropolitan Police, _Prothom Alo_, _The Daily Star_, and Bangladesh Police records for 2024–2025.

**Mathematical Notation:**

The count of crimes in category $k$ is:

$$\text{Count}_k = \sum_{i=1}^{N} \mathbf{1}\{\text{crime}_i \in \text{category}_k\}$$

$N$ is the total crimes; $\mathbf{1}\{\cdot\}$ is 1 when the condition is true.

**Implementation Details:**
All crime ops are in `CrimeService` (`crime_service.py`). Schemas are in `crime_models.py`.

#### 7.3.3 Safety Score Calculation

This is the math-heavy part. For each route, four steps run in order.

**Step 1 — Crime proximity detection:**

For every crime point $c$ and each segment $[p_i, p_{i+1}]$ of the route, I find the closest perpendicular distance. The Haversine formula turns coordinate differences into kilometers:

$$d = 2R \arcsin\!\left(\sqrt{\sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)}\right)$$

$R = 6371$ km (Earth radius). Crimes within 500 m are counted as near the route.

**Step 2 — Per-crime risk contribution:**

Each nearby crime gets a risk value using six weights:

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

- $d_f$: distance factor $1 - d_{\min} / \text{threshold}$ (closer crimes matter more).
- $s_f$: severity / 10.
- $t_f$: 2.0 if crime time matches chosen travel time, 0.5 otherwise.
- $w_{\text{type}}$: crime type weight (Murder/Rape 2.0 down to Cybercrime 0.5).
- $w_{\text{concern}}$: your concern for that category (0.5–2.0).
- $w_{\text{tolerance}}$: tolerance multiplier (Cautious 1.5, Balanced 1.0, Time-Focused 0.6).

**Step 3 — Combined risk computation:**

I split risk into two parts — average per-crime severity and crime density — then blend 70/30:

$$\text{avgRiskNorm} = \min\!\left(\frac{\sum \text{risk}_c / N_{\text{near}}}{40},\; 1\right)$$

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N_{\text{near}})}{4},\; 1\right)$$

$$\text{combinedRisk} = 0.70 \times \text{avgRiskNorm} + 0.30 \times \text{densityNorm}$$

The log keeps lots of small crimes from outweighing a few severe ones.

**Step 4 — Safety score output:**

$$\text{safetyScore}_{100} = \max\!\left(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}}\right)$$

$$\text{safetyScore} = \frac{\text{safetyScore}_{100}}{10}$$

$N_{\text{highRisk}}$ counts segments with three or more nearby crimes. Final risk level:

$$\text{riskLevel} = \begin{cases} \text{Low} & \text{safetyScore} \geq 7.5 \\ \text{Medium} & 5.0 \leq \text{safetyScore} < 7.5 \\ \text{High} & \text{safetyScore} < 5.0 \end{cases}$$

Fig 5: Flow from route geometry and crimes through the six-factor math to the final score and level

**Implementation Details:**
All in `safetyScoring.ts`: Haversine, segment projection, six-factor risk, log density, 70/30 blend, and risk labels.

#### 7.3.4 Route Deduplication and Ranking

Three engines can return almost identical routes. Showing all of them wastes space. I drop near-duplicates using a **dual-ratio threshold**. Routes $A$ and $B$ are duplicates only if both hold:

$$\frac{|\Delta_{\text{duration}}|}{t_A} \leq \delta \quad \text{AND} \quad \frac{|\Delta_{\text{distance}}|}{d_A} \leq \delta$$

with $\delta = 0.08$ (8%). The AND matters: if time is close but distance is not, the path might be different, so I keep it. After dedupe, routes are sorted by safety so the safest gets the "Recommended" tag.

**Implementation Details:**
In `_deduplicate()` inside `MultiRouteService`, with `DUPLICATE_THRESHOLD = 0.08`.

---

### 7.4 Output

Output is how we show everything: on the map, in the comparison cards, in the dashboard, and when exporting to navigation.

#### 7.4.1 Map Visualization and Route Display

The map uses Leaflet.js via React-Leaflet. It layers a lot at once.

- **Route Polylines:** Each route has its own color. Hover or click turns it gold with a thicker stroke so you can spot it.
- **Crime Heatmap:** Optional crime markers as circles colored by severity — red (8–10), orange (5–7), yellow (1–4).
- **High-Risk Segment Highlighting:** Segments with three or more nearby crimes get flagged.
- **Crime Highlight on Selection:** "View Crimes" on a route card filters the map to that route's crimes only.
- **Police Stations Overlay:** Optional station layer for context.
- **Auto-Zoom:** After search, the map fits all routes.
- **Legend:** On-map legend for safety and severity colors.

Fig 6: Map with three routes and the severity-colored crime markers

**Implementation Details:**
In `MapView.tsx`.

#### 7.4.2 Interactive Dashboard and Insights

The dashboard gives a city-wide view, separate from any search. It shows:

- **Crime Count Summary:** Total crimes, split by day and night.
- **Crime Type Distribution:** Chart of category proportions.
- **Average Severity:** City-wide mean severity.
- **High-Severity Areas:** Spots where severity stays above a threshold.
- **Data Source Attribution:** Sources and their coverage period.

**Implementation Details:**
Dashboard is in `Dashboard.tsx`, using `GET /api/crimes/statistics` and `get_crime_statistics()` in `crime_service.py`.

#### 7.4.3 Route Comparison and Safety Reports

The comparison panel shows each route as a card so you can compare quickly.

- **Safety Score Badge:** Score out of 10, colored green (Low), orange (Medium), red (High).
- **Risk Level Label:** Plain text: "Safe to travel", "Moderate risk", or "High risk — caution advised".
- **Distance and Duration:** e.g., "5.2 km · 14 mins".
- **Recommended Banner:** Top-scoring route is tagged.
- **Nearby Crime Count:** How many crimes within 500 m.
- **Crime Detail Modal:** Expand to see type, location, severity, time, date, and source for each nearby crime.

Fig 7: Three route cards with scores — 8.2 (Recommended/green), 6.1 (orange), 4.3 (red)

**Implementation Details:**
Cards and modal are in `RouteComparison.tsx`.

#### 7.4.4 Navigation Export

After picking a route, you probably want to follow it. I hand off to Google Maps with the geometry baked in.

- **Google Maps Export:** Each card has a "Navigate" button that builds a Maps URL. Up to 8 sampled waypoints are injected so Google sticks to the intended path instead of recalculating.
- **Practical Use:** On mobile, it opens in the Maps app for turn-by-turn while you still have the safety context open in the browser.

**Implementation Details:**
`buildGoogleMapsNavUrl()` in `RouteComparison.tsx` builds the URL and samples waypoints.

---

### 7.5 Models and Their Significance

These are the math models backing the navigation. Each one is here for a reason.

#### 7.5.1 Haversine Formula (Geodetic Distance)

Haversine gives great-circle distance from lat/long. Everything that checks distance calls this.

**Math:**

$$a = \sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2R\arcsin(\sqrt{a})$$

**Where it’s used:**

- Distance from crimes to route segment endpoints during proximity checks.
- Checking if a crime is within the 500 m threshold.
- Backend radius crime lookup.

#### 7.5.2 Point-to-Segment Projection (Perpendicular Distance)

Roads are line segments, not just points. If I only checked vertices, crimes near the middle of a long segment could look far away. Projection fixes that.

**Math:**

Given point $P$ and segment $[A, B]$:

$$t = \frac{(P - A) \cdot (B - A)}{\|B - A\|^2}$$

Closest point $Q$ on the segment:

$$Q = \begin{cases} A & t < 0 \\ B & t > 1 \\ A + t(B - A) & 0 \leq t \leq 1 \end{cases}$$

Then $d = \text{Haversine}(P, Q)$.

**Why it matters:**

Without this, crimes near the middle of long segments get undercounted, making routes look safer than they are. Projection is cheap and worth it.

#### 7.5.3 Log-Scaled Crime Density Normalization

Raw counts punish areas with many minor incidents more than areas with a few severe ones. That is backwards. Log scaling tones down big counts.

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N)}{4},\; 1\right)$$

| $N$ (crimes) | Linear (uncapped) | Log-Normalized |
| ------------ | ----------------- | -------------- |
| 1            | 0.05              | 0.17           |
| 5            | 0.25              | 0.45           |
| 10           | 0.50              | 0.60           |
| 20           | 1.00              | 0.76           |
| 50           | 2.50              | 0.98           |

With log scaling, 50 crimes (0.98) is only a bit higher than 20 (0.76). Density tops out at 30% of the final blend, so severity stays the main driver.

#### 7.5.4 Multi-Factor Weighted Safety Scoring Model

This is the core. Six factors per crime are multiplied, summed up, and turned into a 0–10 safety score.

**Math:**

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

$$\text{safetyScore} = \frac{\max(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}})}{10}$$

**What each part adds:**

- **Personalization:** Concern weights and tolerance come from the user, so the same route can score differently for different people.
- **Crime type differentiation:** Violent crimes up to 2.0x, minor ones 0.5x — simple but matches real risk differences.
- **Temporal relevance:** Without the time factor, day and night travelers would get the same score, which would miss Dhaka’s nighttime risk.

---

### 7.6 Code Implementation Overview

Each module maps to specific files. Quick rundown:

#### 7.6.1 `multi_route_service.py`

Routing orchestrator. Fires three services in parallel, merges results, dedupes with the dual-ratio rule, reindexes, and returns the ranked list. If one service fails, the others still return.

#### 7.6.2 `crime_service.py`

Handles MongoDB crime collection: full pulls, `$near` radius queries, day/night filters, city stats, and CRUD for records.

#### 7.6.3 `safetyScoring.ts`

The densest file. Haversine, segment projection, six-factor risk, log density, 70/30 blend, score classification, and the friendly text shown on cards.

#### 7.6.4 `routeService.ts`

Frontend API glue: Nominatim geocoding, backend route fetch, crime fetch, pass to scoring, and decode compressed polylines.

#### 7.6.5 `prothomalo_scraper.py` / `dailystar_scraper.py`

Scrapers for Bengali and English news. Prothom Alo uses a 100+ Bengali keyword dictionary plus digit/month translation to normalize, then geocodes via Nominatim. Daily Star does the English side. Both pause 1.5 seconds per request.

---

## 8. User Manual and User Interface

Route Shield is a web app for people in Dhaka who want safer routes for their time of travel. It uses real crime data and scores routes based on your context, not a generic average.

### 8.1 System Overview

- **Purpose:** Crime-aware navigation in Dhaka with scores tuned to your travel time and tolerance.
- **Target Users:**
  - Dhaka residents and commuters.
  - Researchers looking at crime patterns.
  - City planners or law enforcement teams.
- **Main Features:**
  - Three routing services queried together.
  - Safety scoring using real crimes plus your preferences.
  - Interactive city-wide crime heatmap.
  - Google Maps export with waypoints to preserve geometry.
  - City-wide crime analytics dashboard.

### 8.2 Route Shield User Manual

Here is a typical session from start to finish.

#### 8.2.1 Accessing the Application

No login. The app opens to the map and search panel. You can use it right away.

Fig 8: Home screen with map on the left and search/comparison on the right

#### 8.2.2 Interface Overview

On load you see:

- **Interactive Map:** Leaflet map of Dhaka. Heatmap on by default with color-coded markers.
- **Route Search Panel:** Origin/destination fields, travel time pickers, and Safety Preferences.
- **Route Comparison Panel:** Empty until you search; then it fills with route cards.
- **Analytics Dashboard:** In the "Analytics" tab — stats, distributions, and high-risk areas.
- **Header Controls:** Toggles for heatmap, police stations layer, and theme switch.

#### 8.2.3 Using Route Shield

**Step 1: Enter Origin and Destination**

- Click Origin. Type a Dhaka road, neighborhood, or landmark.
- Pick the right option from the dropdown.
- Do the same for Destination.

**Step 2: Select Travel Time and Preferences**

- Choose **Day** or **Night** for when you travel.
- Optionally open Safety Preferences and adjust tolerance and concern sliders.

**Step 3: Search for Routes**

- Click **Find Safe Routes**.
- The app queries OSRM, GraphHopper, and ORS, then scores routes against the crime DB.

**Step 4: View Results**

- Up to three cards appear with safety score, distance, time, and nearby crime count. The safest is marked "Recommended".
- Routes draw on the map in different colors; you can toggle them from the cards.

**Step 5: Inspect Crime Details**

- Click **View Crimes** to see a modal with type, place, severity, time, date, and source for nearby crimes.
- The map highlights those same crimes with larger markers.

**Step 6: Navigate**

- Click **Navigate** on your chosen route.
- Google Maps opens with up to 8 waypoints to keep the same path.

**Step 7: View Analytics (Optional)**

- Open **Analytics** to see city stats, type breakdowns, average severity, and top-risk areas.

### 8.3 Features and Functionalities

1. **Crime-Aware Multi-Route Generation**
   - Three routing services at once for variety.
   - Deduping removes near-identical routes so choices are real.

2. **Multi-Factor Safety Scoring**
   - Six-factor model: type, severity, distance, time, concern, tolerance.
   - Scores 0–10 with Low/Medium/High labels.

3. **Personalized Safety Preferences**
   - Sliders for tolerance and category concerns adjust scoring.
   - Takes effect on the next search.

4. **Interactive Crime Heatmap**
   - Toggle on/off for city-wide crimes.
   - Severity-colored markers with popups.

5. **Route Comparison Panel**
   - Side-by-side cards with scores, distance, time, crime count.
   - Clear "Recommended" tag on the safest.

6. **Crime Detail Inspection**
   - Per-route crime modal with matching map highlights.
   - Every record shows its source.

7. **Navigation Export**
   - One click to Google Maps with waypoints baked in.

8. **City Analytics Dashboard**
   - Aggregate crime view separate from routing.
   - Day/night split, type mix, average severity, and hotspot list.

### 8.4 Challenges the System Addresses

1. **No crime-aware navigation for Dhaka:** Usual apps optimize time or distance. This one brings crime data into the routing.
2. **Data scattered across languages/sources:** Police reports, Bengali and English news — needed separate scraping and normalization to unite them.
3. **Generic safety ratings:** Most apps ignore safety or give one generic score. Here preferences let a midnight traveler weigh assault differently from a daytime commuter worried about theft.
4. **Single-service route repetition:** One engine tends to repeat the same big roads. Three engines plus dedupe gives genuinely different options.

### 8.5 Access Route Shield

Run it locally like this:

**Frontend Setup:**

1. Clone the frontend repo.
2. Install deps: `npm install`
3. Start dev server: `npm run dev`
4. Opens at `http://localhost:5173`

**Backend Setup:**

1. Clone the backend repo.
2. Install Python packages: `pip install -r requirements.txt`
3. Set env vars: `MONGODB_URL`, `GRAPHHOPPER_API_KEY`, `ORS_API_KEY`
4. Start API: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

---

## 9. Test Report

Here are the testing goals and the cases I ran for the main features.

### 9.1 High Level Description of Testing Goals

I aimed to check:

- Routes load and draw correctly for valid Dhaka places.
- Scoring accounts for proximity, type weights, time of day, and preferences.
- Crime data flows cleanly from DB to map without loss.
- Preference changes move scores in the expected direction.
- Behavior when a routing service fails — no ugly errors for users.
- Deduping when services return almost the same route.
- Basic usability on normal desktop screens.

### 9.2 Test Cases

---

**Test Case 1: Route Search with Valid Locations**

Steps:

1. Origin "Gulshan 1" (pick from dropdown).
2. Destination "Motijheel" (pick from dropdown).
3. Click "Find Safe Routes".

Expected:

- Both geocode to Dhaka.
- At least one route on the map with correct polyline.
- Cards show distance, time, safety score.

Result: Passed. Three routes with good geometry and expected scores.

---

**Test Case 2: Autocomplete Suggestions Prioritize Dhaka**

Steps:

1. Type "Mirpur".
2. Watch the dropdown.

Expected:

- Dhaka results on top.
- No foreign results before local ones.

Result: Passed. Bangladesh filter and Dhaka check keep local results first.

---

**Test Case 3: Day vs. Night Safety Score Difference**

Steps:

1. Search Sadarghat to Farmgate with **Day**. Note scores.
2. Repeat with **Night**.

Expected:

- Night searches lower scores near nighttime crime clusters.
- Route order might change.

Result: Passed. Night crimes got 2.0x, day crimes 0.5x, scores shifted.

---

**Test Case 4: Safety Preferences Affect Route Scores**

Steps:

1. Search with **Balanced**. Record scores.
2. Switch to **Cautious** and search again.

Expected:

- Scores change with the 1.5x multiplier.
- High-crime routes drop more.

Result: Passed. Tolerance scaled risks and changed scores as expected.

---

**Test Case 5: Route Deduplication Removes Near-Identical Routes**

Steps:

1. Pick a short trip likely to converge across services.
2. Check if any two routes are within 8% on both time and distance.

Expected:

- No pair within 8% on both metrics survives.
- At least one distinct route per differing service stays.

Result: Passed. Dual-ratio threshold collapsed duplicates and kept distinct options.

---

**Test Case 6: Crime Heatmap Toggle**

Steps:

1. Load app; confirm markers.

2. Click **Hide Heatmap**.
3. Click **Show Heatmap**.

Expected:

- Hiding removes crime markers.
- Showing brings them back with correct colors/positions.

Result: Passed. Toggle only affects markers, not routes.

---

**Test Case 7: View Crimes Modal and Map Highlighting**

Steps:

1. Run a search.
2. On a card with nearby crimes, click **View Crimes**.

Expected:

- Modal lists crime type, severity, date, time, source.
- Map highlights only that route's crimes with larger markers.

Result: Passed. Modal and map filtering matched.

---

**Test Case 8: Google Maps Navigation Export**

Steps:

1. Run a search.
2. Click **Navigate** on the first card.

Expected:

- Google Maps opens with origin, destination, up to 8 waypoints.
- Path matches the Route Shield geometry.

Result: Passed. Maps opened with correct waypoints and path stayed accurate.

---

**Test Case 9: Partial Routing Service Failure Handling**

Steps:

1. Break one service (bad API key) to simulate timeout.
2. Run a search.

Expected:

- No error screen.
- Routes still come from the other two services.
- Panel looks normal.

Result: Passed. Failing service returned empty; others filled the panel cleanly.

---

**Test Case 10: Analytics Dashboard Data Accuracy**

Steps:

1. Open **Analytics**.
2. Note totals, day/night split, type distribution.
3. Compare with `/api/crimes/statistics`.

Expected:

- Dashboard totals match API.
- Day+Night equals total.
- Type percentages align.

Result: Passed. Dashboard matched the endpoint; aggregation was correct.

---

## 10. Conclusion

This doc covered how **Route Shield: Crime-Aware Smart Navigation for Dhaka City** works — architecture, ingestion, scoring, and the UI that shows it.

The approach — three routing services, six-factor crime-based scoring, and user-tuned preferences — is not the only way, but the ten test cases suggest it meets the core goals reliably. Routes load, scores react to preferences and time of day, dedupe handles convergence, and partial failures are graceful.

There are limits. Data quality depends on scrapers and sources, which have gaps. The 500 m proximity threshold is a practical default and could be user-set. Crime type weights are reasoned choices, but survey-based weights would be better. These are common issues in crime-analysis work and matter when interpreting the scores.

Next steps that seem most useful: real-time news feeds to cut delay from incident to database; support for walking and public transport; expansion to other Bangladeshi cities; and integration with any future Bangladesh Police open data.

Route Shield is an early take on safety-aware navigation with real crime data for Dhaka. Whether it stays solid as the city changes is an open, interesting question.

---

_Route Shield © 2025 | Developed by Eftekhar Mahmud Efty_
