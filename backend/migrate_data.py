"""
Data Migration Script
Migrates crime data from JSON file to MongoDB database.
"""
import asyncio
import json
from pathlib import Path
from datetime import datetime
import logging

from database import MongoDB
from services import CrimeService
from config import settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def migrate_crimes_to_mongodb():
    """Migrate crime data from JSON to MongoDB"""
    try:
        # Connect to MongoDB
        logger.info("Connecting to MongoDB...")
        await MongoDB.connect_to_database()
        
        # Initialize crime service
        crime_service = CrimeService()
        await crime_service.initialize()
        
        # Load JSON data
        json_file = Path(__file__).parent / "data" / "dhaka_crimes_2024.json"
        
        if not json_file.exists():
            logger.error(f"JSON file not found: {json_file}")
            return
        
        logger.info(f"Reading crime data from {json_file}...")
        with open(json_file, 'r', encoding='utf-8') as f:
            crimes_data = json.load(f)
        
        logger.info(f"Found {len(crimes_data)} crime records to migrate")
        
        # Check if collection already has data
        existing_count = await crime_service.collection.count_documents({})
        
        if existing_count > 0:
            logger.warning(f"Collection already has {existing_count} documents")
            response = input("Do you want to clear existing data and re-import? (yes/no): ")
            if response.lower() == 'yes':
                logger.info("Clearing existing data...")
                await crime_service.collection.delete_many({})
            else:
                logger.info("Skipping migration")
                return
        
        # Migrate data
        logger.info("Starting migration...")
        migrated_count = 0
        
        for crime in crimes_data:
            try:
                # Convert to DB format
                crime_doc = {
                    "id": crime["id"],
                    "lat": crime["lat"],
                    "lng": crime["lng"],
                    "location": {
                        "type": "Point",
                        "coordinates": [crime["lng"], crime["lat"]]  # [longitude, latitude]
                    },
                    "crime_type": crime["crime_type"],
                    "time_of_day": crime["time_of_day"],
                    "severity_score": crime["severity_score"],
                    "location_name": crime["location_name"],
                    "date": crime["date"],
                    "police_station": crime.get("police_station"),
                    "source": crime.get("source"),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await crime_service.collection.insert_one(crime_doc)
                migrated_count += 1
                
                if migrated_count % 10 == 0:
                    logger.info(f"Migrated {migrated_count}/{len(crimes_data)} records...")
            
            except Exception as e:
                logger.error(f"Error migrating crime ID {crime.get('id')}: {e}")
                continue
        
        logger.info(f"✓ Migration completed successfully!")
        logger.info(f"✓ Migrated {migrated_count} out of {len(crimes_data)} records")
        
        # Verify migration
        final_count = await crime_service.collection.count_documents({})
        logger.info(f"✓ Total documents in database: {final_count}")
        
        # Show some statistics
        stats = await crime_service.get_crime_statistics()
        logger.info(f"\nCrime Statistics:")
        logger.info(f"  Total Crimes: {stats['total_crimes']}")
        logger.info(f"  Day Crimes: {stats['day_crimes']}")
        logger.info(f"  Night Crimes: {stats['night_crimes']}")
        logger.info(f"  Average Severity: {stats['average_severity']}")
        logger.info(f"  Crime Types: {len(stats['crime_type_distribution'])}")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        # Close MongoDB connection
        await MongoDB.close_database_connection()
        logger.info("Database connection closed")


async def verify_migration():
    """Verify that migration was successful"""
    try:
        await MongoDB.connect_to_database()
        
        crime_service = CrimeService()
        await crime_service.initialize()
        
        # Get sample crimes
        logger.info("\nVerifying migration...")
        crimes = await crime_service.get_all_crimes()
        
        if crimes:
            logger.info(f"✓ Found {len(crimes)} crimes in database")
            logger.info(f"\nSample crime record:")
            sample = crimes[0]
            for key, value in sample.items():
                logger.info(f"  {key}: {value}")
        else:
            logger.warning("⚠ No crimes found in database")
        
        await MongoDB.close_database_connection()
        
    except Exception as e:
        logger.error(f"Verification failed: {e}")


async def main():
    """Main migration function"""
    print("=" * 60)
    print("CRIME DATA MIGRATION TOOL")
    print("=" * 60)
    print("\nThis tool will migrate crime data from JSON to MongoDB")
    print(f"Database: {settings.MONGODB_DB_NAME}")
    print(f"Collection: {settings.CRIMES_COLLECTION}")
    print("=" * 60)
    
    choice = input("\n1. Migrate data\n2. Verify migration\n3. Exit\n\nChoice: ")
    
    if choice == "1":
        await migrate_crimes_to_mongodb()
    elif choice == "2":
        await verify_migration()
    else:
        print("Exiting...")


if __name__ == "__main__":
    asyncio.run(main())
