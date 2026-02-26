# Route Shield — Technical Documentation

## Crime-Aware Smart Navigation for Dhaka City

---

## 7. Applied Methodology

This chapter elucidates the internal mechanisms of **Route Shield** (Crime-Aware Smart Navigation), detailing its workflow, input handling, processing modules, and output generation. By dissecting these components, we provide a comprehensive understanding of how Route Shield operates to deliver real-time, safety-scored navigation across Dhaka city.

---

### 7.1 Workflow

The Route Shield system is conceptualized through a high-level abstraction comprising three fundamental modules: **Input**, **Processing**, and **Output**. This modular decomposition facilitates a clear comprehension of the system's functionality and interactions. Each module is elaborated in the subsequent sections.

Fig 1: High-Level Abstraction of Implemented Route Shield Workflow

---

### 7.2 Input

The Input module is responsible for managing user interactions and handling the ingestion of location and preference data. It comprises the following sub-modules:

#### 7.2.1 Location Input and Address Search

Route Shield employs a real-time geocoding mechanism to resolve user-typed addresses to precise coordinates. The implementation includes:

- **Autocomplete Suggestions:** As the user types, the system queries the OpenStreetMap Nominatim API to provide live location suggestions. Results are filtered to prioritize Dhaka, Bangladesh to prevent ambiguous matches with identically named places in other countries.
- **Suggestion Dropdown:** A dedicated dropdown component renders ranked autocomplete results with place type labels, allowing the user to select the precise intended location.
- **Geocoding:** Once an address is confirmed, Nominatim resolves the text entry to a latitude/longitude coordinate pair that serves as the routing origin or destination for all subsequent processing.

Fig 2: Route Search Panel with autocomplete suggestion dropdown active

**Implementation Details:**
The location input functionality is implemented through the `RouteSearch.tsx` component, the `SuggestionDropdown.tsx` component, the `useSuggestions.ts` hook, and the `geocodeAddress()` function in `routeService.ts`.

#### 7.2.2 Travel Time and Safety Preferences

This sub-module allows users to customize how safety is evaluated for their specific journey:

- **Travel Time Selection:** Users specify whether they intend to travel during the **Day** or **Night**. This is a first-class input that directly governs the time-of-day weighting factor in the safety scoring engine. Crimes that occurred during the user's chosen travel period are weighted at 2.0×, while crimes at the opposite time of day are weighted at only 0.5×.
- **Risk Tolerance Level:** Users select from three tiers — _Cautious_ (1.5× safety multiplier), _Balanced_ (1.0×, default), or _Time-Focused_ (0.6×, speed prioritized). This applies an overall multiplier across all crime risk contributions.
- **Crime Type Concerns:** Users independently adjust their personal concern level (0.5 to 2.0) across four crime categories: Violent Crimes, Property Crimes, Drug Crimes, and Minor Crimes. Higher concern values amplify the risk contribution of crimes in that category during scoring.

Fig 3: Safety Preferences Panel showing travel time selector, risk tolerance control, and crime category concern sliders

**Implementation Details:**
The safety preference controls are implemented in `SafetyPreferencesPanel.tsx`. The `SafetyPreferences` interface, crime category mapping, and risk tolerance multipliers are defined in `preferences.types.ts`.

#### 7.2.3 Crime Data Ingestion and Preprocessing

This sub-module handles the collection, cleaning, and storage of crime records that power the safety engine:

- **Supported Data Formats:** Crime records are ingested from structured JSON datasets covering 2024 and 2025, and from automated web scrapers targeting Bangladeshi news portals.
- **Web Scraping:** Two dedicated scrapers collect real-world crime data. The _Prothom Alo_ scraper targets Bengali-language crime news, matching articles to Dhaka area keywords via a curated translation dictionary of over 100 Bengali place names. The _Daily Star_ scraper collects English-language crime reports from the same city.
- **Text Normalization:** Bengali digit characters and month names are translated to their ASCII equivalents during scraping to produce standardized date fields.
- **Geocoding:** The matched location name from each article is geocoded via Nominatim to produce the latitude and longitude stored with the crime record.
- **Metadata Annotation:** Each record is annotated with crime type, severity score (1–10), time of day, police station jurisdiction, date, and data source.
- **Secure Storage:** All processed records are persisted in MongoDB Atlas as GeoJSON Point documents, enabling native geospatial indexing and efficient radius-based queries.
- **Rate-Limited Crawling:** Scrapers enforce a 1.5-second delay between requests to comply with responsible crawling practices.

