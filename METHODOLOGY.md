# Route Shield — Technical Documentation

## Crime-Aware Smart Navigation for Dhaka City

---

## 7. Applied Methodology

Here is me explaining how **Route Shield** really works, in plain words. I broke it into the usual three parts: what we take in, how we process it, and how we show the result. Keeping it simple like this helps me remember what is happening where.

---

### 7.1 Workflow

Route Shield is built around three buckets: **Input**, **Processing**, and **Output**. Separating them keeps the mental model sane. I go through each one below.

Fig 1: High-level view of the Route Shield workflow

---

### 7.2 Input

Input is everything we collect: what you type, what you prefer, and the crime data we lean on for scoring. I sliced it into three pieces.

#### 7.2.1 Location Input and Address Search

Making the location box feel right took some fiddling. I lean on live geocoding with the OpenStreetMap Nominatim API. While you type, it keeps pinging Nominatim and fills a dropdown.

The annoying bit was ambiguity. "Mirpur" is not just in Dhaka. By default Nominatim does not know which one you mean. I ended up filtering to Bangladesh and boosting anything that says "Dhaka" in the name. It works most of the time; super generic names can still sneak in.

- **Autocomplete Suggestions:** Live Nominatim suggestions, filtered to favor Dhaka, Bangladesh.
- **Suggestion Dropdown:** `SuggestionDropdown.tsx` lists ranked results with the place type so you can pick faster.
- **Geocoding:** Once you select, we save the lat/long and use it everywhere else.

Fig 2: Route Search panel with the dropdown visible

**Implementation Details:**
Pieces live in `RouteSearch.tsx`, `SuggestionDropdown.tsx`, `useSuggestions.ts`, and `geocodeAddress()` inside `routeService.ts`.

#### 7.2.2 Travel Time and Safety Preferences

This is the part that makes Route Shield feel different. Before scoring, it asks about your travel context so the score is not generic.

- **Travel Time Selection:** Pick **Day** or **Night**. Crimes in that time get 2.0x weight; the other time drops to 0.5x. A midnight assault matters more if you are actually out at midnight.
- **Risk Tolerance Level:** Three moods — _Cautious_ (1.5x), _Balanced_ (1.0 default), _Time-Focused_ (0.6x if you just want speed).
- **Crime Type Concerns:** You set how much you care (0.5 to 2.0) about Violent, Property, Drug, and Minor crimes. If theft bugs you, push Property higher.

Fig 3: Safety Preferences with time, tolerance, and sliders

**Implementation Details:**
UI lives in `SafetyPreferencesPanel.tsx`. Types and weight maps live in `preferences.types.ts`.

#### 7.2.3 Crime Data Ingestion and Preprocessing

The score only makes sense if the crime data is decent. Here is how I collect, clean, and store it so lookups stay quick.

- **Data Sources:** Two JSON sets (2024, 2025) plus scrapers for Bangladeshi news sites.
- **Web Scraping:** Two scrapers. _Prothom Alo_ handles Bengali and uses a 100+ place-name dictionary to spot Dhaka incidents. _Daily Star_ does the English side. They miss some things and mislabel a few, but across lots of articles the signal is good enough.
- **Text Normalization:** Bengali digits and month names get converted to ASCII so dates parse the same way.
- **Geocoding:** Each matched place name goes through Nominatim for lat/long.
- **Metadata Annotation:** Every record gets type, severity (1–10), time of day, date, police station area, and source.
- **Storage:** Stored in MongoDB Atlas as GeoJSON Points with a `2dsphere` index so `$near` queries stay fast.
- **Crawl Rate Limiting:** Both scrapers pause 1.5 seconds per request. Slower would be polite but painfully slow.

**Implementation Details:**
Pipelines live in `prothomalo_scraper.py`, `dailystar_scraper.py`, and `crime_service.py`. Schemas are `CrimeRecord` and `CrimeInDB` in `crime_models.py`.

---

### 7.3 Processing

Processing is where raw input turns into something you can act on. This covers route aggregation, crime lookups, scoring math, and knocking out duplicate routes.

#### 7.3.1 Multi-Service Route Aggregation

One routing engine alone was boring. In Dhaka it keeps picking the same big roads. I call **three** at once:

