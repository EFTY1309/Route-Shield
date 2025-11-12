# Route Shield - Crime-Aware Smart Navigation System

**Developer:** Eftekhar Mahmud Efty (ID: 1309)  
**Institution:** Institute of Information Technology (IIT), University of Dhaka  
**Project Type:** Frontend Prototype with Dummy Data

## 🎯 Project Overview

Route Shield is a crime-aware route advisor that helps users navigate Dhaka with safety in mind. Unlike traditional navigation apps that focus solely on speed, Route Shield factors in crime risks specific to locations and times, providing users with safer route alternatives.

## ✨ Features Implemented

### 1. 🗺️ Interactive Map (Leaflet)

- **Multiple Route Display**: Shows 4 different route options across Dhaka with dummy coordinates
- **Color-Coded Routes**:
  - 🟢 Green = Safe routes (Safety Score 85+)
  - 🟠 Orange = Moderate risk (Safety Score 70-84)
  - 🔴 Red = Higher risk (Safety Score <70)
- **Start/End Markers**: Green marker for start point, red marker for destination
- **Hover Effects**: Gold highlight when hovering over routes
- **Popup Information**: Detailed route info on click (duration, distance, safety score, description)

### 2. 🔥 Crime Heatmap Overlay

- **30 Crime Hotspots**: Dummy data points across Dhaka with realistic coordinates
- **Severity-Based Visualization**:
  - Circle size scales with severity (1-10)
  - Color gradient from green (low) to red (high)
- **Detailed Crime Info**: Popup shows crime type, location, time of day, severity, and date
- **Toggle Visibility**: Show/Hide heatmap button in header

### 3. 📊 Dashboard Panel (Analytics Tab)

- **Crime Statistics Cards**:
  - Total crimes reported (last 7 days)
  - Average severity score
  - Day vs Night crime counts
- **Interactive Charts** (using Recharts):
  - Bar chart showing crimes by time of day
  - Pie chart showing crime type distribution (Mugging, Theft, Robbery, etc.)
- **Recent Crime Hotspots**: Scrollable list of top 8 high-severity crime locations
- **Responsive Design**: Adapts to different screen sizes

### 4. 🛣️ Route Comparison UI (Routes Tab)

- **4 Route Cards** with detailed information:
  - Route 1: Fastest but Higher Risk (Safety Score: 68)
  - Route 2: Safer but Slightly Longer (Safety Score: 89)
  - Route 3: Direct with Moderate Risk (Safety Score: 72)
  - Route 4: Balanced Route (Safety Score: 82)
- **Interactive Features**:
  - Click to toggle route visibility on map
  - Visual feedback with checkboxes
  - Safety score progress bars
  - Risk level badges (Low/Medium/High)
- **Route Details**: Duration, distance, crimes on route, and descriptive explanation

### 5. 🌗 Light/Dark Theme Toggle

- **Persistent Theme**: Saves preference to localStorage
- **Complete Dark Mode**: All components styled for both themes
- **Map Theme Switching**: Dark map tiles for dark mode
- **Smooth Transitions**: CSS transitions for theme changes

### 6. 🎨 Additional Features

- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Professional UI**: Clean design with Tailwind CSS
- **Legend**: Map legend showing route safety levels and crime severity
- **Sticky Header**: Navigation stays visible while scrolling
- **Branded Footer**: Project attribution

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Map Library**: Leaflet (react-leaflet)
- **Charts**: Recharts
- **State Management**: React Context API (Theme) + useState (App State)
- **Icons**: Heroicons (inline SVG)

## 📁 Project Structure

```
vite-project/
├── src/
│   ├── components/
│   │   ├── MapView.tsx          # Interactive Leaflet map with routes & heatmap
│   │   ├── Dashboard.tsx        # Analytics dashboard with charts
│   │   └── RouteComparison.tsx  # Route comparison cards
│   ├── context/
│   │   └── ThemeContext.tsx     # Light/Dark theme provider
│   ├── data/
│   │   ├── dummyCrimes.ts       # 30 crime data points (Dhaka locations)
│   │   └── dummyRoutes.ts       # 4 route options with coordinates
│   ├── App.tsx                  # Main application layout
│   ├── App.css                  # Custom styles
│   ├── index.css                # Tailwind imports
│   └── main.tsx                 # React entry point
├── public/
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone/Navigate to the project**:

   ```bash
   cd "i:\Desktop\All folders\SPL-3\Frontend\vite-project"
   ```

2. **Install dependencies** (already done):

   ```bash
   npm install
   ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

4. **Open in browser**:
   - Navigate to: `http://localhost:5174/` (or the port shown in terminal)

### Build for Production

```bash
npm run build
npm run preview
```

## 📊 Dummy Data Details

### Crime Data (30 entries)

- **Locations**: Covers major Dhaka areas (Mirpur, Gulshan, Dhanmondi, Motijheel, etc.)
- **Crime Types**: Mugging, Robbery, Theft, Snatching, Pickpocketing
- **Time Distribution**: Mix of day and night crimes
- **Severity Range**: 3-9 (out of 10)
- **Date Range**: Last 7 days (Nov 7-11, 2025)

### Route Data (4 routes)

- **Route 1**: Mirpur 10 → Gulshan 2 (Fastest, 8.5km, 22min, Safety: 68)
- **Route 2**: Mirpur 10 → Gulshan 2 (Safer, 10.2km, 28min, Safety: 89)
- **Route 3**: Dhanmondi 27 → Motijheel (Direct, 6.8km, 18min, Safety: 72)
- **Route 4**: Dhanmondi 27 → Motijheel (Balanced, 7.5km, 21min, Safety: 82)

## 🎨 Design Decisions

1. **Color Coding**: Intuitive green-to-red spectrum for safety visualization
2. **Tab Navigation**: Separate tabs for Routes and Analytics to avoid clutter
3. **Hover Interactions**: Enhanced user feedback with hover effects
4. **Responsive Grid**: 2-column layout on desktop, stacked on mobile
5. **Dark Mode**: Professional dark theme for reduced eye strain

## 🔮 Future Enhancements (Backend Integration)

When integrating with the real backend:

1. Replace dummy data with API calls to FastAPI backend
2. Add real-time crime data updates
3. Implement user authentication
4. Add route search functionality (origin/destination input)
5. Integrate Google Maps Directions API
6. Add time-based routing (consider user's travel time)
7. Implement crime reporting feature
8. Add user preferences and saved routes

## 📝 Notes

- This is a **frontend prototype only** - no backend or API integration
- All data is **hardcoded/dummy** for demonstration purposes
- The map uses **OpenStreetMap** tiles (free, no API key required)
- Leaflet markers use **external URLs** for colored markers
- Crime coordinates are **approximate** Dhaka locations

## 👤 Developer Info

**Name**: Eftekhar Mahmud Efty  
**Roll**: 1309  
**Phone**: 01838287228  
**Supervisor**: Dr. Md Shariful Islam  
**Institution**: Institute of Information Technology (IIT), University of Dhaka

---

**Project Status**: ✅ Prototype Complete (Frontend Only)  
**Last Updated**: November 12, 2025
