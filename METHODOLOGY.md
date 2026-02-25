# Route Shield — Technical Documentation

## Crime-Aware Smart Navigation for Dhaka City

---

## 7. Applied Methodology

This chapter walks through the internal workings of **Route Shield** (Crime-Aware Smart Navigation) — covering its overall workflow, how user input gets handled, what happens in the processing layer, and how the final output actually reaches the user. Breaking it down this way hopefully makes it easier to see which part of the system is doing what at any given point in the navigation process.

---

### 7.1 Workflow

At the highest level, Route Shield is structured around three modules: **Input**, **Processing**, and **Output**. Splitting the system this way was a deliberate design choice — it keeps concerns separated and makes it far easier to reason about individual components without getting lost in the whole system at once. Each is covered in the sections that follow.

Fig 1: High-Level Abstraction of Implemented Route Shield Workflow

---

### 7.2 Input

The Input module handles everything that comes from the user — location data, travel preferences, and the background crime records that feed into the scoring engine. It's made up of three distinct sub-modules, each serving a different aspect of this intake process.

#### 7.2.1 Location Input and Address Search

Getting location input right was one of the trickier parts of the system. The approach here is real-time geocoding through the OpenStreetMap Nominatim API — as the user types, the system starts querying Nominatim and surfaces candidate locations in a dropdown.

One issue that came up early in development was ambiguity. "Mirpur," for instance, refers to areas in both Bangladesh and Kashmir, and Nominatim by default has no way to know which the user means. To address this, results are filtered by the Bangladesh country code and further narrowed by the presence of "Dhaka" in the display name. In practice this appears to work well, though edge cases with very generic place names could still theoretically surface irrelevant results.

- **Autocomplete Suggestions:** Live location suggestions from Nominatim, filtered to prioritize Dhaka, Bangladesh.
- **Suggestion Dropdown:** The `SuggestionDropdown.tsx` component renders ranked results with place type labels so the user can pick the right one.
- **Geocoding:** Once a location is confirmed, the text resolves to a latitude/longitude pair that anchors every subsequent routing and scoring operation.

Fig 2: Route Search Panel with autocomplete suggestion dropdown active

**Implementation Details:**
Location input is handled through `RouteSearch.tsx`, `SuggestionDropdown.tsx`, the `useSuggestions.ts` hook, and the `geocodeAddress()` function in `routeService.ts`.

#### 7.2.2 Travel Time and Safety Preferences

This is, arguably, where Route Shield differentiates itself most clearly from a standard navigation app. Rather than computing one generic safety score for a route, the system asks the user to describe their actual travel context before scoring anything.

- **Travel Time Selection:** The user specifies whether they are traveling during **Day** or **Night**. This choice feeds directly into the time-of-day weighting factor: crimes that happened during the selected period are weighted at 2.0×, while those from the other period drop to 0.5×. A nighttime assault near a route is considerably more relevant to someone traveling at midnight than it is to a daytime commuter.
- **Risk Tolerance Level:** Three options — _Cautious_ applies a 1.5× multiplier to all crime risk contributions, _Balanced_ is the default at 1.0×, and _Time-Focused_ drops to 0.6× for users who are prioritizing speed over safety.
- **Crime Type Concerns:** Users individually set their concern level (0.5 to 2.0) for Violent Crimes, Property Crimes, Drug Crimes, and Minor Crimes. Someone particularly worried about theft can push the Property Crimes slider up and have the scoring reflect that.

Fig 3: Safety Preferences Panel showing travel time selector, risk tolerance control, and crime category concern sliders

**Implementation Details:**
Preference controls are in `SafetyPreferencesPanel.tsx`. The `SafetyPreferences` interface, category-to-weight mappings, and tolerance multipliers are defined in `preferences.types.ts`.

#### 7.2.3 Crime Data Ingestion and Preprocessing

The safety scoring engine is only as useful as the crime data it runs against. This sub-module covers how records get collected, cleaned, and stored in a form the system can query efficiently.