**Implementation Details:**
The ingestion pipeline is implemented through `prothomalo_scraper.py`, `dailystar_scraper.py`, and the `crime_service.py` backend service. Crime records are modelled using the `CrimeRecord` and `CrimeInDB` Pydantic classes defined in `crime_models.py`.

---

### 7.3 Processing

The Processing module encompasses all backend and frontend operations that analyze user inputs and generate ranked, safety-scored routes. It is subdivided into four primary components:

#### 7.3.1 Multi-Service Route Aggregation

Route Shield achieves routing resilience and geometric path diversity by querying **three independent routing engines in parallel**:

- **OSRM (Open Source Routing Machine):** A public, high-performance routing engine based on OpenStreetMap data.
- **GraphHopper:** A graph-based routing API offering 500 free requests per day.
- **OpenRouteService (ORS):** A feature-rich routing service offering 2,000 free requests per day.

All three services are fired concurrently. Individual service failures are caught silently and return an empty result, ensuring the system degrades gracefully rather than failing outright. The aggregation pipeline proceeds as follows:

1. **Parallel Fetch** — All three routing services are queried simultaneously.
2. **Merge** — All returned routes are combined into a single candidate pool.
3. **Sort by Duration** — Fastest routes are ranked first.
4. **Deduplication** — Near-duplicate routes are removed (see Section 7.3.4).
5. **Re-Index** — Surviving routes are renumbered sequentially.
6. **Slice** — The top N routes (default: 3) are returned to the frontend.

Fig 4: Multi-Service Route Aggregation Flow — three parallel routing queries merging into a deduplicated ranked list

**Implementation Details:**
This pipeline is managed by the `MultiRouteService` class in `multi_route_service.py`, which internally delegates to `osrm_service.py`, `graphhopper_service.py`, and `ors_service.py`.

#### 7.3.2 Crime Data Analysis

The backend retrieves crime data from MongoDB and exposes it to the frontend for safety analysis. Key operations include:

- **Geospatial Querying:** Crime records are retrieved using MongoDB's `$near` operator, which leverages the `2dsphere` index on stored GeoJSON Points to efficiently return crimes within a specified radius of any coordinate.
- **Time-Based Filtering:** Crimes are filterable by time of day (Day or Night) to support targeted analysis.
- **Statistics Aggregation:** The backend computes city-wide crime statistics including total record count, day/night split, crime type distribution, average severity, and identification of high-severity areas.
- **Data Source Diversity:** Crime records originate from Dhaka Metropolitan Police data, Prothom Alo, The Daily Star, and Bangladesh Police records, providing multi-source coverage for the 2024–2025 period.

**Mathematical Notation:**

The count of crimes belonging to category $k$ across the full record set is represented as:

$$\text{Count}_k = \sum_{i=1}^{N} \mathbf{1}\{\text{crime}_i \in \text{category}_k\}$$

where $N$ is the total number of crime records and $\mathbf{1}\{\cdot\}$ is the indicator function returning 1 if the condition is satisfied.

**Implementation Details:**
All crime data operations are handled by the `CrimeService` class in `crime_service.py`. The crime record schema is defined in `crime_models.py`.

#### 7.3.3 Safety Score Calculation

The core intellectual contribution of Route Shield is its **multi-factor weighted safety scoring engine**. For each candidate route, the following steps are executed:

**Step 1 — Crime proximity detection:**

**Step 1 — Crime proximity detection:**

For every crime point $c$ and every segment $[p_i, p_{i+1}]$ of the route, the minimum perpendicular distance from the crime to the road segment is computed. The Haversine formula is used to convert coordinate differences into geodetic distances in kilometres:

$$d = 2R \arcsin\!\left(\sqrt{\sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\left(\frac{\Delta\lambda}{2}\right)}\right)$$

where $R = 6371$ km. Crimes within 500 m of the route are classified as _near the route_.

**Step 2 — Per-crime risk contribution:**

Each proximate crime contributes a weighted risk value based on six independent factors:

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

where:

- $d_f$ = Distance factor: $1 - d_{\min} / \text{threshold}$ (closer crimes contribute more)
- $s_f$ = Severity factor: severity score divided by 10
- $t_f$ = Time factor: 2.0 if crime time matches travel time, else 0.5
- $w_{\text{type}}$ = Crime type weight (Murder/Rape = 2.0, Kidnapping = 1.9, Assault = 1.8, down to Cybercrime = 0.5)
- $w_{\text{concern}}$ = User's personal concern for the crime's category (0.5 to 2.0)
- $w_{\text{tolerance}}$ = Risk tolerance multiplier (Cautious = 1.5, Balanced = 1.0, Time-Focused = 0.6)

