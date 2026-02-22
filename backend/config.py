"""
Configuration file for the application.
Manages environment variables and application settings.
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # MongoDB Configuration
    MONGODB_URL: str = "mongodb+srv://bsse1309_db_user:llejMmHroPiPdqgx@route-shield.jxwo7j5.mongodb.net/?appName=Route-shield"
    MONGODB_DB_NAME: str = "route_shield_db"
    
    # Collections
    CRIMES_COLLECTION: str = "crimes"
    ROUTES_COLLECTION: str = "routes"
    
    # API Configuration
    API_TITLE: str = "Safe Route API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "API for fetching alternative routes with crime data integration"
    
    # OSRM Configuration
    OSRM_BASE_URL: str = "http://router.project-osrm.org"
    OSRM_TIMEOUT: float = 30.0

    # GraphHopper Configuration
    # Free API key: https://www.graphhopper.com/ (500 req/day)
    # Leave empty when using a self-hosted instance.
    GRAPHHOPPER_BASE_URL: str = "https://graphhopper.com/api/1"
    GRAPHHOPPER_API_KEY: str = "2bfd8414-31c7-4729-97ce-072061aca724"

    # OpenRouteService Configuration
    # Free API key: https://openrouteservice.org/dev/#/signup (2000 req/day)
    # Leave empty to skip ORS and rely on OSRM + GraphHopper only.
    ORS_API_KEY: str = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjU0MTY5YzE5ZDc2ZTRmNTg5ZDc3YWRjN2I2ZGJiYzJmIiwiaCI6Im11cm11cjY0In0="
    
    # Google Maps API Key (optional)
    GOOGLE_MAPS_API_KEY: Optional[str] = "AIzaSyC18Zap4u66Qek3bfphvJvu-jcRQdH2WaQ"
    
    # CORS Configuration
    ALLOWED_ORIGINS: list = ["*"]  # In production, specify your frontend URL
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()