- **Data Sources:** Records come from two structured JSON datasets covering 2024 and 2025 respectively, plus automated scrapers targeting Bangladeshi news portals.
- **Web Scraping:** Two scrapers handle collection. The _Prothom Alo_ scraper works with Bengali-language crime news and matches article text against a translation dictionary of over 100 Bengali place names to identify Dhaka-area incidents. The _Daily Star_ scraper handles the English-language equivalent. Neither scraper is perfect — keyword matching against Bengali place names will occasionally miss articles or assign incorrect locations — but across a large corpus the signal tends to outweigh the noise.
- **Text Normalization:** Bengali digit characters and month names are converted to their ASCII equivalents to produce date strings that can be stored and parsed consistently.
- **Geocoding:** The matched location name from each article goes through Nominatim to produce latitude/longitude coordinates attached to the crime record.
- **Metadata Annotation:** Every record gets annotated with crime type, a severity score of 1 to 10, time of day, date, police station jurisdiction, and data source.
- **Storage:** Processed records are persisted in MongoDB Atlas as GeoJSON Point documents, which enables the `2dsphere` index and the `$near` operator used in radius-based geospatial queries.
- **Crawl Rate Limiting:** Both scrapers enforce a 1.5-second delay between requests. More conservative delays would be preferable but would lengthen data collection runs considerably.

**Implementation Details:**
The ingestion pipeline spans `prothomalo_scraper.py`, `dailystar_scraper.py`, and `crime_service.py`. Crime records are defined using the `CrimeRecord` and `CrimeInDB` Pydantic classes in `crime_models.py`.

---

### 7.3 Processing

The processing layer is where input data gets turned into something a user can actually act on. It covers four components — route aggregation across multiple services, crime data retrieval, the safety scoring calculation, and the deduplication step that keeps results from being repetitive.

#### 7.3.1 Multi-Service Route Aggregation

Relying on a single routing engine was ruled out early on. The problem is that any one service, especially in a dense city like Dhaka, tends to converge on the same set of major corridors for any given origin-destination pair. So Route Shield queries **three independent engines at once**:

- **OSRM (Open Source Routing Machine):** A publicly available, high-performance engine based on OpenStreetMap data.
- **GraphHopper:** A graph-based routing API with a free tier of 500 requests per day.
- **OpenRouteService (ORS):** A more feature-complete routing service allowing 2,000 free requests daily.

All three requests fire concurrently. If any service times out or errors out, the wrapper catches it silently and returns an empty list for that service — the overall response still uses whatever the other two produced. The pipeline then:

1. **Parallel Fetch** — all three queries run at the same time.
2. **Merge** — results are pooled into a single candidate set.
3. **Sort by Duration** — fastest routes are ordered first.
4. **Deduplication** — near-identical routes are removed (covered in Section 7.3.4).
5. **Re-Index** — survivors are renumbered from 1.
6. **Slice** — the top N results (default: 3) are sent to the frontend.

Fig 4: Multi-Service Route Aggregation Flow — three parallel routing queries merging into a deduplicated ranked list

**Implementation Details:**
This pipeline is managed by the `MultiRouteService` class in `multi_route_service.py`, which internally wraps `osrm_service.py`, `graphhopper_service.py`, and `ors_service.py`.

#### 7.3.2 Crime Data Analysis

The backend pulls crime records from MongoDB for two purposes: feeding the safety scoring engine and populating the analytics dashboard. A few specifics are worth noting:

- **Geospatial Querying:** Records near a given coordinate are fetched using MongoDB's `$near` operator on the `2dsphere`-indexed GeoJSON Points. This offloads the spatial filtering to the database rather than doing it in application code, which is both faster and significantly simpler.
- **Time-Based Filtering:** The API supports day/night filtering so only relevant records enter the scoring engine for a given search.
- **Statistics Aggregation:** The backend computes city-wide figures including total record count, day/night split, crime type distribution, mean severity, and a list of areas exceeding a designated severity threshold.
- **Data Sources:** Records in the current dataset come from Dhaka Metropolitan Police data, _Prothom Alo_, _The Daily Star_, and Bangladesh Police records covering the 2024–2025 period.

**Mathematical Notation:**

The count of crimes belonging to category $k$ across the full record set is:

$$\text{Count}_k = \sum_{i=1}^{N} \mathbf{1}\{\text{crime}_i \in \text{category}_k\}$$

where $N$ is the total crime count and $\mathbf{1}\{\cdot\}$ is the indicator function returning 1 when the condition holds and 0 otherwise.

**Implementation Details:**
All crime data operations are handled by the `CrimeService` class in `crime_service.py`. The record schema is defined in `crime_models.py`.

#### 7.3.3 Safety Score Calculation

The safety scoring engine is the most algorithmically involved part of the system. For each candidate route, it works through four consecutive steps.

**Step 1 — Crime proximity detection:**

For every crime point $c$ and every segment $[p_i, p_{i+1}]$ along the route, the minimum perpendicular distance from the crime to that road segment is computed. The Haversine formula converts coordinate differences into geodetic distances in kilometres:

$$d = 2R \arcsin\!\left(\sqrt{\sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)}\right)$$