**Step 3 — Combined risk computation:**

The total risk is decomposed into two normalized components and blended with a 70/30 weighting:

$$\text{avgRiskNorm} = \min\!\left(\frac{\sum \text{risk}_c \;/\; N_{\text{near}}}{40},\; 1\right)$$

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N_{\text{near}})}{4},\; 1\right)$$

$$\text{combinedRisk} = 0.70 \times \text{avgRiskNorm} + 0.30 \times \text{densityNorm}$$

The log-scaled density component ensures that a cluster of minor crimes does not unfairly dominate over a smaller number of severe crimes.

**Step 4 — Safety score output:**

$$\text{safetyScore}_{100} = \max\!\left(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}}\right)$$

$$\text{safetyScore} = \frac{\text{safetyScore}_{100}}{10}$$

where $N_{\text{highRisk}}$ is the number of route segments with 3 or more crimes nearby. The score is classified as:

$$\text{riskLevel} = \begin{cases} \text{Low} & \text{safetyScore} \geq 7.5 \\ \text{Medium} & 5.0 \leq \text{safetyScore} < 7.5 \\ \text{High} & \text{safetyScore} < 5.0 \end{cases}$$

Fig 5: Safety Scoring Algorithm Flowchart — from route geometry and crime data through 6-factor risk multiplication to final safety score and risk level

**Implementation Details:**
The full scoring engine is implemented in `safetyScoring.ts`, which contains the Haversine distance function, perpendicular segment projection, the multi-factor risk formula, log-density normalization, the 70/30 blend, and the final score classification.

#### 7.3.4 Route Deduplication and Ranking

When three routing engines return results, near-duplicate routes can inflate the result set with trivially similar alternatives. Route Shield removes duplicates using a **dual-ratio threshold**:

Two routes $A$ and $B$ are considered duplicates if **both** conditions hold simultaneously:

$$\frac{|\Delta_{\text{duration}}|}{t_A} \leq \delta \quad \text{AND} \quad \frac{|\Delta_{\text{distance}}|}{d_A} \leq \delta$$

where $\delta = 0.08$ (8%). The logical AND requirement ensures that a route differing in distance but sharing a similar duration is still retained as a distinct option. After deduplication, surviving routes are sorted by safety score so the safest route is presented with the "Recommended" label.

**Implementation Details:**
Deduplication is implemented in the `_deduplicate()` method of `MultiRouteService` with `DUPLICATE_THRESHOLD = 0.08`.

---

### 7.4 Output

The Output module manages the generation and presentation of analysis results and navigation recommendations. It comprises the following sub-modules:

#### 7.4.1 Map Visualization and Route Display

Route Shield renders an interactive Leaflet.js-based map that provides the primary visual output surface:

- **Route Polylines:** Each route is drawn in a distinct colour. The hovered or active route turns gold with an increased stroke width for emphasis.
- **Crime Heatmap:** When enabled, all crime points are rendered as circle markers colour-coded by severity — red for severity 8–10, orange for 5–7, and yellow for 1–4.
- **High-Risk Segment Highlighting:** Route segments with 3 or more proximate crimes are visually flagged to direct the user's attention to the most dangerous stretches.
- **Crime Highlight on Selection:** Clicking "View Crimes" on a route card highlights only that route's nearby crimes on the map for focused inspection.
- **Police Stations Overlay:** An optional layer displays the locations of police stations across Dhaka.
- **Auto-Zoom:** The map automatically pans and zooms to frame all displayed routes.
- **Legend:** An on-map legend explains the colour coding for safety levels and crime severity bands.

Fig 6: Interactive Map displaying three route polylines and the crime heatmap with severity-coded circle markers

**Implementation Details:**
The full interactive map is implemented in `MapView.tsx` using the Leaflet.js library with React-Leaflet bindings.

#### 7.4.2 Interactive Dashboard and Insights

Route Shield provides a dedicated analytics dashboard to visualize city-wide crime data and situational awareness:

- **Crime Count Summary:** Displays total crime records broken down by day and night occurrences.
- **Crime Type Distribution:** A visual chart illustrating the proportion of each crime category across the dataset.
- **Average Severity:** City-wide mean severity score computed across all records.
- **High-Severity Areas:** A ranked list of locations exceeding a defined severity threshold.
- **Data Source Attribution:** Lists all contributing data sources and the data period covered.

