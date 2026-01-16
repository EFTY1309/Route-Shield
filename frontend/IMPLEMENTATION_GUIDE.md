# Route Shield - Implementation Guide

## 🎯 Overview

This application fetches multiple route alternatives from Google Maps Direction API, analyzes them based on crime heatmap data, and assigns safety scores to help users choose the safest route.

## 🔧 How It Works

### 1. **User Input**

- User enters a start location and end location in the `RouteSearch` component
- Can use quick location buttons or type custom addresses

### 2. **API Integration** (`src/services/routeService.ts`)

- **fetchRouteAlternatives()**: Calls Google Maps Direction API with `alternatives=true`
- Google Maps returns multiple route options (usually 2-3 alternatives)
- Each route contains:
  - Overview polyline (encoded path)
  - Distance and duration
  - Route summary/name

### 3. **Route Processing**

- **decodePolyline()**: Decodes Google's encoded polyline to array of coordinates
- Converts compressed format to latitude/longitude pairs for mapping

### 4. **Safety Scoring** (`src/utils/safetyScoring.ts`)

- **calculateRouteSafetyScore()**: Analyzes each route against crime data
- For each crime point:
  - Calculates minimum distance to the route path
  - If within 500m threshold, factors in:
    - Distance from route (closer = higher risk)
    - Crime severity score (1-10)
    - Time of day (night crimes weighted 1.5x)
- Generates safety score (0-100, where 100 is safest)
- Determines risk level: Low (75+), Medium (50-74), High (<50)
- Identifies high-risk segments (areas with 3+ nearby crimes)

### 5. **Route Ranking**

- Routes sorted by safety score (highest first)
- If safety scores are similar (within 10 points), faster route preferred
- Each route gets a descriptive name and safety summary

### 6. **Display**

- **RouteComparison**: Shows all routes with safety scores, duration, distance
- **MapView**: Renders routes on map with color coding:
  - Green: Safe (85+ score)
  - Orange: Moderate (70-84 score)
  - Red: Risky (<70 score)
- Crime heatmap overlay shows crime density
- Users can toggle routes on/off to compare

## 🚀 Setup Instructions

### Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Directions API**
4. Create API key under Credentials
5. Restrict key to Directions API for security

### Step 2: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

### Step 3: Update Code for Production

In `src/App.tsx`, replace the mock implementation:

```typescript
// Current (mock):
const fetchedRoutes = await fetchRouteAlternativesMock(origin, destination);

// Production (real API):
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const fetchedRoutes = await fetchRouteAlternatives(origin, destination, apiKey);
```

### Step 4: Handle CORS (Important!)

Google Maps Directions API has CORS restrictions when called from browser. You have 2 options:

#### Option A: Backend Proxy (Recommended for Production)

Create a backend endpoint that calls Google Maps API:

```
Frontend -> Your Backend -> Google Maps API -> Your Backend -> Frontend
```

#### Option B: CORS Proxy (Development Only)

Use the `fetchRouteAlternativesWithProxy()` function (not recommended for production)

#### Option C: Use Backend Implementation

Best practice: Implement this in your backend (Python/Node.js):

```python
# Example Python/Flask backend
@app.route('/api/routes', methods=['POST'])
def get_routes():
    origin = request.json['origin']
    destination = request.json['destination']

    # Call Google Maps API from backend
    response = requests.get(
        'https://maps.googleapis.com/maps/api/directions/json',
        params={
            'origin': origin,
            'destination': destination,
            'alternatives': 'true',
            'key': GOOGLE_MAPS_API_KEY
        }
    )

    return jsonify(response.json())
```

## 📊 Safety Scoring Algorithm

### Distance Calculation

- Uses Haversine formula for accurate distance between coordinates
- Calculates minimum distance from each crime point to route segments

### Risk Factors

1. **Proximity**: Crimes within 500m of route
2. **Severity**: Crime severity score (1-10)
3. **Time**: Night crimes weighted higher (1.5x multiplier)
4. **Density**: High-risk segments with multiple crimes

### Score Formula

```
Base Score = 100
Risk Penalty = Σ (distanceFactor × severityFactor × timeFactor × 10) × 0.5
High Risk Penalty = highRiskSegments × 5
Final Score = max(0, Base Score - Risk Penalty - High Risk Penalty)
```

## 🎨 Features

### Current Implementation

✅ Route search with origin/destination input
✅ Google Maps API integration (with mock fallback)
✅ Polyline decoding for route visualization
✅ Crime-based safety scoring algorithm
✅ Multiple route alternatives comparison
✅ Interactive map with route toggling
✅ Crime heatmap overlay
✅ Responsive design with dark mode
✅ Loading and error states

### Future Enhancements

- Real-time traffic integration
- Historical crime data analysis
- User route preferences (avoid tolls, highways)
- Save favorite routes
- Share routes with others
- Mobile app version
- Route notifications based on time of day

## 🔍 Testing Without API Key

The app includes a mock function that uses dummy data:

```typescript
fetchRouteAlternativesMock(origin, destination);
```

This allows you to test the UI and safety scoring without an API key. The mock data simulates typical Google Maps responses.

## 📝 Code Structure

```
src/
├── services/
│   └── routeService.ts       # Google Maps API integration
├── utils/
│   └── safetyScoring.ts      # Safety calculation algorithms
├── types/
│   └── route.types.ts        # TypeScript interfaces
├── components/
│   ├── RouteSearch.tsx       # Search form component
│   ├── RouteComparison.tsx   # Route list with scores
│   └── MapView.tsx           # Interactive map display
├── data/
│   └── dummyCrimes.ts        # Crime data (replace with real API)
└── App.tsx                   # Main application logic
```

## 🛡️ Security Notes

- Never commit your `.env` file to version control
- Restrict API keys to specific APIs and domains
- Consider rate limiting for production
- Validate and sanitize all user inputs
- Use HTTPS in production

## 📚 API Documentation

- [Google Maps Directions API](https://developers.google.com/maps/documentation/directions/overview)
- [Encoded Polyline Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)

## 🐛 Troubleshooting

### "API key not found"

- Check `.env` file exists and has correct key
- Restart dev server after adding `.env`
- Verify key format: `VITE_` prefix required

### "CORS error"

- Implement backend proxy
- Or use `fetchRouteAlternativesWithProxy()` for development

### "No routes found"

- Check API key permissions
- Verify Directions API is enabled
- Ensure origin/destination are valid locations

## 💡 Tips

1. **Testing**: Use the mock function first to ensure UI works
2. **Development**: Enable console logs in `routeService.ts`
3. **Production**: Always use backend proxy for API calls
4. **Performance**: Consider caching frequently requested routes
5. **UX**: Show loading states during API calls

---

Developed by Eftekhar Mahmud Efty (ID: 1309) | IIT, University of Dhaka