where $R = 6371$ km is Earth's mean radius. Crimes falling within 500 m of the route enter the scoring calculation and are classified as _near the route_.

**Step 2 — Per-crime risk contribution:**

Each proximate crime contributes an individual risk value computed from six separate weighting factors:

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

The factors are:

- $d_f$ = Distance factor: $1 - d_{\min} / \text{threshold}$ — crimes physically closer to the road register higher.
- $s_f$ = Severity factor: the crime's severity score divided by 10.
- $t_f$ = Time factor: 2.0 if crime time matches the user's selected travel period, 0.5 otherwise.
- $w_{\text{type}}$ = Crime type weight (Murder/Rape = 2.0, Kidnapping = 1.9, Assault = 1.8, down to Cybercrime = 0.5).
- $w_{\text{concern}}$ = The user's personal concern for the crime's category (0.5 to 2.0).
- $w_{\text{tolerance}}$ = Risk tolerance multiplier (Cautious = 1.5, Balanced = 1.0, Time-Focused = 0.6).

**Step 3 — Combined risk computation:**

Rather than using a single risk figure, the total is split into two components — average per-crime severity and overall crime density — then blended at a 70/30 ratio:

$$\text{avgRiskNorm} = \min\!\left(\frac{\sum \text{risk}_c \;/\; N_{\text{near}}}{40},\; 1\right)$$

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N_{\text{near}})}{4},\; 1\right)$$

$$\text{combinedRisk} = 0.70 \times \text{avgRiskNorm} + 0.30 \times \text{densityNorm}$$

The logarithm in the density term is there for a specific reason: without it, a corridor with thirty petty incidents would score worse than a stretch with two murders, which would give users badly misleading guidance.

**Step 4 — Safety score output:**

$$\text{safetyScore}_{100} = \max\!\left(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}}\right)$$

$$\text{safetyScore} = \frac{\text{safetyScore}_{100}}{10}$$

Here $N_{\text{highRisk}}$ counts route segments where three or more crimes are nearby. The score maps to a risk classification as follows:

$$\text{riskLevel} = \begin{cases} \text{Low} & \text{safetyScore} \geq 7.5 \\ \text{Medium} & 5.0 \leq \text{safetyScore} < 7.5 \\ \text{High} & \text{safetyScore} < 5.0 \end{cases}$$

Fig 5: Safety Scoring Algorithm Flowchart — from route geometry and crime data through 6-factor risk multiplication to final safety score and risk level

**Implementation Details:**
The complete scoring engine is in `safetyScoring.ts`. It contains the Haversine implementation, perpendicular segment projection, the six-factor risk formula, log-density normalization, the 70/30 blend, and the score-to-risk-level classification.

#### 7.3.4 Route Deduplication and Ranking

When three routing engines all return routes for the same pair, some of those results will be nearly identical — same roads, trivially different travel time figures. Presenting all of them would waste the user's attention without offering any real choice.

Route Shield removes near-duplicates using a **dual-ratio threshold**. Two routes $A$ and $B$ are treated as duplicates only when **both** of the following hold simultaneously:

$$\frac{|\Delta_{\text{duration}}|}{t_A} \leq \delta \quad \text{AND} \quad \frac{|\Delta_{\text{distance}}|}{d_A} \leq \delta$$

where $\delta = 0.08$, an 8% tolerance. The AND condition matters — if two routes share almost identical travel times but noticeably different distances, they may use different road segments and should both be shown. Once duplicates are removed, surviving routes are sorted by safety score so the "Recommended" label always goes to the safest option.

**Implementation Details:**
Deduplication is in the `_deduplicate()` method of `MultiRouteService`, with `DUPLICATE_THRESHOLD = 0.08`.

---

### 7.4 Output

The Output module covers how analysis results get presented to the user — on the map, in the comparison panel, through the dashboard, and via the navigation export.

#### 7.4.1 Map Visualization and Route Display

The map is built with Leaflet.js via React-Leaflet bindings. It is the primary visual surface and handles several display layers at once.

- **Route Polylines:** Each candidate route is drawn in a different colour. Hovering or clicking a route turns it gold with a wider stroke for quick visual identification.
- **Crime Heatmap:** When enabled, crime records appear as circle markers coloured by severity — red for scores 8 to 10, orange for 5 to 7, and yellow for 1 to 4.
- **High-Risk Segment Highlighting:** Segments of a route with three or more nearby crimes are visually flagged, drawing attention to stretches that may warrant extra caution.
- **Crime Highlight on Selection:** Clicking "View Crimes" on a route card narrows the map display to only that route's proximate crimes, rather than the full city dataset.
- **Police Stations Overlay:** An optional layer showing station locations across Dhaka, which some users may find useful as a contextual reference.
- **Auto-Zoom:** After each search, the map adjusts its viewport to frame all returned routes.
- **Legend:** An on-map legend explains the colour coding for both safety levels and severity bands.