**Implementation Details:**
The dashboard is implemented in `Dashboard.tsx` on the frontend, backed by the `GET /api/crimes/statistics` endpoint and `get_crime_statistics()` in `crime_service.py`.

#### 7.4.3 Route Comparison and Safety Reports

The Route Comparison panel renders a structured card for each candidate route, providing a side-by-side safety report:

- **Safety Score Badge:** A colour-coded score out of 10 (green for Low risk, orange for Medium, red for High).
- **Risk Level Label:** Plain-language verdict — "Safe to travel", "Moderate risk", or "High risk — caution advised".
- **Distance and Duration:** Formatted travel metrics (e.g., "5.2 km · 14 mins").
- **Recommended Banner:** The route with the highest safety score receives a prominent "Recommended" label.
- **Nearby Crime Count:** Number of crime incidents within 500 m of the route.
- **Crime Detail Modal:** Users can expand a full list of each proximate crime's type, location name, severity, time of day, date, and source.

Fig 7: Route Comparison Panel showing three route cards with safety scores — 8.2 (Recommended/green), 6.1 (orange), 4.3 (red)

**Implementation Details:**
The route comparison cards and crime detail modal are implemented in `RouteComparison.tsx`.

#### 7.4.4 Navigation Export

Route Shield bridges safety-aware routing with real-world navigation:

- **Google Maps Export:** Each route card provides a "Navigate" button that constructs a Google Maps direction URL. Up to 8 evenly sampled waypoints from the route geometry are injected into the URL, directing Google Maps to follow the exact computed path rather than recalculating independently.
- **Flexible Use:** Users can hand off the route to the Google Maps mobile app for turn-by-turn navigation while retaining the safety context provided by Route Shield.

**Implementation Details:**
The `buildGoogleMapsNavUrl()` function in `RouteComparison.tsx` handles URL construction with sampled waypoint injection.

---

### 7.5 Models and Their Significance

Route Shield leverages several mathematical models and algorithms to perform crime-aware navigation, ensuring accuracy, scalability, and meaningful safety differentiation in its recommendations. Below are the key models employed, their mathematical foundations, and their roles within Route Shield:

#### 7.5.1 Haversine Formula (Geodetic Distance)

The Haversine formula calculates the great-circle distance between two geographic points on a sphere given their latitudes and longitudes. It is the foundational distance primitive used in all proximity calculations throughout Route Shield.

**Mathematical Foundation:**

$$a = \sin^2\!\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\!\!\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2R\arcsin(\sqrt{a})$$

**Importance and Usage:**

- **Crime-to-Route Distance:** Computes the geodetic distance between crime coordinates and route segment endpoints to determine proximity.
- **Proximity Filtering:** Determines whether a crime falls within the 500 m proximity threshold required to count it as near the route.
- **Area Search:** Supports the backend endpoint for retrieving all crimes within a specified radius of any coordinate.

#### 7.5.2 Point-to-Segment Projection (Perpendicular Distance)

Road segments are line segments, not isolated points. A crime directly beside the midpoint of a segment is significantly closer to the road than a crime near only one of its endpoints. The perpendicular projection model resolves this distinction with geometric precision.

**Mathematical Foundation:**

Given a crime point $P$ and a road segment $[A, B]$, the projection parameter is:

$$t = \frac{(P - A) \cdot (B - A)}{\|B - A\|^2}$$

The closest point $Q$ on the segment is:

$$Q = \begin{cases} A & t < 0 \\ B & t > 1 \\ A + t(B - A) & 0 \leq t \leq 1 \end{cases}$$

The crime-to-route distance is then $d = \text{Haversine}(P, Q)$.

**Importance and Usage:**

- Eliminates false positives from crimes that appear close to a route vertex but are actually far from the road itself.
- Significantly increases the precision and relevance of the 500 m crime proximity filter, improving overall safety score accuracy.

#### 7.5.3 Log-Scaled Crime Density Normalization

A naïve linear crime count would penalize routes passing through areas with many minor incidents (e.g., pickpocketing) more severely than routes near fewer but more dangerous crimes (e.g., murder). Logarithmic scaling compresses large count values to prevent this distortion:

$$\text{densityNorm} = \min\!\left(\frac{\ln(1 + N)}{4},\; 1\right)$$

| $N$ (crimes) | Linear (uncapped) | Log-Normalized |
| ------------ | ----------------- | -------------- |
| 1            | 0.05              | 0.17           |
| 5            | 0.25              | 0.45           |
| 10           | 0.50              | 0.60           |
| 20           | 1.00              | 0.76           |
| 50           | 2.50              | 0.98           |

