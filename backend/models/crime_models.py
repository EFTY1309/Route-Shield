"""
Crime-related Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, List, Any
from datetime import datetime


class CrimeBase(BaseModel):
    """Base crime model with common fields"""
    lat: float = Field(..., description="Latitude of crime location")
    lng: float = Field(..., description="Longitude of crime location")
    crime_type: str = Field(..., description="Type of crime")
    time_of_day: str = Field(..., description="Day or Night")
    severity_score: int = Field(..., ge=1, le=10, description="Severity score (1-10)")
    location_name: str = Field(..., description="Name of the location")
    date: str = Field(..., description="Date of the crime (YYYY-MM-DD)")
    police_station: Optional[str] = Field(None, description="Police station jurisdiction")
    source: Optional[str] = Field(None, description="Data source")


class CrimeCreate(CrimeBase):
    """Model for creating a new crime record"""
    pass


class CrimeRecord(CrimeBase):
    """Model for crime record in API responses"""
    id: int = Field(..., description="Unique crime ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "lat": 23.7104,
                "lng": 90.4074,
                "crime_type": "Mugging",
                "time_of_day": "Night",
                "severity_score": 9,
                "location_name": "Sadarghat",
                "date": "2024-12-15",
                "police_station": "Kotwali",
                "source": "Prothom Alo"
            }
        }


class CrimeInDB(CrimeBase):
    """Model for crime record stored in MongoDB"""
    id: int
    location: Dict[str, Any] = Field(..., description="GeoJSON point for geospatial queries")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "lat": 23.7104,
                "lng": 90.4074,
                "location": {
                    "type": "Point",
                    "coordinates": [90.4074, 23.7104]  # [longitude, latitude]
                },
                "crime_type": "Mugging",
                "time_of_day": "Night",
                "severity_score": 9,
                "location_name": "Sadarghat",
                "date": "2024-12-15",
                "police_station": "Kotwali",
                "source": "Prothom Alo",
                "created_at": "2024-12-15T10:30:00",
                "updated_at": "2024-12-15T10:30:00"
            }
        }
    )


class CrimeStatistics(BaseModel):
    """Model for crime statistics"""
    total_crimes: int
    day_crimes: int
    night_crimes: int
    crime_type_distribution: Dict[str, int]
    average_severity: float
    high_severity_areas: List[CrimeRecord]
    data_period: str
    data_sources: List[str]
