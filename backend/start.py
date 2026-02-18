"""
Quick Start Script
Helps you get started with the backend quickly.
"""
import asyncio
import sys
import subprocess
import os


def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")


async def check_dependencies():
    """Check if all required packages are installed"""
    print("Checking dependencies...")
    required_packages = [
        'fastapi', 'uvicorn', 'motor', 'pymongo',
        'pydantic', 'httpx', 'polyline'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"❌ Missing packages: {', '.join(missing)}")
        print("\nRun: pip install -r requirements.txt")
        return False
    
    print("✓ All dependencies installed")
    return True


async def test_mongodb_connection():
    """Test MongoDB connection"""
    print("\nTesting MongoDB connection...")
    try:
        from database import MongoDB
        await MongoDB.connect_to_database()
        print("✓ MongoDB connection successful")
        await MongoDB.close_database_connection()
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        print("\nPlease check:")
        print("  1. Your MongoDB connection string in config.py")
        print("  2. Your network connection")
        print("  3. MongoDB Atlas IP whitelist settings")
        return False


async def check_crime_data():
    """Check if crime data exists in MongoDB"""
    print("\nChecking crime data in MongoDB...")
    try:
        from database import MongoDB
        from services import CrimeService
        
        await MongoDB.connect_to_database()
        crime_service = CrimeService()
        await crime_service.initialize()
        
        crimes = await crime_service.get_all_crimes()
        count = len(crimes)
        
        print(f"✓ Found {count} crime records in database")
        
        await MongoDB.close_database_connection()
        return count > 0
    except Exception as e:
        print(f"⚠ Could not check crime data: {e}")
        return False


async def run_migration():
    """Run data migration"""
    print("\nRunning data migration...")
    try:
        from database import MongoDB
        from services import CrimeService
        import json
        from pathlib import Path
        from datetime import datetime
        
        await MongoDB.connect_to_database()
        crime_service = CrimeService()
        await crime_service.initialize()
        
        # Load JSON data
        json_file = Path(__file__).parent / "data" / "dhaka_crimes_2024.json"
        if not json_file.exists():
            print(f"❌ JSON file not found: {json_file}")
            return False
        
        with open(json_file, 'r', encoding='utf-8') as f:
            crimes_data = json.load(f)
        
        print(f"Found {len(crimes_data)} records to migrate...")
        
        # Clear existing data
        await crime_service.collection.delete_many({})
        
        # Migrate
        for crime in crimes_data:
            crime_doc = {
                "id": crime["id"],
                "lat": crime["lat"],
                "lng": crime["lng"],
                "location": {
                    "type": "Point",
                    "coordinates": [crime["lng"], crime["lat"]]
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
        
        print(f"✓ Successfully migrated {len(crimes_data)} records")
        
        await MongoDB.close_database_connection()
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


async def main():
    """Main startup flow"""
    print_header("SAFE ROUTE API - QUICK START")
    
    # Check dependencies
    if not await check_dependencies():
        return
    
    # Test MongoDB connection
    if not await test_mongodb_connection():
        return
    
    # Check if data exists
    has_data = await check_crime_data()
    
    if not has_data:
        print("\n⚠ No crime data found in database")
        response = input("Would you like to run the migration now? (yes/no): ")
        if response.lower() in ['yes', 'y']:
            if not await run_migration():
                return
        else:
            print("\nYou can run migration later with: python migrate_data.py")
            return
    
    print_header("SETUP COMPLETE!")
    print("Everything is ready to go! 🚀\n")
    print("To start the server, run:")
    print("  python main.py")
    print("\nOr:")
    print("  uvicorn main:app --reload")
    print("\nAPI will be available at:")
    print("  - http://localhost:8000")
    print("  - http://localhost:8000/docs (Interactive API documentation)")
    print("\n")


if __name__ == "__main__":
    asyncio.run(main())
