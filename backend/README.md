# Safe Route API Backend

FastAPI backend service for fetching alternative routes using OSRM (Open Source Routing Machine).

## Features

- 🚀 FastAPI-based REST API
- 🗺️ Integration with OSRM for route calculation
- 🔄 Multiple alternative routes support
- ✅ Input validation with Pydantic
- 🌐 CORS enabled for frontend integration
- 📊 Polyline decoding for efficient geometry handling

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
# Development mode with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### POST /api/routes

Fetch alternative routes between source and destination.

**Request Body:**

```json
{
  "source_lat": 23.7808,
  "source_lng": 90.4142,
  "dest_lat": 23.75,
  "dest_lng": 90.39,
  "alternatives": 3
}
```

**Response:**

```json
[
  {
    "distance": 5234.5,
    "duration": 890.0,
    "geometry": [
      {"lat": 23.7808, "lng": 90.4142},
      {"lat": 23.7810, "lng": 90.4145},
      ...
    ],
    "distance_text": "5.2 km",
    "duration_text": "15 mins",
    "route_index": 0
  },
  ...
]
```

### GET /api/health

Health check endpoint to verify API and OSRM availability.

**Response:**

```json
{
  "status": "healthy",
  "osrm_available": true
}
```

## OSRM Configuration

By default, the API uses the public OSRM server (`http://router.project-osrm.org`).

### Using Local OSRM Server

To use a local OSRM instance:

1. Update `osrm_service.py`:

   ```python
   osrm_service = OSRMService(base_url="http://localhost:5000")
   ```

2. Or modify the `OSRMService` initialization in `main.py`

### Setting up Local OSRM (Optional)

```bash
# Using Docker
docker run -t -i -p 5000:5000 osrm/osrm-backend osrm-routed --algorithm mld /data/bangladesh-latest.osrm
```

## Testing

### Using cURL

```bash
curl -X POST "http://localhost:8000/api/routes" \
  -H "Content-Type: application/json" \
  -d '{
    "source_lat": 23.7808,
    "source_lng": 90.4142,
    "dest_lat": 23.7500,
    "dest_lng": 90.3900,
    "alternatives": 3
  }'
```

### Using Python

```python
import requests

response = requests.post(
    "http://localhost:8000/api/routes",
    json={
        "source_lat": 23.7808,
        "source_lng": 90.4142,
        "dest_lat": 23.7500,
        "dest_lng": 90.3900,
        "alternatives": 3
    }
)

routes = response.json()
print(f"Found {len(routes)} routes")
```

## API Documentation

Once the server is running, visit:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── main.py              # FastAPI app and endpoints
├── models.py            # Pydantic models for request/response
├── osrm_service.py      # OSRM API integration
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Notes

- The public OSRM server has usage limits. For production, consider hosting your own OSRM instance.
- OSRM typically returns up to 3 alternative routes maximum.
- Coordinates are validated to ensure they're within valid ranges.
- Polyline encoding is used for efficient geometry transmission.

## Error Handling

The API handles various error scenarios:

- Invalid coordinates (400 Bad Request)
- No routes found (404 Not Found)
- OSRM service unavailable (500 Internal Server Error)
- Timeout errors (500 Internal Server Error)