**Importance and Usage:**

- Prevents a cluster of 30 minor crimes from overriding the signal of 2 severe crimes.
- Keeps the density component bounded between 0 and 1 regardless of total crime count.
- Combined at 30% weight in the final risk blend, ensuring the severity quality component always dominates at 70%.

#### 7.5.4 Multi-Factor Weighted Safety Scoring Model

This is the core analytical model of Route Shield. It combines six independent weighting factors into a single per-crime risk contribution, then aggregates them across all proximate crimes into a normalized 0–10 safety score suitable for user-facing presentation.

**Mathematical Foundation:**

$$\text{risk}_c = d_f \times s_f \times t_f \times w_{\text{type}} \times w_{\text{concern}} \times w_{\text{tolerance}} \times 10$$

$$\text{safetyScore} = \frac{\max(0,\; 100 - \text{combinedRisk} \times 85 - 3 \times N_{\text{highRisk}})}{10}$$

**Importance and Usage:**

- **Personalization:** The user concern and risk tolerance multipliers ensure that the same route produces a different safety score for a cautious traveller compared to a time-focused commuter.
- **Crime Type Differentiation:** Assigns higher risk weights to violent crimes (up to 2.0×) than to minor crimes (0.5×), accurately reflecting the real danger differential between crime categories.
- **Temporal Relevance:** The time factor ensures a route's safety score is specifically calibrated for whether the user is travelling by day or night, making the score actionable rather than generic.

---

### 7.6 Code Implementation Overview

The functionalities described in the Input, Processing, and Output modules are implemented through a suite of Python and TypeScript files, each tailored to specific tasks within the Route Shield system.

#### 7.6.1 `multi_route_service.py`

This is the central routing orchestrator. It fires all three routing services simultaneously using async concurrency, collects their results, removes near-duplicate routes via the dual-ratio threshold, re-indexes the survivors, and returns a ranked list of geometrically distinct route options. Key functionalities include concurrent querying, fault-tolerant service wrapping, deduplication, and sequential re-indexing.

#### 7.6.2 `crime_service.py`

This service manages all interactions with the MongoDB crime collection. It handles full-dataset retrieval, radius-based geospatial queries using the `$near` operator, time-of-day filtering, city-wide statistics aggregation, and complete CRUD operations for crime records.

#### 7.6.3 `safetyScoring.ts`

This is the frontend safety engine and the most algorithmically rich module in the system. It implements the Haversine formula, perpendicular point-to-segment projection, the six-factor per-crime risk formula, log-density normalization, the 70/30 severity-density blend, the final 0–10 score and risk level classification, and natural-language safety description generation.

#### 7.6.4 `routeService.ts`

This TypeScript service handles all API communication on the frontend — geocoding addresses via Nominatim, fetching alternative routes from the backend, retrieving crime data, feeding crime records into the safety scoring engine, and decoding compressed route polylines.

#### 7.6.5 `prothomalo_scraper.py` / `dailystar_scraper.py`

These scrapers automate crime data collection from Bangladeshi news portals. The Prothom Alo scraper uses a 100+ entry Bengali keyword dictionary, Bengali digit and month translation tables, and Nominatim geocoding to convert Bengali news articles into structured, geo-referenced crime records. The Daily Star scraper applies the equivalent pipeline to English-language articles. Both enforce rate-limited crawling.

---

## 8. User Manual and User Interface

Route Shield is a web-based application developed to help residents and commuters in Dhaka, Bangladesh navigate safely by presenting crime-aware alternative routes. It integrates real-world crime data into the route planning process, assigns quantified safety scores to each route, and empowers users to make informed travel decisions based on their personal risk profile.

### 8.1 System Overview

- **Purpose:** To enable crime-aware navigation by providing safety-scored alternative routes across Dhaka city, personalized to the user's travel time and risk tolerance.
- **Target Users:**
  - Daily commuters and residents of Dhaka.
  - Researchers and analysts studying urban crime patterns.
  - City planners and law enforcement stakeholders.
- **Key Functionalities:**
  - Multi-service alternative route generation.
  - Crime-proximity-based safety scoring with full personalization.
  - Interactive crime heatmap visualization across Dhaka.
  - Google Maps navigation export with exact route enforcement.
  - City-wide crime analytics dashboard.

### 8.2 Route Shield User Manual

The user will perform the following tasks to use Route Shield.