- **OSRM (Open Source Routing Machine):** Fast, public, OSM-based.
- **GraphHopper:** Graph-based, 500 free requests daily.
- **OpenRouteService (ORS):** Feature-rich, 2,000 free daily.

All three fire together. If one times out, it just returns an empty list and we keep going. The flow is simple:

1. **Parallel Fetch** — hit all three.
2. **Merge** — dump them into one list.
3. **Sort by Duration** — fastest first.
4. **Deduplicate** — drop near-clones (see 7.3.4).
5. **Re-Index** — renumber from 1.
6. **Slice** — keep the top N (default 3).

Fig 4: Three routing calls merge into one deduped, ranked set

**Implementation Details:**
`MultiRouteService` in `multi_route_service.py` wraps `osrm_service.py`, `graphhopper_service.py`, and `ors_service.py`.

#### 7.3.2 Crime Data Analysis

The backend grabs crimes from MongoDB for scoring and for the dashboard. Highlights:

- **Geospatial Querying:** Uses MongoDB `$near` on `2dsphere` GeoJSON Points so the DB does the heavy lifting.
- **Time-Based Filtering:** Day/night filters so we only score the relevant crimes.
- **Statistics Aggregation:** Totals, day/night split, type distribution, mean severity, and hotspots over a threshold.
- **Data Sources:** Dhaka Metropolitan Police, _Prothom Alo_, _The Daily Star_, Bangladesh Police for 2024–2025.

**Math note:**

Crimes in category $k$:

$$\text{Count}_k = \sum_{i=1}^{N} \mathbf{1}\{\text{crime}_i \in \text{category}_k\}$$

$N$ is the total crimes; $\mathbf{1}\{\cdot\}$ is 1 when true.

**Implementation Details:**
All crime logic is in `CrimeService` (`crime_service.py`). Schemas sit in `crime_models.py`.

#### 7.3.3 Safety Score Calculation

This is the mathy bit. Each route runs through four steps.

**Step 1 — Crime proximity detection:**

For each crime point $c$ and each segment $[p_i, p_{i+1}]$, I find the closest perpendicular distance. Haversine turns coordinate deltas into km:

$$d = 2R \arcsin\!\left(\sqrt{\sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)}\right)$$

$R = 6371$ km. Crimes within 500 m count as near the route.

**Step 2 — Per-crime risk contribution:**

Each nearby crime gets a risk value from six factors:

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

- $d_f$: distance factor $1 - d_{\min} / \text{threshold}$ (closer hurts more).
- $s_f$: severity / 10.
- $t_f$: 2.0 if crime time matches travel time, 0.5 otherwise.
- $w_{\text{type}}$: type weight (Murder/Rape 2.0 down to Cybercrime 0.5).
- $w_{\text{concern}}$: your concern (0.5–2.0).
- $w_{\text{tolerance}}$: tolerance multiplier (Cautious 1.5, Balanced 1.0, Time-Focused 0.6).

**Step 3 — Combined risk computation:**

Risk is split into per-crime severity and density, then blended 70/30:

$$\text{avgRiskNorm} = \min\!\left(\frac{\sum \text{risk}_c / N_{\text{near}}}{40},\; 1\right)$$

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N_{\text{near}})}{4},\; 1\right)$$

$$\text{combinedRisk} = 0.70 \times \text{avgRiskNorm} + 0.30 \times \text{densityNorm}$$

The log keeps a pile of minor crimes from beating a few serious ones.

**Step 4 — Safety score output:**

$$\text{safetyScore}_{100} = \max\!\left(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}}\right)$$

$$\text{safetyScore} = \frac{\text{safetyScore}_{100}}{10}$$

$N_{\text{highRisk}}$ counts segments with three or more nearby crimes. Risk level:

$$\text{riskLevel} = \begin{cases} \text{Low} & \text{safetyScore} \geq 7.5 \\ \text{Medium} & 5.0 \leq \text{safetyScore} < 7.5 \\ \text{High} & \text{safetyScore} < 5.0 \end{cases}$$

Fig 5: Flow from geometry and crimes through the six factors to the final score

**Implementation Details:**
All in `safetyScoring.ts`: Haversine, projection, six-factor risk, log density, 70/30 blend, labels.

#### 7.3.4 Route Deduplication and Ranking

