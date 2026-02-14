from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn

from osrm_service import OSRMService
from models import RouteRequest, RouteResponse
from crime_data import crime_service

# Initialize FastAPI app
app = FastAPI(
    title="Safe Route API",
    description="API for fetching alternative routes using OSRM",
    version="1.0.0"
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OSRM service
osrm_service = OSRMService()


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Safe Route API is running",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.post("/api/routes", response_model=List[RouteResponse])
async def get_routes(request: RouteRequest):
    """
    Fetch multiple alternative routes between source and destination.
    
    Args:
        request: RouteRequest containing source and destination coordinates
        
    Returns:
        List of routes with distance, duration, and geometry
        
    Raises:
        HTTPException: If OSRM request fails or coordinates are invalid
    """
    try:
        routes = await osrm_service.get_alternative_routes(
            source_lat=request.source_lat,
            source_lng=request.source_lng,
            dest_lat=request.dest_lat,
            dest_lng=request.dest_lng,
            alternatives=request.alternatives
        )
        
        if not routes:
            raise HTTPException(
                status_code=404,
                detail="No routes found between the given coordinates"
            )
        
        return routes
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    osrm_status = await osrm_service.check_osrm_availability()
    return {
        "status": "healthy" if osrm_status else "degraded",
        "osrm_available": osrm_status
    }


@app.get("/api/crimes")
async def get_all_crimes():
    """
    Get all crime records from Dhaka city (2024-2025).
    
    Returns:
        List of all crime records with location, type, severity, and source information
    """
    try:
        crimes = crime_service.get_all_crimes()
        return {
            "success": True,
            "data": crimes,
            "count": len(crimes)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crime data: {str(e)}"
        )


@app.get("/api/crimes/area")
async def get_crimes_by_area(
    lat: float = Query(..., description="Latitude of the location"),
    lng: float = Query(..., description="Longitude of the location"),
    radius: float = Query(5.0, description="Search radius in kilometers", ge=0.1, le=50.0)
):
    """
    Get crimes within a specific radius of a location.
    
    Args:
        lat: Latitude of the center point
        lng: Longitude of the center point
        radius: Search radius in kilometers (default: 5km)
        
    Returns:
        List of crime records within the specified radius
    """
    try:
        crimes = crime_service.get_crimes_by_area(lat, lng, radius)
        return {
            "success": True,
            "data": crimes,
            "count": len(crimes),
            "query": {
                "lat": lat,
                "lng": lng,
                "radius_km": radius
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crime data: {str(e)}"
        )


@app.get("/api/crimes/time/{time_of_day}")
async def get_crimes_by_time(time_of_day: str):
    """
    Filter crimes by time of day.
    
    Args:
        time_of_day: Either "Day" or "Night"
        
    Returns:
        List of crime records filtered by time of day
    """
    if time_of_day not in ["Day", "Night"]:
        raise HTTPException(
            status_code=400,
            detail="time_of_day must be either 'Day' or 'Night'"
        )
    
    try:
        crimes = crime_service.get_crimes_by_time(time_of_day)
        return {
            "success": True,
            "data": crimes,
            "count": len(crimes),
            "filter": time_of_day
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crime data: {str(e)}"
        )


@app.get("/api/crimes/statistics")
async def get_crime_statistics():
    """
    Get aggregated crime statistics for Dhaka city.
    
    Returns:
        Crime statistics including totals, distribution, and high-risk areas
    """
    try:
        stats = crime_service.get_crime_statistics()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crime statistics: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
