"""
MongoDB connection and database operations.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure
from typing import Optional
import logging

from config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    """MongoDB connection manager"""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect_to_database(cls):
        """Establish connection to MongoDB"""
        try:
            logger.info("Connecting to MongoDB...")
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000,
                maxPoolSize=10,
                minPoolSize=1,
            )
            
            # Test the connection
            await cls.client.admin.command('ping')
            
            cls.db = cls.client[settings.MONGODB_DB_NAME]
            logger.info(f"Successfully connected to MongoDB database: {settings.MONGODB_DB_NAME}")
            
            # Create indexes for better performance
            await cls._create_indexes()
            
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {e}")
            raise
    
    @classmethod
    async def _create_indexes(cls):
        """Create database indexes for optimized queries"""
        if cls.db is None:
            return
        
        try:
            # Crime collection indexes
            crimes = cls.db[settings.CRIMES_COLLECTION]
            
            # Geospatial index for location-based queries
            await crimes.create_index([("location", "2dsphere")])
            
            # Regular indexes
            await crimes.create_index("crime_type")
            await crimes.create_index("time_of_day")
            await crimes.create_index("severity_score")
            await crimes.create_index("date")
            await crimes.create_index("police_station")
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Failed to create indexes: {e}")
    
    @classmethod
    async def close_database_connection(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed")
    
    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:
        """Get database instance"""
        if cls.db is None:
            raise Exception("Database not initialized. Call connect_to_database() first.")
        return cls.db


# Convenience function
async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    return MongoDB.get_database()
