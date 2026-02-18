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
    
    # Google Maps API Key (optional)
    GOOGLE_MAPS_API_KEY: Optional[str] = "AIzaSyC18Zap4u66Qek3bfphvJvu-jcRQdH2WaQ"
    
    # CORS Configuration
    ALLOWED_ORIGINS: list = ["*"]  # In production, specify your frontend URL
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()
