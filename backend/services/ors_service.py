"""
OpenRouteService (ORS) wrapper.

ORS is free (2 000 req/day) and has a dedicated `alternative_routes`
parameter that reliably returns geometrically distinct paths.

Sign up at https://openrouteservice.org/dev/#/signup to get a free API key.
Set ORS_API_KEY in your .env file.
"""

import httpx
import polyline as polyline_lib
from typing import List, Dict, Any
from models import RouteResponse, Coordinate
from config import settings


class ORSService:
    """Wrapper around the OpenRouteService Directions API v2."""

    BASE_URL = "https://api.openrouteservice.org/v2/directions/driving-car"

    def __init__(self):
        self.api_key = settings.ORS_API_KEY
        self.timeout = settings.OSRM_TIMEOUT

    async def get_alternative_routes(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int = 3,
    ) -> List[RouteResponse]:
        """
        Fetch alternative routes from OpenRouteService.

        ORS `alternative_routes.target_count` tells the engine exactly how many
        distinct routes to return — with a share_factor of 0.6 so that no two
        routes share more than 60 % of their edges.
        """
        if not self.api_key:
            return []   # Skip silently when no key is configured

        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        body = {
            "coordinates": [
                [source_lng, source_lat],   # ORS uses [lng, lat] order
                [dest_lng, dest_lat],
            ],
            "alternative_routes": {
                "target_count": max(1, min(int(alternatives), 3)),
                "weight_factor": 1.4,   # allow up to 40 % longer than optimal
                "share_factor": 0.6,    # max 60 % shared edges between paths
            },
            "instructions": False,
            "geometry_simplify": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    self.BASE_URL, json=body, headers=headers
                )
                response.raise_for_status()
                data = response.json()
                return self._parse_response(data)
            except Exception:
                # Never let a single service failure crash the whole request
                return []

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_response(self, data: Dict[str, Any]) -> List[RouteResponse]:
        routes: List[RouteResponse] = []
        for idx, route in enumerate(data.get("routes", [])):
            summary = route.get("summary", {})
            distance: float = summary.get("distance", 0.0)   # metres
            duration: float = summary.get("duration", 0.0)   # seconds

            encoded: str = route.get("geometry", "")
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
        if not encoded:
            return []
        decoded = polyline_lib.decode(encoded)
        return [Coordinate(lat=lat, lng=lng) for lat, lng in decoded]

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
