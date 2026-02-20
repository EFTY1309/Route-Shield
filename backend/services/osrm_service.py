"""
OSRM Service for route fetching and processing.
"""
import httpx
import polyline
import math
from typing import List, Dict, Any, Optional
from models import RouteResponse, Coordinate
from config import settings


class OSRMService:
    """Service for interacting with OSRM API"""
    
    def __init__(self):
        """Initialize OSRM service with configuration"""
        self.base_url = settings.OSRM_BASE_URL.rstrip('/')
        self.timeout = settings.OSRM_TIMEOUT
    
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
        coordinates = f"{source_lng},{source_lat};{dest_lng},{dest_lat}"
        url = f"{self.base_url}/route/v1/driving/{coordinates}"
        
        # Parameters for OSRM request
        params = {
            "alternatives": min(alternatives, 3),
            "steps": "false",
            "geometries": "polyline",
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
                
                # Guarantee at least 2 alternative routes
                if len(routes) < 2:
                    extras = await self._get_waypoint_alternatives(
                        source_lat, source_lng, dest_lat, dest_lng,
                        needed=2 - len(routes),
                        start_index=len(routes),
                        client=client
                    )
                    routes.extend(extras)
                
                return routes
                
            except httpx.TimeoutException:
                raise Exception("OSRM request timed out. Please try again.")
            except httpx.HTTPError as e:
                raise Exception(f"HTTP error occurred: {str(e)}")
            except Exception as e:
                raise Exception(f"Failed to fetch routes from OSRM: {str(e)}")
    
    async def check_osrm_availability(self) -> bool:
        """Check if OSRM service is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/")
                return response.status_code == 200
        except:
            return False
    
    async def _get_waypoint_alternatives(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        needed: int,
        start_index: int,
        client: httpx.AsyncClient
    ) -> List[RouteResponse]:
        """
        Generate alternative routes by routing through perpendicular-offset waypoints
        when OSRM doesn't return enough alternatives on its own.
        """
        results: List[RouteResponse] = []

        # Midpoint between source and destination
        mid_lat = (source_lat + dest_lat) / 2
        mid_lng = (source_lng + dest_lng) / 2

        # Direction vector and its length (in degrees)
        dlat = dest_lat - source_lat
        dlng = dest_lng - source_lng
        length = math.sqrt(dlat ** 2 + dlng ** 2)

        if length == 0:
            return results

        # Perpendicular unit vector (rotated 90°)
        perp_lat = -dlng / length
        perp_lng = dlat / length

        # Offset magnitudes to try; alternate sides to get genuinely different paths.
        # ~0.02° ≈ 2 km, ~0.04° ≈ 4 km — enough to force a different road network path.
        offsets = [0.025, -0.025, 0.05, -0.05]

        for offset in offsets:
            if len(results) >= needed:
                break

            wp_lat = mid_lat + perp_lat * offset
            wp_lng = mid_lng + perp_lng * offset

            route = await self._get_route_via_waypoint(
                source_lat, source_lng,
                wp_lat, wp_lng,
                dest_lat, dest_lng,
                route_index=start_index + len(results),
                client=client
            )
            if route is not None:
                results.append(route)

        return results

    async def _get_route_via_waypoint(
        self,
        source_lat: float,
        source_lng: float,
        wp_lat: float,
        wp_lng: float,
        dest_lat: float,
        dest_lng: float,
        route_index: int,
        client: httpx.AsyncClient
    ) -> Optional[RouteResponse]:
        """Request a single route from OSRM that passes through an intermediate waypoint."""
        coord_str = (
            f"{source_lng},{source_lat};"
            f"{wp_lng},{wp_lat};"
            f"{dest_lng},{dest_lat}"
        )
        url = f"{self.base_url}/route/v1/driving/{coord_str}"
        params = {
            "alternatives": "false",
            "steps": "false",
            "geometries": "polyline",
            "overview": "full",
            "annotations": "false",
        }
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("code") != "Ok" or not data.get("routes"):
                return None

            route = data["routes"][0]
            distance = route.get("distance", 0)
            duration = route.get("duration", 0)
            geometry_polyline = route.get("geometry", "")
            coordinates = self._decode_polyline(geometry_polyline)

            return RouteResponse(
                distance=distance,
                duration=duration,
                geometry=coordinates,
                distance_text=self._format_distance(distance),
                duration_text=self._format_duration(duration),
                route_index=route_index,
            )
        except Exception:
            return None

    def _parse_osrm_response(self, data: Dict[str, Any]) -> List[RouteResponse]:
        """Parse OSRM response and convert to RouteResponse objects"""
        routes = []
        osrm_routes = data.get("routes", [])
        
        for idx, route in enumerate(osrm_routes):
            distance = route.get("distance", 0)
            duration = route.get("duration", 0)
            geometry_polyline = route.get("geometry", "")
            coordinates = self._decode_polyline(geometry_polyline)
            
            route_response = RouteResponse(
                distance=distance,
                duration=duration,
                geometry=coordinates,
                distance_text=self._format_distance(distance),
                duration_text=self._format_duration(duration),
                route_index=idx
            )
            routes.append(route_response)
        
        return routes
    
    def _decode_polyline(self, polyline_str: str) -> List[Coordinate]:
        """Decode OSRM polyline format to list of coordinates"""
        if not polyline_str:
            return []
        
        decoded = polyline.decode(polyline_str)
        coordinates = [Coordinate(lat=lat, lng=lng) for lat, lng in decoded]
        return coordinates
    
    def _format_distance(self, meters: float) -> str:
        """Format distance in meters to human-readable string"""
        if meters < 1000:
            return f"{int(meters)} m"
        else:
            km = meters / 1000
            return f"{km:.1f} km"
    
    def _format_duration(self, seconds: float) -> str:
        """Format duration in seconds to human-readable string"""
        if seconds < 60:
            return f"{int(seconds)} secs"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{int(minutes)} mins"
        else:
            hours = seconds / 3600
            minutes = (seconds % 3600) / 60
            return f"{int(hours)}h {int(minutes)}m"
    
    def _validate_coordinates(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float
    ):
        """Validate coordinate ranges"""
        if not (-90 <= source_lat <= 90 and -90 <= dest_lat <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        
        if not (-180 <= source_lng <= 180 and -180 <= dest_lng <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        
        if source_lat == dest_lat and source_lng == dest_lng:
            raise ValueError("Source and destination cannot be the same")
