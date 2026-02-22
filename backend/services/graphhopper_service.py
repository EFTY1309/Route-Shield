"""
GraphHopper Service for route fetching and processing.

GraphHopper's `algorithm=alternative_route` is purpose-built to return
genuinely geometrically diverse routes — unlike OSRM's optional `alternatives`
flag which often returns only one path.

Setup:
  1. Get a free API key at https://www.graphhopper.com/  (500 req/day free)
     OR run a self-hosted instance with OSM data for Dhaka.
  2. Set GRAPHHOPPER_API_KEY in your .env file (leave empty for self-hosted).
  3. Set GRAPHHOPPER_BASE_URL in your .env file if self-hosted
     (default: https://graphhopper.com/api/1).
"""

import httpx
import polyline as polyline_lib
from typing import List, Dict, Any, Optional
from models import RouteResponse, Coordinate
from config import settings


class GraphHopperService:
    """
    Service for interacting with the GraphHopper Routing API.
    Provides the same public interface as OSRMService so it can be used
    as a drop-in replacement.
    """

    def __init__(self):
        self.base_url = settings.GRAPHHOPPER_BASE_URL.rstrip("/")
        self.api_key = settings.GRAPHHOPPER_API_KEY
        self.timeout = settings.OSRM_TIMEOUT  # reuse the same timeout setting

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_alternative_routes(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int = 3,
    ) -> List[RouteResponse]:
        """
        Fetch alternative routes from GraphHopper.

        GraphHopper's ``alternative_route`` algorithm guarantees that every
        path returned shares at most ``alternative_route.max_share_factor``
        (default 60 %) of edges with any other returned path, so the routes
        are always meaningfully different.

        Args:
            source_lat: Source latitude
            source_lng: Source longitude
            dest_lat: Destination latitude
            dest_lng: Destination longitude
            alternatives: Maximum number of routes to return (1-3 supported)

        Returns:
            List of RouteResponse objects (up to *alternatives* items)

        Raises:
            ValueError: If coordinates are invalid
            Exception: If the GraphHopper request fails
        """
        self._validate_coordinates(source_lat, source_lng, dest_lat, dest_lng)

        url = f"{self.base_url}/route"
        params = self._build_params(
            source_lat, source_lng, dest_lat, dest_lng, alternatives
        )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if "paths" not in data:
                    message = data.get("message", "Unknown error")
                    raise Exception(f"GraphHopper error: {message}")

                return self._parse_response(data)

            except httpx.TimeoutException:
                raise Exception("GraphHopper request timed out. Please try again.")
            except httpx.HTTPStatusError as e:
                # Surface the GraphHopper error message when available
                try:
                    detail = e.response.json().get("message", str(e))
                except Exception:
                    detail = str(e)
                raise Exception(f"GraphHopper HTTP error: {detail}")
            except httpx.HTTPError as e:
                raise Exception(f"HTTP error occurred: {str(e)}")
            except Exception as e:
                raise Exception(f"Failed to fetch routes from GraphHopper: {str(e)}")

    async def check_availability(self) -> bool:
        """Check if the GraphHopper service is reachable."""
        try:
            url = f"{self.base_url}/route"
            # Minimal valid request to Dhaka centre just to probe the service
            params = self._build_params(23.8103, 90.4125, 23.7104, 90.4074, 1)
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, params=params)
                return response.status_code == 200
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_params(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int,
    ) -> Dict[str, Any]:
        """
        Build the query-parameter dict for GraphHopper.

        GraphHopper expects ``point`` to be repeated, which httpx handles
        correctly when the same key appears multiple times in the list.
        """
        max_paths = max(1, min(int(alternatives), 3))

        params: List[tuple] = [
            ("point", f"{source_lat},{source_lng}"),
            ("point", f"{dest_lat},{dest_lng}"),
            ("profile", "car"),
            ("algorithm", "alternative_route"),
            # How many alternative paths to generate (including the best one)
            ("alternative_route.max_paths", str(max_paths)),
            # A candidate path may be at most 40 % longer than the optimal one
            ("alternative_route.max_weight_factor", "1.4"),
            # At most 60 % of edges may be shared between any two returned paths
            ("alternative_route.max_share_factor", "0.6"),
            ("points_encoded", "true"),   # receive compact polyline strings
            ("instructions", "false"),
            ("calc_points", "true"),
            ("locale", "en"),
        ]

        if self.api_key:
            params.append(("key", self.api_key))

        return params

    def _parse_response(self, data: Dict[str, Any]) -> List[RouteResponse]:
        """Convert a GraphHopper JSON response into a list of RouteResponse objects."""
        routes: List[RouteResponse] = []

        for idx, path in enumerate(data.get("paths", [])):
            distance: float = path.get("distance", 0.0)   # metres
            duration: float = path.get("time", 0.0) / 1000  # ms → seconds

            # Geometry is an encoded polyline string when points_encoded=true
            encoded: str = path.get("points", "")
            coordinates = self._decode_polyline(encoded)

            routes.append(
                RouteResponse(
                    distance=distance,
                    duration=duration,
                    geometry=coordinates,
                    distance_text=self._format_distance(distance),
                    duration_text=self._format_duration(duration),
                    route_index=idx,
                )
            )

        return routes

    def _decode_polyline(self, encoded: str) -> List[Coordinate]:
        """Decode a Google-style encoded polyline into Coordinate objects."""
        if not encoded:
            return []
        decoded = polyline_lib.decode(encoded)
        return [Coordinate(lat=lat, lng=lng) for lat, lng in decoded]

    # ------------------------------------------------------------------
    # Formatting helpers (identical to OSRMService)
    # ------------------------------------------------------------------

    def _format_distance(self, meters: float) -> str:
        if meters < 1000:
            return f"{int(meters)} m"
        return f"{meters / 1000:.1f} km"

    def _format_duration(self, seconds: float) -> str:
        if seconds < 60:
            return f"{int(seconds)} secs"
        if seconds < 3600:
            return f"{int(seconds / 60)} mins"
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m"

    def _validate_coordinates(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
    ) -> None:
        if not (-90 <= source_lat <= 90 and -90 <= dest_lat <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        if not (-180 <= source_lng <= 180 and -180 <= dest_lng <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        if source_lat == dest_lat and source_lng == dest_lng:
            raise ValueError("Source and destination cannot be the same")