The three engines can return near-clones. Showing all is pointless. I drop near-duplicates with a **dual-ratio threshold**. Routes $A$ and $B$ are duplicates only if both are true:

$$\frac{|\Delta_{\text{duration}}|}{t_A} \leq \delta \quad \text{AND} \quad \frac{|\Delta_{\text{distance}}|}{d_A} \leq \delta$$

Here $\delta = 0.08$ (8%). The AND is important: if time is close but distance is not, I keep both. After dedupe, I sort by safety so the safest gets the "Recommended" badge.

**Implementation Details:**
In `_deduplicate()` inside `MultiRouteService`, with `DUPLICATE_THRESHOLD = 0.08`.

---

### 7.4 Output

Output is how everything shows up: on the map, on the cards, in the dashboard, and in navigation handoff.

#### 7.4.1 Map Visualization and Route Display

The map is built with Leaflet.js via React-Leaflet and stacks a bunch of layers.

- **Route Polylines:** Each route gets its own color. Hover or click and it turns gold and thicker so you can spot it.
- **Crime Heatmap:** Optional circles colored by severity — red (8–10), orange (5–7), yellow (1–4).
- **High-Risk Segment Highlighting:** Segments with 3+ nearby crimes get flagged.
- **Crime Highlight on Selection:** "View Crimes" on a card filters the map to that route’s crimes only.
- **Police Stations Overlay:** Optional station layer if you want context.
- **Auto-Zoom:** After a search, the map fits all routes.
- **Legend:** On-map legend for safety and severity colors.

Fig 6: Map with three routes and severity-colored markers

**Implementation Details:**
All in `MapView.tsx`.

#### 7.4.2 Interactive Dashboard and Insights

The dashboard gives a city-wide snapshot, separate from route searches. It shows:

- **Crime Count Summary:** Total crimes and day/night split.
- **Crime Type Distribution:** Proportion chart by category.
- **Average Severity:** City-wide mean.
- **High-Severity Areas:** Places above a severity threshold.
- **Data Source Attribution:** Sources and their coverage period.

**Implementation Details:**
Dashboard lives in `Dashboard.tsx`, uses `GET /api/crimes/statistics` and `get_crime_statistics()` in `crime_service.py`.

#### 7.4.3 Route Comparison and Safety Reports

The comparison panel puts each route on a card so you can scan fast.

- **Safety Score Badge:** 0–10, colored green (Low), orange (Medium), red (High).
- **Risk Level Label:** Simple text — "Safe to travel", "Moderate risk", "High risk — caution advised".
- **Distance and Duration:** e.g., "5.2 km · 14 mins".
- **Recommended Banner:** Safest route gets tagged.
- **Nearby Crime Count:** Crimes within 500 m.
- **Crime Detail Modal:** Expand to see type, place, severity, time, date, source.

Fig 7: Three cards: 8.2 (Recommended/green), 6.1 (orange), 4.3 (red)

**Implementation Details:**
Cards and modal live in `RouteComparison.tsx`.

#### 7.4.4 Navigation Export

Once you pick a route, you usually want to follow it. I hand off to Google Maps with waypoints baked in.

- **Google Maps Export:** Each card has "Navigate". It builds a Maps URL with up to 8 sampled waypoints so Google follows the intended path instead of rerouting.
- **Practical Use:** On mobile it opens the Maps app for turn-by-turn while you still have the safety context in the browser.

**Implementation Details:**
`buildGoogleMapsNavUrl()` in `RouteComparison.tsx` builds the URL and samples waypoints.

---

### 7.5 Models and Their Significance

These are the math pieces behind the app. Each has a job.

#### 7.5.1 Haversine Formula (Geodetic Distance)

Haversine gives great-circle distance from latitude/longitude. Every distance check calls this.

**Math:**

$$a = \sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2R\arcsin(\sqrt{a})$$

**Where it’s used:**

- Distance from crimes to route segment endpoints.
- Checking if a crime sits within 500 m.
- Backend radius lookups.

#### 7.5.2 Point-to-Segment Projection (Perpendicular Distance)

Roads are segments, not just points. If I only looked at vertices, crimes near the middle of a long segment could look far. Projection fixes that.

**Math:**

For point $P$ and segment $[A, B]$:

$$t = \frac{(P - A) \cdot (B - A)}{\|B - A\|^2}$$

