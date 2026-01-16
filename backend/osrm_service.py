import httpx
import polyline
from typing import List, Dict, Any, Optional
from models import RouteResponse, Coordinate


class OSRMService:
    """Service for interacting with OSRM API"""
    
    def __init__(self, base_url: str = "http://router.project-osrm.org"):
        """
        Initialize OSRM service.
        
        Args:
            base_url: Base URL for OSRM server (default is public OSRM server)
                     For local OSRM: "http://localhost:5000"
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = 30.0
    
    async def get_alternative_routes(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int = 3
    ) -> List[RouteResponse]:
        """
        Fetch alternative routes from OSRM.
        
        Args:
            source_lat: Source latitude
            source_lng: Source longitude
            dest_lat: Destination latitude
            dest_lng: Destination longitude
            alternatives: Number of alternative routes to request (default: 3)
            
        Returns:
            List of RouteResponse objects
            
        Raises:
            ValueError: If coordinates are invalid
            Exception: If OSRM request fails
        """
        # Validate coordinates
        self._validate_coordinates(source_lat, source_lng, dest_lat, dest_lng)
        
        # Build OSRM API URL
        # Format: /route/v1/{profile}/{coordinates}?alternatives={true|false|number}
        coordinates = f"{source_lng},{source_lat};{dest_lng},{dest_lat}"
        url = f"{self.base_url}/route/v1/driving/{coordinates}"
        
        # Parameters for OSRM request
        params = {
            "alternatives": min(alternatives, 3),  # OSRM typically supports up to 3 alternatives
            "steps": "false",
            "geometries": "polyline",  # Use polyline encoding for efficient geometry
            "overview": "full",
            "annotations": "false"
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != "Ok":
                    raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
                
                routes = self._parse_osrm_response(data)
                return routes
                
            except httpx.TimeoutException:
                raise Exception("OSRM request timed out. Please try again.")
            except httpx.HTTPError as e:
                raise Exception(f"HTTP error occurred: {str(e)}")
            except Exception as e:
                raise Exception(f"Failed to fetch routes from OSRM: {str(e)}")
    
    def _parse_osrm_response(self, data: Dict[str, Any]) -> List[RouteResponse]:
        """
        Parse OSRM response and convert to RouteResponse objects.
        
        Args:
            data: Raw OSRM response data
            
        Returns:
            List of RouteResponse objects
        """
        routes = []
        osrm_routes = data.get("routes", [])
        
        for idx, route in enumerate(osrm_routes):
            # Extract distance (meters) and duration (seconds)
            distance = route.get("distance", 0)
            duration = route.get("duration", 0)
            
            # Decode polyline geometry to coordinates
            geometry_polyline = route.get("geometry", "")
            coordinates = self._decode_polyline(geometry_polyline)
            
            # Create human-readable text
            distance_text = self._format_distance(distance)
            duration_text = self._format_duration(duration)
            
            route_response = RouteResponse(
                distance=distance,
                duration=duration,
                geometry=coordinates,
                distance_text=distance_text,
                duration_text=duration_text,
                route_index=idx
            )
            routes.append(route_response)
        
        return routes
    
    def _decode_polyline(self, polyline_str: str) -> List[Coordinate]:
        """
        Decode OSRM polyline format to list of coordinates.
        
        Args:
            polyline_str: Encoded polyline string
            
        Returns:
            List of Coordinate objects
        """
        if not polyline_str:
            return []
        
        # Decode polyline (returns list of (lat, lng) tuples)
        decoded = polyline.decode(polyline_str)
        
        # Convert to Coordinate objects
        coordinates = [
            Coordinate(lat=lat, lng=lng)
            for lat, lng in decoded
        ]
        
        return coordinates
    
    def _format_distance(self, meters: float) -> str:
        """
        Format distance in meters to human-readable string.
        
        Args:
            meters: Distance in meters
            
        Returns:
            Formatted string (e.g., "5.2 km" or "850 m")
        """
        if meters >= 1000:
            km = meters / 1000
            return f"{km:.1f} km"
        else:
            return f"{int(meters)} m"
    
    def _format_duration(self, seconds: float) -> str:
        """
        Format duration in seconds to human-readable string.
        
        Args:
            seconds: Duration in seconds
            
        Returns:
            Formatted string (e.g., "1 hr 25 mins" or "15 mins")
        """
        if seconds >= 3600:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            if minutes > 0:
                return f"{hours} hr {minutes} mins"
            return f"{hours} hr"
        elif seconds >= 60:
            minutes = int(seconds // 60)
            return f"{minutes} mins"
        else:
            return f"{int(seconds)} secs"
    
    def _validate_coordinates(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float
    ) -> None:
        """
        Validate that coordinates are within valid ranges.
        
        Args:
            source_lat: Source latitude
            source_lng: Source longitude
            dest_lat: Destination latitude
            dest_lng: Destination longitude
            
        Raises:
            ValueError: If any coordinate is out of valid range
        """
        if not -90 <= source_lat <= 90 or not -90 <= dest_lat <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        
        if not -180 <= source_lng <= 180 or not -180 <= dest_lng <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        
        # Check if source and destination are not the same
        if (abs(source_lat - dest_lat) < 0.0001 and 
            abs(source_lng - dest_lng) < 0.0001):
            raise ValueError("Source and destination cannot be the same location")
    
    async def check_osrm_availability(self) -> bool:
        """
        Check if OSRM service is available.
        
        Returns:
            True if OSRM is available, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Make a simple request to check availability
                coords = "90.4142,23.7808;90.4200,23.7850"  # Sample Dhaka coordinates
                url = f"{self.base_url}/route/v1/driving/{coords}"
                response = await client.get(url, params={"overview": "false"})
                return response.status_code == 200
        except:
            return False