Fig 6: Interactive Map displaying three route polylines and the crime heatmap with severity-coded circle markers

**Implementation Details:**
The full interactive map is in `MapView.tsx`.

#### 7.4.2 Interactive Dashboard and Insights

The analytics dashboard gives users a broader view of the crime situation in Dhaka, separate from any specific route search. It displays:

- **Crime Count Summary:** Total records in the database, split by daytime and nighttime occurrences.
- **Crime Type Distribution:** A proportional chart showing how different crime categories are distributed.
- **Average Severity:** The city-wide mean severity score across all stored records.
- **High-Severity Areas:** Locations where recorded severity consistently exceeds a set threshold.
- **Data Source Attribution:** A list of contributing sources and the period they cover.

**Implementation Details:**
The dashboard is in `Dashboard.tsx`, pulling from the `GET /api/crimes/statistics` endpoint and `get_crime_statistics()` in `crime_service.py`.

#### 7.4.3 Route Comparison and Safety Reports

The comparison panel presents each candidate route as a structured card, laid out so users can assess options side by side without needing to cross-reference the map.

- **Safety Score Badge:** A score out of 10, colour-coded green for Low risk, orange for Medium, and red for High.
- **Risk Level Label:** Plain-language wording — "Safe to travel", "Moderate risk", or "High risk — caution advised".
- **Distance and Duration:** Formatted metrics, for example "5.2 km · 14 mins".
- **Recommended Banner:** The highest-scoring route gets a clearly visible "Recommended" label.
- **Nearby Crime Count:** How many recorded incidents sit within 500 m of the route.
- **Crime Detail Modal:** Expanding a card shows each proximate crime's type, location name, severity score, time of day, date, and source publication.

Fig 7: Route Comparison Panel showing three route cards with safety scores — 8.2 (Recommended/green), 6.1 (orange), 4.3 (red)

**Implementation Details:**
The comparison cards and crime detail modal are both in `RouteComparison.tsx`.

#### 7.4.4 Navigation Export

Once a user has chosen a route, they typically want to actually follow it. Route Shield handles the handoff to Google Maps with the route geometry pre-loaded.

- **Google Maps Export:** Each route card has a "Navigate" button that builds a Google Maps directions URL. Up to 8 waypoints sampled evenly from the route geometry are injected, which causes Google Maps to follow the intended path rather than independently recalculating from scratch.
- **Practical Use:** On mobile the URL typically opens directly in the Google Maps app, starting turn-by-turn navigation along the Route Shield-selected path while the safety context remains accessible in the browser tab.

**Implementation Details:**
The `buildGoogleMapsNavUrl()` function in `RouteComparison.tsx` handles URL construction and waypoint sampling.

---

### 7.5 Models and Their Significance

Several mathematical models underpin Route Shield's approach to crime-aware navigation. Each was chosen for a specific reason and plays a distinct role in the system. What follows is a description of each, its mathematical basis, and why it was selected.

#### 7.5.1 Haversine Formula (Geodetic Distance)

The Haversine formula gives the great-circle distance between two points on a sphere from their latitude and longitude coordinates. It functions as the base distance calculation throughout the entire system — every proximity check ultimately calls this.

**Mathematical Foundation:**

$$a = \sin^2\!\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\!\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2R\arcsin(\sqrt{a})$$

**Usage in Route Shield:**

- Computing the geodetic distance from a crime's coordinates to route segment endpoints during proximity analysis.
- Determining whether a crime sits within the 500 m threshold that marks it as "near the route."
- Powering the backend's radius-based crime retrieval endpoint.

#### 7.5.2 Point-to-Segment Projection (Perpendicular Distance)

A road is not a collection of isolated points — it's a sequence of connected line segments. Early development showed that measuring only vertex-to-crime distances produced noticeable false positives: a crime near the midpoint of a long segment could appear far from any route vertex, even when it was physically only 40 or 50 metres from the road. The perpendicular projection model corrects this.

**Mathematical Foundation:**

Given a crime point $P$ and a road segment $[A, B]$, the scalar projection parameter is:

$$t = \frac{(P - A) \cdot (B - A)}{\|B - A\|^2}$$

