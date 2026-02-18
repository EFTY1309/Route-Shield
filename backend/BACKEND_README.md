# Safe Route API - Backend

A FastAPI-based backend service for route optimization with crime data integration. The system provides route suggestions based on real-time crime data stored in MongoDB.

## 🏗️ Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration and settings management
├── migrate_data.py        # Data migration script (JSON to MongoDB)
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

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or higher
- MongoDB Atlas account (or local MongoDB)
- pip (Python package manager)

### Installation

1. **Clone the repository** (if not already done)

2. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

3. **Create virtual environment:**

   ```bash
   python -m venv venv
   ```

4. **Activate virtual environment:**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

5. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

6. **Set up environment variables:**
   ```bash
   copy .env.example .env
   ```
   Then edit `.env` with your actual credentials (MongoDB connection string is already configured).

### Database Setup

1. **Migrate data to MongoDB:**

   ```bash
   python migrate_data.py
   ```

   - Select option 1 to migrate data from JSON to MongoDB
   - This will transfer all crime data from `data/dhaka_crimes_2024.json` to MongoDB

2. **Verify migration:**
   ```bash
   python migrate_data.py
   ```

   - Select option 2 to verify the migration was successful

### Running the Application

**Start the development server:**

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/docs
- Alternative Docs: http://localhost:8000/redoc

## 📡 API Endpoints

### Health & Info

- `GET /` - Root endpoint (health check)
- `GET /api/health` - Detailed health check (OSRM + MongoDB status)

### Routes

- `POST /api/routes` - Fetch alternative routes
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
- `GET /api/crimes/area?lat=23.8103&lng=90.4125&radius=5.0` - Get crimes by area
- `GET /api/crimes/time/{time_of_day}` - Filter by time (Day/Night)
- `GET /api/crimes/statistics` - Get crime statistics
- `POST /api/crimes` - Create new crime record
- `PUT /api/crimes/{crime_id}` - Update crime record
- `DELETE /api/crimes/{crime_id}` - Delete crime record

## 🔧 Configuration

### MongoDB Configuration

Edit `config.py` or use environment variables:

- `MONGODB_URL` - MongoDB connection string
- `MONGODB_DB_NAME` - Database name (default: `route_shield_db`)
- `CRIMES_COLLECTION` - Collection name for crimes
- `ROUTES_COLLECTION` - Collection name for routes

### OSRM Configuration

- `OSRM_BASE_URL` - OSRM server URL (default: public OSRM)
- `OSRM_TIMEOUT` - Request timeout in seconds

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

### Indexes

- Geospatial index on `location` for proximity queries
- Regular indexes on `crime_type`, `time_of_day`, `severity_score`, `date`, `police_station`

## 📦 Dependencies

- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Motor** - Async MongoDB driver
- **PyMongo** - MongoDB driver
- **Pydantic** - Data validation
- **HTTPX** - Async HTTP client
- **Polyline** - Polyline encoding/decoding

## 🔒 Security Notes

- Never commit `.env` file to version control
- Use environment variables for sensitive data
- In production, restrict CORS origins
- Implement rate limiting for public APIs
- Use authentication/authorization for write operations

## 📝 Development Notes

### Adding New Endpoints

1. Define models in `models/`
2. Implement business logic in `services/`
3. Create endpoints in `main.py`

### Database Operations

- Use the `CrimeService` class for all crime data operations
- Service handles MongoDB connection and query optimization
- Geospatial queries use MongoDB's built-in 2dsphere index

### Testing

```bash
# Run with auto-reload
uvicorn main:app --reload

# Access interactive API docs
http://localhost:8000/docs
```

## 🐛 Troubleshooting

### MongoDB Connection Issues

- Verify connection string in `.env`
- Check network access in MongoDB Atlas (whitelist IP)
- Ensure database user has proper permissions

### OSRM Issues

- Public OSRM may have rate limits
- Consider running local OSRM server for development
- Check OSRM status at `/api/health`

### Migration Issues

- Ensure JSON file exists at `data/dhaka_crimes_2024.json`
- Check MongoDB connection before migration
- Use option 2 in migrate script to verify

## 📊 Performance Optimization

- Database indexes created automatically on startup
- Connection pooling configured for MongoDB
- Async operations throughout for better performance
- Geospatial queries optimized with 2dsphere index

## 🤝 Contributing

1. Follow the existing project structure
2. Add type hints to all functions
3. Document all API endpoints
4. Test locally before committing
5. Update this README for major changes

## 📄 License

[Your License Here]

## 👥 Contact

For questions or support, contact: [Your Contact Info]
