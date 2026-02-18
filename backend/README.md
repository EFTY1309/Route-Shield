# Safe Route API - Backend

A FastAPI-based backend service for route optimization with crime data integration using MongoDB. The system provides route suggestions based on real-time crime data.

## 🏗️ Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration and settings management
├── migrate_data.py        # Data migration script (JSON to MongoDB)
├── start.py               # Quick start setup script
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (not in git)
├── .env.example          # Example environment file
│
├── models/               # Pydantic models for validation
│   ├── __init__.py
│   ├── route_models.py   # Route request/response models
│   └── crime_models.py   # Crime data models
│
├── services/             # Business logic layer
│   ├── __init__.py
│   ├── osrm_service.py   # OSRM route fetching service
│   └── crime_service.py  # Crime data management service
│
├── database/             # Database connections and operations
│   ├── __init__.py
│   └── mongodb.py        # MongoDB connection handler
│
├── utils/                # Utility functions
│   └── __init__.py
│
└── data/                 # Data files (for reference/migration)
    └── dhaka_crimes_2024.json
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run Setup Script

```bash
python start.py
```

This will:

- ✓ Check dependencies
- ✓ Test MongoDB connection
- ✓ Migrate crime data to MongoDB
- ✓ Verify setup

### 3. Start Server

```bash
python main.py
```

Or using uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## 📡 API Endpoints

### Health & Info

- `GET /` - Root endpoint (health check)
- `GET /api/health` - Detailed health check (OSRM + MongoDB status)

### Routes

- `POST /api/routes` - Fetch alternative routes

**Request body:**

```json
{
  "source_lat": 23.8103,
  "source_lng": 90.4125,
  "dest_lat": 23.7461,
  "dest_lng": 90.3742,
  "alternatives": 3
}
```

### Crime Data

- `GET /api/crimes` - Get all crime records
- `GET /api/crimes/area?lat={lat}&lng={lng}&radius={km}` - Get crimes by area
- `GET /api/crimes/time/{time_of_day}` - Filter by time (Day/Night)
- `GET /api/crimes/statistics` - Get crime statistics
- `POST /api/crimes` - Create new crime record
- `PUT /api/crimes/{crime_id}` - Update crime record
- `DELETE /api/crimes/{crime_id}` - Delete crime record

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
MONGODB_URL=your-mongodb-connection-string
MONGODB_DB_NAME=route_shield_db
OSRM_BASE_URL=http://router.project-osrm.org
GOOGLE_MAPS_API_KEY=your-api-key
```

### MongoDB Configuration

The MongoDB connection string is pre-configured in `config.py`. The database uses:

- **Database**: `route_shield_db`
- **Collection**: `crimes`
- **Indexes**: Geospatial index on `location` field for proximity queries

## 🗄️ Database Schema

### Crimes Collection

```json
{
  "id": 1,
  "lat": 23.7104,
  "lng": 90.4074,
  "location": {
    "type": "Point",
    "coordinates": [90.4074, 23.7104]
  },
  "crime_type": "Mugging",
  "time_of_day": "Night",
  "severity_score": 9,
  "location_name": "Sadarghat",
  "date": "2024-12-15",
  "police_station": "Kotwali",
  "source": "Prothom Alo",
  "created_at": "2024-12-15T10:30:00Z",
  "updated_at": "2024-12-15T10:30:00Z"
}
```

## 📦 Dependencies

- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Motor** - Async MongoDB driver
- **PyMongo** - MongoDB driver
- **Pydantic** - Data validation
- **HTTPX** - Async HTTP client
- **Polyline** - Polyline encoding/decoding

## 🔄 Data Migration

To migrate crime data from JSON to MongoDB:

```bash
python migrate_data.py
```

Select option 1 to migrate, option 2 to verify.

## 🧪 Testing

Access the interactive API documentation:

```
http://localhost:8000/docs
```

Test endpoints directly from the browser interface.

## 🚨 Troubleshooting

### MongoDB Connection Issues

- Verify connection string in `config.py`
- Check network access in MongoDB Atlas
- Whitelist your IP address

### OSRM Issues

- Public OSRM may have rate limits
- Check OSRM status at `/api/health`
- Consider running local OSRM server

### Migration Issues

- Ensure `data/dhaka_crimes_2024.json` exists
- Check MongoDB connection before migration
- Use verify option in migrate script

## 📊 Performance

- Database indexes created automatically on startup
- Connection pooling configured for MongoDB
- Async operations throughout
- Geospatial queries optimized with 2dsphere index

## 🤝 Contributing

1. Follow the existing project structure
2. Add type hints to all functions
3. Document all API endpoints
4. Test locally before committing

## 📄 License

MIT License