#### 8.2.1 Accessing the Application

The user visits the Route Shield web application. No account or login is required — the application is fully accessible upon first visit. The interface loads directly to the main navigation view, presenting a map panel and a route search panel side by side.

Fig 8: Route Shield home screen — map panel on the left, route search and comparison panel on the right

#### 8.2.2 Interface Overview

Upon loading, the user will see:

- **Interactive Map:** The central Leaflet.js map displays Dhaka city. The crime heatmap is enabled by default, showing colour-coded crime markers across the city.
- **Route Search Panel:** Origin and destination input fields with travel time selector and safety preferences accessible below.
- **Route Comparison Panel:** Once routes are fetched, route cards are displayed here with safety scores, distances, durations, and crime detail access.
- **Analytics Dashboard:** Accessible via the "Analytics" tab, showing city-wide crime statistics, type distributions, and high-severity areas.
- **Header Controls:** Buttons to toggle the crime heatmap, toggle police stations overlay, and switch between light and dark theme.

#### 8.2.3 Using Route Shield

**Step 1: Enter Origin and Destination**

- Click the Origin field and begin typing an area, road name, or landmark in Dhaka.
- A suggestion dropdown appears. Select the correct location from the list.
- Repeat for the Destination field.

**Step 2: Select Travel Time and Preferences**

- Choose whether you will travel during the **Day** or **Night** using the selector.
- Optionally expand the Safety Preferences section to adjust your Risk Tolerance level and crime type concern weights before searching.

**Step 3: Search for Routes**

- Click the **Find Safe Routes** button.
- Route Shield queries OSRM, GraphHopper, and OpenRouteService simultaneously, then computes safety scores for each returned route against the city crime database.

**Step 4: View Results**

- Up to three route cards appear in the comparison panel. Each card shows the safety score, distance, duration, and number of crimes within 500 m. A "Recommended" banner marks the highest-scoring route.
- On the map, each route is drawn in a distinct colour. Toggle individual routes on or off using the checkboxes on their cards.

**Step 5: Inspect Crime Details**

- Click **View Crimes** on any route card to open a modal listing all nearby crime incidents with their type, location name, severity, time of day, date, and news source.
- The crimes are simultaneously highlighted on the map as enlarged markers for spatial context.

**Step 6: Navigate**

- Click the **Navigate** button on the desired route card.
- Google Maps opens with the exact route pre-loaded using up to 8 sampled waypoints, ready for turn-by-turn navigation.

**Step 7: View Analytics (Optional)**

- Switch to the **Analytics** tab in the right panel.
- Review city-wide crime statistics, crime type breakdown, average severity, and the list of highest-risk areas in Dhaka.

### 8.3 Features and Functionalities

1. **Crime-Aware Multi-Route Generation**
   - Simultaneous querying of three independent routing engines for coverage and diversity.
   - Geometric deduplication ensures all presented routes are meaningfully distinct travel options.

2. **Multi-Factor Safety Scoring**
   - Six-factor weighted model incorporating crime type, severity, distance to route, time of day, user concern, and risk tolerance.
   - Scores presented on a clear 0–10 scale with Low, Medium, and High risk classifications.

3. **Personalized Safety Preferences**
   - Risk tolerance and per-category crime concern controls allow fully personalized safety scoring.
   - Preferences take effect immediately on the next route search.

4. **Interactive Crime Heatmap**
   - Real-time toggle for city-wide crime visualization across Dhaka.
   - Severity-coded circle markers with full-detail popups on click.

5. **Route Comparison Panel**
   - Side-by-side comparison of all alternative routes with safety scores, distances, and crime counts.
   - Recommended route clearly identified with prominent banner.

6. **Crime Detail Inspection**
   - Per-route crime listing modal with simultaneous map highlighting.
   - Each crime entry is traceable to its original news or police data source.

7. **Navigation Export**
   - One-tap export of any route to Google Maps with exact waypoint injection for faithful route following.

8. **City Analytics Dashboard**
   - Aggregate crime statistics for situational awareness independent of a route search.
   - Crime type distribution, day/night breakdown, average severity, and high-severity area rankings.

### 8.4 Challenges Addressed by Route Shield

1. **Lack of Crime-Aware Navigation:** Existing navigation tools route by time or distance only. Route Shield integrates verified crime data directly into the route ranking process.
2. **Multi-Source Data Fragmentation:** Crime data across Dhaka is scattered across police records and multiple news portals in two languages. Route Shield consolidates these into a single queryable database.
3. **Generic Safety Information:** Standard apps provide no personalization. Route Shield's preference system allows each user to weight safety factors according to their own risk profile and travel context.
4. **Route Monoculture from Single Services:** Any single routing engine tends to return variations of the same path. Querying three services in parallel and deduplicating results ensures genuinely distinct alternatives are always offered.

