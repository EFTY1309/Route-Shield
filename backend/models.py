from pydantic import BaseModel, Field, field_validator
from typing import List, Optional


class RouteRequest(BaseModel):
    """Request model for route fetching"""
    source_lat: float = Field(..., ge=-90, le=90, description="Source latitude")
    source_lng: float = Field(..., ge=-180, le=180, description="Source longitude")
    dest_lat: float = Field(..., ge=-90, le=90, description="Destination latitude")
    dest_lng: float = Field(..., ge=-180, le=180, description="Destination longitude")
    alternatives: int = Field(default=3, ge=1, le=5, description="Number of alternative routes")
    
    @field_validator('source_lat', 'dest_lat')
    @classmethod
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @field_validator('source_lng', 'dest_lng')
    @classmethod
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v


class Coordinate(BaseModel):
    """Model for a single coordinate point"""
    lat: float
    lng: float


class RouteResponse(BaseModel):
    """Response model for a single route"""
    distance: float = Field(..., description="Distance in meters")
    duration: float = Field(..., description="Duration in seconds")
    geometry: List[Coordinate] = Field(..., description="List of coordinates forming the route")
    distance_text: str = Field(..., description="Human-readable distance (e.g., '5.2 km')")
    duration_text: str = Field(..., description="Human-readable duration (e.g., '15 mins')")
    route_index: int = Field(..., description="Index of the route (0 = primary, 1+ = alternatives)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "distance": 5234.5,
                "duration": 890.0,
                "geometry": [
                    {"lat": 23.7808, "lng": 90.4142},
                    {"lat": 23.7810, "lng": 90.4145}
                ],
                "distance_text": "5.2 km",
                "duration_text": "15 mins",
                "route_index": 0
            }
        }
