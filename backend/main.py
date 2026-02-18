from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
import uvicorn
import logging

from config import settings
from database import MongoDB
from models import RouteRequest, RouteResponse
from services import OSRMService, CrimeService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan context manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting application...")
    try:
        await MongoDB.connect_to_database()
        await crime_service.initialize()
        logger.info("✓ Application started successfully")
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    await MongoDB.close_database_connection()
    logger.info("✓ Application shutdown complete")


# Initialize FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
osrm_service = OSRMService()
crime_service = CrimeService()


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Safe Route API is running",
        "status": "healthy",
        "version": settings.API_VERSION,
        "database": settings.MONGODB_DB_NAME
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
    
    # Check MongoDB connection
    try:
        db = MongoDB.get_database()
        await db.command('ping')
        db_status = True
    except:
        db_status = False
    
    return {
        "status": "healthy" if db_status else "degraded",
        "database_available": db_status,
        "database_name": settings.MONGODB_DB_NAME
    }


@app.get("/api/crimes")
async def get_all_crimes():
    """
    Get all crime records from Dhaka city (2024-2025).
    
    Returns:
        List of all crime records with location, type, severity, and source information
    """
    try:
        crimes = await crime_service.get_all_crimes()
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
        crimes = await crime_service.get_crimes_by_area(lat, lng, radius)
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
        crimes = await crime_service.get_crimes_by_time(time_of_day)
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
        stats = await crime_service.get_crime_statistics()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crime statistics: {str(e)}"
        )


@app.post("/api/crimes")
async def create_crime(crime_data: dict):
    """
    Create a new crime record.
    
    Args:
        crime_data: Crime data to create
        
    Returns:
        Created crime record
    """
    try:
        crime = await crime_service.create_crime(crime_data)
        return {
            "success": True,
            "data": crime,
            "message": "Crime record created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create crime record: {str(e)}"
        )


@app.put("/api/crimes/{crime_id}")
async def update_crime(crime_id: int, crime_data: dict):
    """
    Update an existing crime record.
    
    Args:
        crime_id: ID of the crime to update
        crime_data: Updated crime data
        
    Returns:
        Updated crime record
    """
    try:
        crime = await crime_service.update_crime(crime_id, crime_data)
        if crime:
            return {
                "success": True,
                "data": crime,
                "message": "Crime record updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Crime not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update crime record: {str(e)}"
        )


@app.delete("/api/crimes/{crime_id}")
async def delete_crime(crime_id: int):
    """
    Delete a crime record.
    
    Args:
        crime_id: ID of the crime to delete
        
    Returns:
        Success message
    """
    try:
        deleted = await crime_service.delete_crime(crime_id)
        if deleted:
            return {
                "success": True,
                "message": "Crime record deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Crime not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete crime record: {str(e)}"
        )



if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
