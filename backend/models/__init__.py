"""Models package initialization"""
from .route_models import RouteRequest, RouteResponse, Coordinate
from .crime_models import CrimeRecord, CrimeCreate, CrimeInDB, CrimeStatistics

__all__ = [
    "RouteRequest",
    "RouteResponse",
    "Coordinate",
    "CrimeRecord",
    "CrimeCreate",
    "CrimeInDB",
    "CrimeStatistics",
]