The closest point $Q$ on the segment is:

$$Q = \begin{cases} A & t < 0 \\ B & t > 1 \\ A + t(B - A) & 0 \leq t \leq 1 \end{cases}$$

The crime-to-route distance is then $d = \text{Haversine}(P, Q)$.

**Why it matters:**

Without this step, the proximity filter systematically under-counts crimes near the middle portions of long road segments, making those routes appear safer than they actually are. The projection adds meaningful precision and is a relatively cheap computation to include.

#### 7.5.3 Log-Scaled Crime Density Normalization

This model addresses a problem that becomes obvious once you think through it: a raw crime count approach will systematically penalize routes through areas with many minor incidents more harshly than routes near a smaller number of very dangerous ones. That gets the priority ordering exactly backwards.

Logarithmic scaling compresses large counts to prevent them from drowning out severity signal:

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N)}{4},\; 1\right)$$

| $N$ (crimes) | Linear (uncapped) | Log-Normalized |
| ------------ | ----------------- | -------------- |
| 1            | 0.05              | 0.17           |
| 5            | 0.25              | 0.45           |
| 10           | 0.50              | 0.60           |
| 20           | 1.00              | 0.76           |
| 50           | 2.50              | 0.98           |

The log-normalized value for 50 crimes (0.98) is barely higher than for 20 (0.76). A route near 20 minor incidents isn't dramatically worse than one near 50, which reflects a reasonable view of actual risk. The density component is also capped at a 30% contribution in the final blend, so the per-crime severity component always carries the majority weight.

#### 7.5.4 Multi-Factor Weighted Safety Scoring Model

This is the core model. It multiplies six per-crime factors together to get an individual risk contribution, aggregates those contributions across all nearby crimes, and converts the result into a 0 to 10 safety score.

**Mathematical Foundation:**

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

$$\text{safetyScore} = \frac{\max(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}})}{10}$$

**What each element contributes:**

- **Personalization** — because concern weights and the tolerance multiplier come directly from the user, the exact same route will legitimately produce a different score for a cautious traveler compared to a time-prioritizing commuter. This is by design.
- **Crime type differentiation** — assigning violent crimes a weight of up to 2.0× and minor offences 0.5× may look like a blunt instrument, but it produces a ranking that tracks reasonably well with the actual danger differential between crime categories.
- **Temporal relevance** — without the time factor, a midnight traveler and a noon commuter would receive the same safety score for identical routes, which would clearly misrepresent nighttime risk in a city like Dhaka.

---

### 7.6 Code Implementation Overview

Each module described above corresponds to a set of specific source files. Below is a brief account of what each major file does.

#### 7.6.1 `multi_route_service.py`

The routing orchestrator. It fires all three service requests concurrently using async operations, collects their results into a single pool, runs deduplication via the dual-ratio threshold, re-indexes surviving routes, and returns a final ranked list. Fault tolerance is handled at the individual service level — one service failing doesn't abort the whole request.

#### 7.6.2 `crime_service.py`

Manages all interaction with the MongoDB crime collection — full dataset retrieval, radius-based `$near` queries, time-of-day filtering, city-wide statistics aggregation, and the CRUD operations needed to add and update crime records.

#### 7.6.3 `safetyScoring.ts`

Probably the most technically dense file in the codebase. It implements the Haversine distance formula, perpendicular point-to-segment projection, the six-factor per-crime risk calculation, log-density normalization, the 70/30 blend, the final score classification, and the natural-language safety description that appears on each route card.

#### 7.6.4 `routeService.ts`

Handles all frontend API communication — geocoding through Nominatim, fetching routes from the backend, retrieving crime records, passing those records into the scoring engine, and decoding the compressed polyline geometry that routing services return.

#### 7.6.5 `prothomalo_scraper.py` / `dailystar_scraper.py`

These scrapers automate crime data collection from Bangladeshi news sources. The Prothom Alo scraper is the more involved of the two — it uses a 100+ entry Bengali keyword dictionary and translation tables for Bengali digits and month names to extract and normalize article data, then geocodes matched locations via Nominatim. The Daily Star scraper applies an equivalent pipeline to English-language articles. Both enforce a minimum 1.5-second delay between requests.

---

## 8. User Manual and User Interface

Route Shield is a web application built for residents and daily commuters in Dhaka who want a clearer picture of which routes through the city carry less risk at a given time of day. It pulls real crime records into the route evaluation process and produces safety scores that reflect the user's own travel context — not some averaged, one-size-fits-all figure.

### 8.1 System Overview