### 8.5 Access Route Shield

To run Route Shield locally, follow these steps:

**Frontend Setup:**

1. Clone the Route Shield frontend repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. The frontend will be available at `http://localhost:5173`

**Backend Setup:**

1. Clone the Route Shield backend repository.
2. Install required Python packages: `pip install -r requirements.txt`
3. Set the required environment variables: `MONGODB_URL`, `GRAPHHOPPER_API_KEY`, `ORS_API_KEY`
4. Start the API server: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

With these steps, Route Shield can be accessed from a local environment and used to perform crime-aware navigation across Dhaka city.

---

## 9. Test Report

This chapter presents the testing goals and a comprehensive set of test cases designed to validate the correctness, reliability, and usability of the Route Shield system.

### 9.1 High Level Description of Testing Goals

The primary testing goals for the Route Shield system are as follows:

- To validate that Route Shield meets its functional and non-functional navigation requirements.
- To ensure the system accurately retrieves and presents alternative routes between any two locations in Dhaka.
- To verify that the safety scoring engine correctly reflects crime proximity, type weighting, time of day, and user preferences.
- To confirm that crime data is correctly stored, retrieved via geospatial queries, and displayed on the map.
- To ensure user preference controls seamlessly affect safety score calculations.
- To test the robustness of the multi-service routing aggregation under partial service failure conditions.
- To confirm the usability and responsiveness of the interface across desktop screen sizes.
- To validate that the route deduplication logic correctly filters near-identical routes from multiple services.

### 9.2 Test Cases

Below is a set of test cases designed to evaluate Route Shield comprehensively.

---

**Test Case 1: Route Search with Valid Locations**

Test Scenario: A user enters a valid origin and destination in Dhaka and searches for routes.

Steps:

1. Enter "Gulshan 1" in the origin field and select from the suggestion dropdown.
2. Enter "Motijheel" in the destination field and select from the suggestion dropdown.
3. Click "Find Safe Routes".

Expected Outcome:

- Geocoding resolves both addresses to valid Dhaka coordinates.
- At least one route is returned and displayed on the map with correct polyline geometry.
- Each route card shows distance, duration, and a safety score.

Result: Passed. Three routes returned with correct geometry, distances, and safety scores within expected parameters.

---

**Test Case 2: Autocomplete Suggestions Prioritize Dhaka**

Test Scenario: A user types a location name that exists in multiple countries.

Steps:

1. Type "Mirpur" in the origin field.
2. Observe the suggestion dropdown results.

Expected Outcome:

- Suggestions display Dhaka-specific results at the top of the list.
- No results from other countries appear before Dhaka options.

Result: Passed. The Bangladesh country code filter and Dhaka display name filter correctly prioritize local results.

---

**Test Case 3: Day vs. Night Safety Score Difference**

Test Scenario: The same route pair produces different safety scores for Day and Night travel.

Steps:

1. Search for routes from Sadarghat to Farmgate with travel time set to **Day**. Record safety scores.
2. Repeat the identical search with travel time set to **Night**.

Expected Outcome:

- Routes with predominantly night-time crime records score lower in the Night search than in the Day search.
- The ordering of routes by safety score may change between the two searches.

Result: Passed. Night-time searches correctly amplify the risk contributions of night crimes via the 2.0× time factor and reduce day crime contributions via the 0.5× factor.

---

**Test Case 4: Safety Preferences Affect Route Scores**

Test Scenario: Changing the Risk Tolerance level alters the computed safety scores.

Steps:

1. Search for routes with Risk Tolerance set to **Balanced**. Record safety scores.
2. Change Risk Tolerance to **Cautious** and search again for the same route pair.

Expected Outcome:

- Safety scores in the Cautious search differ from the Balanced scores, reflecting the 1.5× overall risk multiplier.
- Routes near many crimes show a larger score reduction under Cautious settings.

Result: Passed. Risk tolerance multiplier correctly scales all per-crime risk contributions, producing measurably different scores across preference settings.

---

**Test Case 5: Route Deduplication Removes Near-Identical Routes**

Test Scenario: When multiple routing engines return routes with nearly identical duration and distance, only one should appear in the result set.

Steps:

1. Issue a route request for a short, well-connected origin-destination pair where routing services are likely to converge on the same path.
2. Inspect the returned routes for near-identical duration and distance values.

Expected Outcome:

- No two returned routes have both duration and distance within 8% of each other.
- At least one unique route from each differing service is represented.

Result: Passed. The dual-ratio threshold correctly filters service-converged duplicates while retaining geometrically distinct alternatives.

---

**Test Case 6: Crime Heatmap Toggle**

Test Scenario: The crime heatmap correctly shows and hides crime markers on the map.

Steps:

1. Load the application. Confirm crime circle markers are visible.
2. Click the **Hide Heatmap** button in the header.
3. Click the **Show Heatmap** button again.

Expected Outcome:

- Clicking Hide removes all crime circle markers from the map view.
- Clicking Show restores all crime markers at their original positions with correct severity colours.

Result: Passed. Heatmap toggle correctly controls crime marker visibility without affecting route polylines.

---

**Test Case 7: View Crimes Modal and Map Highlighting**

Test Scenario: Clicking "View Crimes" on a route card opens the crime detail modal and highlights those crimes on the map.

Steps:

1. Perform a route search and wait for results.
2. On a route card that reports nearby crimes, click **View Crimes**.

Expected Outcome:

- A modal appears listing all crimes proximate to that route with type, severity, date, time, and source.
- The map updates to highlight only the crimes belonging to that route with enlarged markers.

Result: Passed. Crime modal correctly lists the route-specific records. Map highlighting accurately filters to the selected route's crimes.

---

**Test Case 8: Google Maps Navigation Export**

Test Scenario: The Navigate button correctly launches Google Maps with the selected route's waypoints.

Steps:

1. Perform a route search and wait for results.
2. Click **Navigate** on the first route card.

Expected Outcome:

- Google Maps opens in a new tab with the origin, destination, and up to 8 intermediate waypoints pre-populated.
- The direction shown corresponds to the Route Shield route geometry.

Result: Passed. Google Maps correctly loads with route-specific waypoints within browser URL length limits.

---

**Test Case 9: Partial Routing Service Failure Handling**

Test Scenario: The system gracefully handles one or more routing services being unavailable.

Steps:

1. Simulate a routing service timeout by temporarily using an invalid API key for one service.
2. Perform a route search.

Expected Outcome:

- No unhandled exception or blank error screen is shown to the user.
- Routes are still returned from the remaining available services.
- The result appears normally, drawing from the two functioning services.

Result: Passed. The fault-tolerant service wrapper returns an empty list for the failed service. The system presents available results without exposing the backend error to the user.

---

**Test Case 10: Analytics Dashboard Data Accuracy**

Test Scenario: The analytics dashboard correctly reflects the crime data stored in the database.

Steps:

1. Navigate to the **Analytics** tab.
2. Note the total crime count, day/night split, and crime type distribution displayed.
3. Cross-reference with a direct API call to `/api/crimes/statistics`.

Expected Outcome:

- Total crime count on the dashboard matches the statistics API response.
- Day and night crime counts sum to the total.
- Crime type distribution percentages are correctly proportioned.

Result: Passed. Dashboard figures match the API response data. Aggregation logic correctly computes all statistical fields from the live database.

---

## 10. Conclusion

This document presents the necessary technical details for the development and operation of **Route Shield: Crime-Aware Smart Navigation for Dhaka City**. The scope, system architecture, processing methodology, and user interface have been thoroughly discussed. The multi-service routing aggregation, multi-factor safety scoring model, geospatial crime data pipeline, and personalized preference system collectively form a comprehensive crime-aware navigation solution tailored to the specific urban context of Dhaka.

Scenario-based testing across all ten test cases confirms that Route Shield meets its functional requirements with respect to route accuracy, safety scoring correctness, preference personalization, deduplication logic, and graceful fault handling. Images and figures are provided throughout this document to clarify the technical design and user workflow of the system.

While Route Shield delivers robust crime-aware navigation, there remains scope for future improvement. Potential enhancements include real-time automated crime data updates from live news feeds, support for pedestrian and public transport routing modes, expansion to other major cities in Bangladesh, integration with official Bangladesh Police open data, and the addition of user accounts for saving frequently used routes and tracking personalized safety history over time.

This document provides a formal technical overview of Route Shield, ensuring that stakeholders, developers, and academic reviewers have a complete understanding of its design, algorithmic methodology, and operational behaviour.

---

_Route Shield © 2025 | Developed by Eftekhar Mahmud Efty_
