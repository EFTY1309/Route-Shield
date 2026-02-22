"""
Import 2025 Crime Data Script
Imports dhaka_crimes_2025.json into MongoDB without clearing existing 2024 data.
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


async def import_2025_crimes():
    """Import 2025 crime data from JSON into MongoDB (appends to existing data)"""
    try:
        # Connect to MongoDB
        logger.info("Connecting to MongoDB...")
        await MongoDB.connect_to_database()

        # Initialize crime service
        crime_service = CrimeService()
        await crime_service.initialize()

        # Check existing document count
        existing_count = await crime_service.collection.count_documents({})
        logger.info(f"Existing documents in collection: {existing_count}")

        # Load 2025 JSON data
        json_file = Path(__file__).parent / "data" / "dhaka_crimes_2025.json"
        if not json_file.exists():
            logger.error(f"JSON file not found: {json_file}")
            return

        logger.info(f"Reading 2025 crime data from {json_file}...")
        with open(json_file, 'r', encoding='utf-8') as f:
            crimes_data = json.load(f)

        logger.info(f"Found {len(crimes_data)} crime records to import")

        # Check for duplicate IDs to avoid re-importing
        existing_ids = set()
        async for doc in crime_service.collection.find({}, {"id": 1}):
            if "id" in doc:
                existing_ids.add(doc["id"])

        new_crimes = [c for c in crimes_data if c["id"] not in existing_ids]
        skipped = len(crimes_data) - len(new_crimes)

        if skipped > 0:
            logger.warning(f"Skipping {skipped} records that already exist in the database (duplicate IDs).")

        if not new_crimes:
            logger.info("All records already exist. Nothing to import.")
            return

        logger.info(f"Importing {len(new_crimes)} new records...")
        imported_count = 0

        for crime in new_crimes:
            try:
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
                imported_count += 1

                if imported_count % 20 == 0:
                    logger.info(f"  Imported {imported_count}/{len(new_crimes)} records...")

            except Exception as e:
                logger.error(f"Error importing crime ID {crime.get('id')}: {e}")
                continue

        logger.info(f"✓ Import completed! Imported {imported_count} new records.")

        # Final stats
        final_count = await crime_service.collection.count_documents({})
        logger.info(f"✓ Total documents in database now: {final_count}")

    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise
    finally:
        await MongoDB.close_database_connection()
        logger.info("Database connection closed.")


if __name__ == "__main__":
    print("=" * 60)
    print("2025 CRIME DATA IMPORT TOOL")
    print("=" * 60)
    print(f"Database : {settings.MONGODB_DB_NAME}")
    print(f"Collection: {settings.CRIMES_COLLECTION}")
    print(f"File      : data/dhaka_crimes_2025.json  (100 records)")
    print("=" * 60)
    asyncio.run(import_2025_crimes())
