from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn

from osrm_service import OSRMService
from models import RouteRequest, RouteResponse

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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
