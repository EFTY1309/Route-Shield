"""
Crime Service for managing crime data with MongoDB.
"""
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
import math
import logging

from models import CrimeRecord, CrimeCreate, CrimeInDB, CrimeStatistics
from database import get_database
from config import settings

logger = logging.getLogger(__name__)


class CrimeService:
    """Service for managing crime data in MongoDB"""
    
    def __init__(self):
        """Initialize crime service"""
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.collection_name = settings.CRIMES_COLLECTION
    
    async def initialize(self):
        """Initialize database connection"""
        self.db = await get_database()
        self.collection = self.db[self.collection_name]
    
    async def get_all_crimes(self) -> List[Dict]:
        """Get all crime records from database"""
        try:
            crimes = []
            cursor = self.collection.find({}, {"_id": 0})
            async for crime in cursor:
                crimes.append(self._convert_from_db(crime))
            return crimes
        except Exception as e:
            logger.error(f"Error fetching crimes: {e}")
            raise
    
    async def get_crime_by_id(self, crime_id: int) -> Optional[Dict]:
        """Get a specific crime by ID"""
        try:
            crime = await self.collection.find_one({"id": crime_id}, {"_id": 0})
            if crime:
                return self._convert_from_db(crime)
            return None
        except Exception as e:
            logger.error(f"Error fetching crime {crime_id}: {e}")
            raise
    
    async def get_crimes_by_area(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0
    ) -> List[Dict]:
        """
        Get crimes within a radius of a location using MongoDB geospatial query.
        
        Args:
            lat: Latitude of center point
            lng: Longitude of center point
            radius_km: Radius in kilometers
            
        Returns:
            List of crime records within the radius
        """
        try:
            # Convert km to meters for MongoDB
            radius_meters = radius_km * 1000
            
            # MongoDB geospatial query
            query = {
                "location": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [lng, lat]  # [longitude, latitude]
                        },
                        "$maxDistance": radius_meters
                    }
                }
            }
            
            crimes = []
            cursor = self.collection.find(query, {"_id": 0})
            async for crime in cursor:
                crimes.append(self._convert_from_db(crime))
            
            return crimes
        except Exception as e:
            logger.error(f"Error fetching crimes by area: {e}")
            raise
    
    async def get_crimes_by_time(self, time_of_day: str) -> List[Dict]:
        """Filter crimes by time of day (Day/Night)"""
        try:
            crimes = []
            cursor = self.collection.find(
                {"time_of_day": time_of_day},
                {"_id": 0}
            )
            async for crime in cursor:
                crimes.append(self._convert_from_db(crime))
            return crimes
        except Exception as e:
            logger.error(f"Error fetching crimes by time: {e}")
            raise
    
    async def get_crimes_by_type(self, crime_type: str) -> List[Dict]:
        """Filter crimes by type"""
        try:
            crimes = []
            cursor = self.collection.find(
                {"crime_type": crime_type},
                {"_id": 0}
            )
            async for crime in cursor:
                crimes.append(self._convert_from_db(crime))
            return crimes
        except Exception as e:
            logger.error(f"Error fetching crimes by type: {e}")
            raise
    
    async def get_crime_statistics(self) -> Dict:
        """Get aggregated crime statistics"""
        try:
            # Get all crimes for statistics
            all_crimes = await self.get_all_crimes()
            
            if not all_crimes:
                return {
                    "total_crimes": 0,
                    "day_crimes": 0,
                    "night_crimes": 0,
                    "crime_type_distribution": {},
                    "average_severity": 0,
                    "high_severity_areas": [],
                    "data_period": "No data available",
                    "data_sources": []
                }
            
            total = len(all_crimes)
            day_crimes = len([c for c in all_crimes if c.get("time_of_day") == "Day"])
            night_crimes = len([c for c in all_crimes if c.get("time_of_day") == "Night"])
            
            # Crime type distribution
            crime_types = {}
            sources = set()
            for crime in all_crimes:
                crime_type = crime.get("crime_type", "Unknown")
                crime_types[crime_type] = crime_types.get(crime_type, 0) + 1
                if crime.get("source"):
                    sources.add(crime["source"])
            
            # Average severity
            total_severity = sum(c.get("severity_score", 0) for c in all_crimes)
            avg_severity = total_severity / total if total > 0 else 0
            
            # High severity areas (top 10)
            sorted_crimes = sorted(
                all_crimes,
                key=lambda x: x.get("severity_score", 0),
                reverse=True
            )[:10]
            
            return {
                "total_crimes": total,
                "day_crimes": day_crimes,
                "night_crimes": night_crimes,
                "crime_type_distribution": crime_types,
                "average_severity": round(avg_severity, 2),
                "high_severity_areas": sorted_crimes,
                "data_period": "January 2024 - January 2025",
                "data_sources": list(sources)
            }
        except Exception as e:
            logger.error(f"Error generating statistics: {e}")
            raise
    
    async def create_crime(self, crime_data: Dict) -> Dict:
        """Create a new crime record"""
        try:
            # Generate new ID
            max_id = await self.collection.find_one(
                {},
                sort=[("id", -1)],
                projection={"id": 1}
            )
            new_id = (max_id["id"] + 1) if max_id else 1
            
            # Prepare crime document
            crime_doc = self._convert_to_db(crime_data, new_id)
            
            # Insert into database
            await self.collection.insert_one(crime_doc)
            
            return self._convert_from_db(crime_doc)
        except Exception as e:
            logger.error(f"Error creating crime: {e}")
            raise
    
    async def update_crime(self, crime_id: int, crime_data: Dict) -> Optional[Dict]:
        """Update an existing crime record"""
        try:
            crime_data["updated_at"] = datetime.utcnow()
            
            # Update location if lat/lng changed
            if "lat" in crime_data and "lng" in crime_data:
                crime_data["location"] = {
                    "type": "Point",
                    "coordinates": [crime_data["lng"], crime_data["lat"]]
                }
            
            result = await self.collection.update_one(
                {"id": crime_id},
                {"$set": crime_data}
            )
            
            if result.modified_count > 0:
                return await self.get_crime_by_id(crime_id)
            return None
        except Exception as e:
            logger.error(f"Error updating crime {crime_id}: {e}")
            raise
    
    async def delete_crime(self, crime_id: int) -> bool:
        """Delete a crime record"""
        try:
            result = await self.collection.delete_one({"id": crime_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting crime {crime_id}: {e}")
            raise
    
    def _convert_to_db(self, crime_data: Dict, crime_id: int) -> Dict:
        """Convert crime data to MongoDB document format"""
        now = datetime.utcnow()
        return {
            "id": crime_id,
            "lat": crime_data["lat"],
            "lng": crime_data["lng"],
            "location": {
                "type": "Point",
                "coordinates": [crime_data["lng"], crime_data["lat"]]  # [lng, lat]
            },
            "crime_type": crime_data["crime_type"],
            "time_of_day": crime_data["time_of_day"],
            "severity_score": crime_data["severity_score"],
            "location_name": crime_data["location_name"],
            "date": crime_data["date"],
            "police_station": crime_data.get("police_station"),
            "source": crime_data.get("source"),
            "created_at": now,
            "updated_at": now
        }
    
    def _convert_from_db(self, crime_doc: Dict) -> Dict:
        """Convert MongoDB document to API response format"""
        return {
            "id": crime_doc["id"],
            "lat": crime_doc["lat"],
            "lng": crime_doc["lng"],
            "crime_type": crime_doc["crime_type"],
            "time_of_day": crime_doc["time_of_day"],
            "severity_score": crime_doc["severity_score"],
            "location_name": crime_doc["location_name"],
            "date": crime_doc["date"],
            "police_station": crime_doc.get("police_station"),
            "source": crime_doc.get("source")
        }


# Global service instance
crime_service = CrimeService()