- **Purpose:** Crime-aware navigation across Dhaka city, with scores personalised to the user's travel time and risk tolerance.
- **Target Users:**
  - Dhaka residents and daily commuters.
  - Urban researchers and analysts examining crime distribution.
  - City planners or law enforcement teams working on spatial safety.
- **Main Features:**
  - Alternative route generation from three routing services queried simultaneously.
  - Safety scoring based on proximity to real crime records, calibrated to user preferences.
  - Interactive crime heatmap across the city.
  - Google Maps export with route geometry preserved through waypoint injection.
  - City-wide crime analytics dashboard.

### 8.2 Route Shield User Manual

The steps below describe a typical navigation session in Route Shield from start to finish.

#### 8.2.1 Accessing the Application

No account or login is needed. The app loads directly to the main navigation view — a map panel alongside a route search panel. First-time users can begin immediately without any setup or registration.

Fig 8: Route Shield home screen — map panel on the left, route search and comparison panel on the right

#### 8.2.2 Interface Overview

On first load, the user sees:

- **Interactive Map:** A Leaflet.js map of Dhaka. The crime heatmap is enabled by default, showing colour-coded markers across the city.
- **Route Search Panel:** Origin and destination fields, travel time selector, and the Safety Preferences section below them.
- **Route Comparison Panel:** Empty on load; populates with route cards once a search completes.
- **Analytics Dashboard:** Reachable through the "Analytics" tab — city-wide crime statistics, type breakdowns, and high-severity area rankings.
- **Header Controls:** Toggles for the crime heatmap, the police stations overlay, and a light/dark theme switcher.

#### 8.2.3 Using Route Shield

**Step 1: Enter Origin and Destination**

- Click the Origin field. Start typing a road, neighbourhood, or landmark name in Dhaka.
- A suggestion dropdown appears. Pick the correct location from the list.
- Repeat in the Destination field.

**Step 2: Select Travel Time and Preferences**

- Choose **Day** or **Night** to reflect when you are actually traveling.
- Optionally expand the Safety Preferences section and adjust the Risk Tolerance slider and per-category concern weights.

**Step 3: Search for Routes**

- Click **Find Safe Routes**.
- The system simultaneously queries OSRM, GraphHopper, and OpenRouteService, then scores the returned routes against the crime database.

**Step 4: View Results**

- Up to three route cards appear. Each shows a safety score, distance, duration, and nearby crime count. The highest-scoring route carries the "Recommended" label.
- All routes are drawn on the map in distinct colours. Individual routes can be toggled using the checkboxes on their cards.

**Step 5: Inspect Crime Details**

- Click **View Crimes** on any card to open a modal listing each proximate crime — type, location name, severity, time of day, date, and source.
- The same crimes are simultaneously highlighted on the map as enlarged markers.

**Step 6: Navigate**

- Click **Navigate** on the route you want to take.
- Google Maps opens with up to 8 sampled waypoints pre-loaded, following the Route Shield path.

**Step 7: View Analytics (Optional)**

- Switch to the **Analytics** tab to browse city-wide crime statistics, type distribution, average severity, and the highest-risk area list.

### 8.3 Features and Functionalities

1. **Crime-Aware Multi-Route Generation**
   - Three routing services queried concurrently for path diversity.
   - Deduplication step removes near-identical routes so all presented options are meaningfully distinct.

2. **Multi-Factor Safety Scoring**
   - Six-factor model covering crime type, severity, distance to route, travel time, user concern, and risk tolerance.
   - Scores on a 0–10 scale, classified Low, Medium, or High.

3. **Personalized Safety Preferences**
   - Risk tolerance and crime category concern sliders shape the scoring to individual priorities.
   - Changes take effect on the next search.

4. **Interactive Crime Heatmap**
   - Toggle for city-wide crime display across Dhaka.
   - Severity-coded circle markers with detail popups on click.

5. **Route Comparison Panel**
   - Side-by-side cards with scores, distances, and crime counts.
   - Recommended route clearly labelled.

6. **Crime Detail Inspection**
   - Per-route crime listing modal with synchronised map highlighting.
   - Source attribution on every record.

7. **Navigation Export**
   - Single-click handoff to Google Maps with the route geometry embedded as waypoints.

8. **City Analytics Dashboard**
   - Aggregate crime data for situational awareness independent of route searching.
   - Day/night breakdown, type distribution, average severity, and area rankings.

### 8.4 Challenges the System Addresses