Closest point $Q$:

$$Q = \begin{cases} A & t < 0 \\ B & t > 1 \\ A + t(B - A) & 0 \leq t \leq 1 \end{cases}$$

Then $d = \text{Haversine}(P, Q)$.

**Why it matters:**

Without it, crimes near mid-segments get undercounted, making routes look safer. Projection is cheap, so I keep it.

#### 7.5.3 Log-Scaled Crime Density Normalization

Raw counts would punish an area with many small incidents more than an area with a few severe ones. That feels wrong. A log scale tones big counts down.

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N)}{4},\; 1\right)$$

| $N$ (crimes) | Linear (uncapped) | Log-Normalized |
| ------------ | ----------------- | -------------- |
| 1            | 0.05              | 0.17           |
| 5            | 0.25              | 0.45           |
| 10           | 0.50              | 0.60           |
| 20           | 1.00              | 0.76           |
| 50           | 2.50              | 0.98           |

With the log, 50 crimes (0.98) is only a bit higher than 20 (0.76). Density is capped at 30% of the blend, so severity still leads.

#### 7.5.4 Multi-Factor Weighted Safety Scoring Model

This is the core model. Six factors per crime get multiplied, summed, and turned into a 0–10 safety score.

**Math:**

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

$$\text{safetyScore} = \frac{\max(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}})}{10}$$

**Why each piece matters:**

- **Personalization:** Concern weights and tolerance come from the user, so the same route can score differently for different people.
- **Crime type differentiation:** Violent crimes up to 2.0x, minor ones 0.5x — blunt but tracks real risk.
- **Temporal relevance:** Without the time factor, day and night would look the same, which misses Dhaka night risk.

---

### 7.6 Code Implementation Overview

Each module maps to a set of files. Quick rundown:

#### 7.6.1 `multi_route_service.py`

Routing orchestrator. Fires three services in parallel, merges, dedupes with the dual-ratio rule, reindexes, and returns the ranked list. If one service fails, the others still return.

#### 7.6.2 `crime_service.py`

Handles MongoDB crime collection: full pulls, `$near` radius queries, day/night filters, city stats, and CRUD.

#### 7.6.3 `safetyScoring.ts`

Most math-heavy file. Haversine, projection, six-factor risk, log density, 70/30 blend, score classes, and the friendly text on cards.

#### 7.6.4 `routeService.ts`

Frontend API glue: Nominatim geocoding, backend routes, crime fetch, scoring handoff, and polyline decode.

#### 7.6.5 `prothomalo_scraper.py` / `dailystar_scraper.py`

Scrapers for Bengali and English news. Prothom Alo uses a 100+ Bengali keyword list plus digit/month translation, then geocodes via Nominatim. Daily Star mirrors it in English. Both pause 1.5 seconds per request.

---

## 8. User Manual and User Interface

Route Shield is a web app for Dhaka folks who want safer routes for the time they are actually traveling. It uses real crime data and scores based on your context, not a generic average.

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

Here is how a normal session goes.

#### 8.2.1 Accessing the Application

No login needed. It opens to the map and search panel, ready to use.

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

These were my testing goals and the cases I tried for the core features.

### 9.1 High Level Description of Testing Goals

I wanted to check:

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

This doc walked through how **Route Shield: Crime-Aware Smart Navigation for Dhaka City** works — the architecture, data ingestion, scoring, and UI.

Using three routing services, six-factor crime scoring, and user-tuned preferences is not the only possible design, but the ten test cases suggest it hits the main goals reliably. Routes load, scores react to preferences and time of day, dedupe handles convergence, and partial failures do not break the flow.

There are limits. Data quality depends on scrapers and sources, which have gaps. The 500 m proximity threshold is a practical default and could be user-set. Crime type weights are reasoned guesses; survey-based weights would be nicer. These are common crime-analysis tradeoffs and matter when reading the scores.

Likely next steps: real-time news feeds to shorten the delay from incident to database; walking and public transport modes; expansion to other Bangladeshi cities; and hooking into any future Bangladesh Police open data.

Route Shield is an early try at safety-aware navigation with real crime data for Dhaka. We will see how it holds up as the city and its patterns change.

---

_Route Shield © 2025 | Developed by Eftekhar Mahmud Efty_
