# 🎯 Quick Start - Google Maps Integration with Safety Scoring

## What Was Implemented

I've created a complete system that:

1. **Fetches multiple route alternatives** from Google Maps Direction API
2. **Analyzes each route** against crime heatmap data
3. **Calculates safety scores** (0-100) for each route
4. **Ranks routes** by safety score
5. **Displays routes** on an interactive map with color-coded risk levels

## 🚀 How to Use

### Option 1: Test with Mock Data (No API Key Needed)

The app is currently configured to work with mock data. Just:

```bash
npm run dev
```

Enter any origin and destination - it will show routes with calculated safety scores.

### Option 2: Use Real Google Maps API

#### Step 1: Get API Key

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Directions API**
3. Create an API key

#### Step 2: Configure

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your key
VITE_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

#### Step 3: Update App.tsx

Find this line in `src/App.tsx` (around line 35):

```typescript
const fetchedRoutes = await fetchRouteAlternativesMock(origin, destination);
```

Replace with:

```typescript
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const fetchedRoutes = await fetchRouteAlternatives(origin, destination, apiKey);
```

#### Step 4: Handle CORS

⚠️ **Important**: Google Maps API has CORS restrictions. For production, you need a backend proxy:

```typescript
// Frontend calls your backend
fetch("YOUR_BACKEND_URL/api/routes", {
  method: "POST",
  body: JSON.stringify({ origin, destination }),
});

// Your backend calls Google Maps and returns results
```

See `IMPLEMENTATION_GUIDE.md` for detailed backend examples.

## 📁 New Files Created

1. **src/types/route.types.ts** - TypeScript interfaces
2. **src/services/routeService.ts** - Google Maps API integration
3. **src/utils/safetyScoring.ts** - Safety calculation algorithms
4. **.env.example** - Environment variable template
5. **IMPLEMENTATION_GUIDE.md** - Detailed documentation

## 🔄 Modified Files

1. **src/App.tsx** - Added route state management and API calls
2. **src/components/RouteSearch.tsx** - Enhanced with loading states
3. **src/components/RouteComparison.tsx** - Works with dynamic routes
4. **src/components/MapView.tsx** - Renders dynamic routes with auto-fit

## 🎨 How It Works

### 1. User Input

```
User enters: "Mirpur 10, Dhaka" → "Gulshan 2, Dhaka"
```

### 2. API Call

```typescript
// Fetches multiple route alternatives
fetchRouteAlternatives(origin, destination, apiKey)
  ↓
Google Maps returns 2-3 different routes
```

### 3. Safety Analysis

For each route:

```typescript
// Decodes route coordinates
decodePolyline(route.overview_polyline.points)
  ↓
// Analyzes against crime data
calculateRouteSafetyScore(coordinates, crimes)
  ↓
// Returns: safety_score, risk_level, crimes_near_route
```

### 4. Scoring Algorithm

```
For each crime within 500m of route:
  - Distance factor: closer = higher risk
  - Severity factor: 1-10 scale
  - Time factor: night crimes × 1.5

Safety Score = 100 - (total risk penalty) - (high-risk segment penalty)

Risk Levels:
  - Low Risk: 75-100
  - Medium Risk: 50-74
  - High Risk: 0-49
```

### 5. Display

```
Routes sorted by safety (highest first)
Map shows:
  ✅ Green = Safe (85+)
  🟧 Orange = Moderate (70-84)
  🔴 Red = Risky (<70)
```

## 📊 Example Output

```javascript
Route 1: Via Gulshan Avenue
  Safety Score: 87/100
  Risk Level: Low
  Crimes nearby: 2
  Duration: 18 mins
  Distance: 6.2 km

Route 2: Via Banani
  Safety Score: 73/100
  Risk Level: Medium
  Crimes nearby: 5
  Duration: 16 mins
  Distance: 5.8 km

Route 3: Via Old Airport Road
  Safety Score: 45/100
  Risk Level: High
  Crimes nearby: 12
  Duration: 15 mins
  Distance: 5.5 km
```

## 🛠️ Technical Details

### Distance Calculation

Uses Haversine formula for accurate geo-distance:

```typescript
calculateDistance(lat1, lng1, lat2, lng2) → km
```

### Polyline Decoding

Decodes Google's compressed format:

```typescript
"_p~iF~ps|U_ulL..." → [{lat: 23.78, lng: 90.41}, ...]
```

### Route-to-Crime Distance

Finds minimum distance from crime point to any route segment:

```typescript
minDistanceToRoute(crime, routeCoordinates) → km
```

## 🎯 Key Features

✅ Multiple route alternatives
✅ Crime-based safety scoring
✅ Visual risk indicators (color-coded)
✅ Interactive map with toggleable routes
✅ Crime heatmap overlay
✅ Responsive design
✅ Dark mode support
✅ Loading & error states
✅ Auto-fit map bounds

## 📝 Next Steps

### For Development

- [ ] Test with mock data first
- [ ] Verify UI and safety calculations work
- [ ] Get Google Maps API key
- [ ] Test with real routes

### For Production

- [ ] Implement backend proxy for API calls
- [ ] Add API key restrictions (domain, API)
- [ ] Set up error tracking
- [ ] Add analytics
- [ ] Consider caching frequently requested routes
- [ ] Add rate limiting

### Future Enhancements

- [ ] Real-time traffic data
- [ ] Historical crime trend analysis
- [ ] User preferences (avoid tolls, highways)
- [ ] Save/share favorite routes
- [ ] Push notifications for route safety changes
- [ ] Multi-stop route planning

## 🐛 Common Issues

**Issue**: Routes not loading
**Solution**: Check console for errors, verify API key

**Issue**: CORS error
**Solution**: Use backend proxy (see IMPLEMENTATION_GUIDE.md)

**Issue**: Inaccurate safety scores
**Solution**: Update crime data in `src/data/dummyCrimes.ts`

## 📚 Documentation

- `IMPLEMENTATION_GUIDE.md` - Complete technical guide
- `ROUTE_SHIELD_README.md` - Original project documentation
- Code comments - Detailed inline documentation

## 💡 Tips

1. Start with mock data to test UI
2. Use dummy crime data to verify scoring algorithm
3. Test different locations to see variety in scores
4. Check console logs for debugging
5. Implement backend proxy before production

## 🙋 Questions?

Refer to `IMPLEMENTATION_GUIDE.md` for:

- Detailed API setup
- Backend proxy examples
- Security best practices
- Troubleshooting guide

---

**Status**: ✅ Ready to test with mock data
**Next Step**: Get Google Maps API key for real routes

Developed by Eftekhar Mahmud Efty (ID: 1309)