1. **No existing crime-aware navigation for Dhaka:** Standard apps optimize for time or distance. Route Shield brings source-attributed crime data into that same calculation.
2. **Scattered data across languages and sources:** Dhaka crime records are spread across police reports, Bengali-language newspapers, and English outlets. Pulling them into one queryable database required separate scraping and normalization pipelines for both languages.
3. **One-size-fits-all safety ratings:** Most navigation apps don't address safety; and when they do, it's a single generic score. The preference system here lets a late-night traveler concerned about assault weight the scoring differently from a daytime commuter who's mainly thinking about traffic theft.
4. **Single-service route repetition:** Any one routing engine in a dense urban network tends to return the same major-road variants repeatedly. Drawing from three independent services and deduplicating meaningfully broadens the range of genuine alternatives.

### 8.5 Access Route Shield

To run Route Shield locally:

**Frontend Setup:**

1. Clone the Route Shield frontend repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. The frontend will be available at `http://localhost:5173`

**Backend Setup:**

1. Clone the Route Shield backend repository.
2. Install Python packages: `pip install -r requirements.txt`
3. Set the environment variables: `MONGODB_URL`, `GRAPHHOPPER_API_KEY`, `ORS_API_KEY`
4. Start the API server: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

---

## 9. Test Report

This chapter describes the testing objectives for Route Shield and presents a set of test cases covering the system's main functional areas.

### 9.1 High Level Description of Testing Goals

Testing was organized around the following objectives:

- Checking that route retrieval and display works correctly for valid Dhaka locations.
- Verifying that the safety scoring engine correctly accounts for crime proximity, type weights, time of day, and user preference settings.
- Confirming that crime data flows from the database through geospatial queries and onto the map without errors or data loss.
- Validating that preference changes produce measurably different scores in the expected direction.
- Testing how the system behaves when one or more routing services are unavailable — specifically, does it surface an error to the user or handle the failure internally?
- Checking the deduplication logic under scenarios where services converge on nearly identical routes.
- Verifying that the interface is usable and readable on standard desktop screen sizes.

### 9.2 Test Cases

---

**Test Case 1: Route Search with Valid Locations**

Test Scenario: A user enters two valid Dhaka locations and searches for routes.

Steps:

1. Enter "Gulshan 1" in the origin field and select from the suggestion dropdown.
2. Enter "Motijheel" in the destination field and select from the suggestion dropdown.
3. Click "Find Safe Routes".

Expected Outcome:

- Both addresses geocode to valid Dhaka coordinates.
- At least one route appears on the map with correct polyline geometry.
- Each route card shows distance, duration, and a safety score.

Result: Passed. Three routes returned with correct geometry and scores within expected parameters.

---

**Test Case 2: Autocomplete Suggestions Prioritize Dhaka**

Test Scenario: A location name that exists in multiple countries is typed in.

Steps:

1. Type "Mirpur" in the origin field.
2. Observe the suggestion dropdown.

Expected Outcome:

- Dhaka-specific results appear at the top.
- No results from outside Bangladesh appear before local options.

Result: Passed. The Bangladesh country code filter and Dhaka display name filter correctly prioritize local results.

---

**Test Case 3: Day vs. Night Safety Score Difference**

Test Scenario: The same origin-destination pair is searched under Day and Night settings to confirm scores differ.

Steps:

1. Search Sadarghat to Farmgate with travel time set to **Day**. Note the scores.
2. Repeat the search with travel time set to **Night**.

Expected Outcome:

- Routes near nighttime crime concentrations should score lower in the Night search.
- The rank ordering of routes may shift between the two searches.

Result: Passed. Night-time settings correctly amplify nighttime crime contributions at 2.0× and reduce daytime crime contributions to 0.5×, producing measurably different scores.

---

**Test Case 4: Safety Preferences Affect Route Scores**

Test Scenario: Switching Risk Tolerance from Balanced to Cautious changes computed scores.

Steps:

1. Search with **Balanced** tolerance. Record scores.
2. Switch to **Cautious** and search the same pair.

Expected Outcome:

- Cautious scores differ from Balanced scores, reflecting the 1.5× risk multiplier.
- Routes near higher crime density show a proportionally larger reduction.

Result: Passed. The tolerance multiplier correctly scales all per-crime contributions, producing different scores across preference settings.

---

**Test Case 5: Route Deduplication Removes Near-Identical Routes**

Test Scenario: For a short, well-connected journey, multiple engines may converge on similar routes. These should collapse to one.

Steps:

1. Request routes for a short origin-destination pair prone to service convergence.
2. Check whether any two returned routes are within 8% of each other in both duration and distance simultaneously.

Expected Outcome:

- No two results share duration and distance within 8% at the same time.
- At least one route from each differing service is retained.

Result: Passed. The dual-ratio threshold correctly collapses converged duplicates while keeping distinct alternatives.

---

**Test Case 6: Crime Heatmap Toggle**

Test Scenario: The heatmap toggle correctly shows and hides crime markers.

Steps:

1. Load the app. Confirm crime markers are visible.
2. Click **Hide Heatmap**.
3. Click **Show Heatmap**.

Expected Outcome:

- Hiding removes all crime circle markers from the map.
- Showing restores them at correct positions with correct severity colours.

Result: Passed. Toggle controls marker visibility without affecting route polylines.

---

**Test Case 7: View Crimes Modal and Map Highlighting**

Test Scenario: Clicking "View Crimes" opens a detail modal and narrows the map to show only that route's crimes.

Steps:

1. Complete a route search.
2. On a card showing nearby crimes, click **View Crimes**.

Expected Outcome:

- Modal lists proximate crimes with type, severity, date, time, and source.
- Map highlights only that route's crimes using enlarged markers.

Result: Passed. Modal correctly filtered to route-specific records. Map highlighting matched.

---

**Test Case 8: Google Maps Navigation Export**

Test Scenario: The Navigate button launches Google Maps with the selected route's waypoints pre-loaded.

Steps:

1. Complete a route search.
2. Click **Navigate** on the first route card.

Expected Outcome:

- Google Maps opens in a new tab with origin, destination, and up to 8 intermediate waypoints.
- The displayed path corresponds to the Route Shield route geometry.

Result: Passed. Google Maps loaded correctly with route-specific waypoints within browser URL limits.

---

**Test Case 9: Partial Routing Service Failure Handling**

Test Scenario: One routing service is made unavailable. Does the system still respond normally?

Steps:

1. Set an invalid API key for one service to simulate a timeout condition.
2. Perform a route search.

Expected Outcome:

- No error screen is shown to the user.
- Routes are returned from the two remaining services.
- The result panel appears normal.

Result: Passed. The fault-tolerant wrapper returned an empty list for the failing service. Remaining results populated the panel with no visible error.

---

**Test Case 10: Analytics Dashboard Data Accuracy**

Test Scenario: Dashboard statistics correctly reflect what the API endpoint reports.

Steps:

1. Navigate to the **Analytics** tab.
2. Note total crime count, day/night split, and type distribution.
3. Cross-reference by calling `/api/crimes/statistics` directly.

Expected Outcome:

- Dashboard total count matches the API response.
- Daytime and nighttime counts sum to the total.
- Type distribution percentages are correctly proportioned.

Result: Passed. Dashboard figures matched the statistics endpoint. Aggregation logic correctly computed all fields from the live database.

---

## 10. Conclusion

This document has covered the technical design and operational details of **Route Shield: Crime-Aware Smart Navigation for Dhaka City** — from system architecture and data ingestion through the safety scoring algorithm and the user interface that surfaces the results.

The approach described here — pulling routes from three routing services, scoring each against a geo-referenced crime database using a six-factor weighting model, and adjusting those scores based on user-supplied preferences — may not be the only viable design for this problem. That said, the ten test cases in Chapter 9 suggest it meets its core functional goals with reasonable reliability. Route accuracy, scoring behavior under varying preference settings, deduplication under service convergence, and fault handling under partial failure all produced the expected outcomes.

There are limitations worth acknowledging. Crime data quality depends heavily on the scrapers and their source publications, both of which have coverage gaps and occasional normalization errors. The 500-metre proximity threshold is a pragmatic default that could reasonably be made user-adjustable. The type weights assigned to different crime categories were chosen by reasoning about relative danger, but deriving them from survey data or historical impact assessments would be more rigorous. These aren't flaws unique to this system — they're common in applied crime-analysis work — but they're relevant to anyone interpreting the safety scores seriously.

Looking ahead, the most immediately useful extension would probably be real-time news feed integration to reduce the gap between a crime occurring and appearing in the database. Support for pedestrian and public-transport routing modes seems valuable too, given that a large portion of Dhaka's population doesn't travel by private car. Expansion to other Bangladeshi cities and integration with official Bangladesh Police open data, if and when that becomes available, would help scale coverage beyond the current dataset.

Route Shield represents a first attempt at a problem — safety-aware urban navigation using real, multi-source crime data — that existing tools largely ignore for Dhaka. Whether the approach holds up as the city and its crime patterns shift over time is an open question. One worth continuing to study.

---

_Route Shield © 2025 | Developed by Eftekhar Mahmud Efty_
