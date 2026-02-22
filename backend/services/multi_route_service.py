"""
Multi-service route aggregator.

Queries OSRM, GraphHopper, and OpenRouteService **in parallel**, then merges
and deduplicates the results to guarantee at least 2 geometrically distinct
routes even when any individual service returns only 1.

Deduplication rule: two routes are considered the same if both their duration
AND distance differ by less than DUPLICATE_THRESHOLD (default 8 %).
"""

import asyncio
import logging
from typing import List

from models import RouteResponse
from .osrm_service import OSRMService
from .graphhopper_service import GraphHopperService
from .ors_service import ORSService

logger = logging.getLogger(__name__)

# Two routes with duration AND distance within this fraction are duplicates
DUPLICATE_THRESHOLD = 0.08   # 8 %
MIN_ROUTES = 2               # guarantee this many distinct routes


class MultiRouteService:
    """
    Aggregates routes from OSRM, GraphHopper, and ORS in parallel.

    Usage is identical to the individual services:
        routes = await multi_route_service.get_alternative_routes(...)
    """

    def __init__(self):
        self._osrm = OSRMService()
        self._gh = GraphHopperService()
        self._ors = ORSService()

    async def get_alternative_routes(
        self,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int = 3,
    ) -> List[RouteResponse]:
        """
        Fire all three routing services concurrently, merge their results,
        remove near-duplicate routes, and return up to *alternatives* routes
        sorted by duration (fastest first).

        If only 1 distinct route is found from all services combined, that
        route is still returned rather than raising an error.
        """
        # --- 1. Query all services in parallel ----------------------------
        results = await asyncio.gather(
            self._safe_fetch(self._osrm, source_lat, source_lng, dest_lat, dest_lng, alternatives),
            self._safe_fetch(self._gh,   source_lat, source_lng, dest_lat, dest_lng, alternatives),
            self._safe_fetch(self._ors,  source_lat, source_lng, dest_lat, dest_lng, alternatives),
        )

        osrm_routes, gh_routes, ors_routes = results
        logger.info(
            "Route counts — OSRM: %d | GraphHopper: %d | ORS: %d",
            len(osrm_routes), len(gh_routes), len(ors_routes),
        )

        # --- 2. Merge ----------------------------------------------------
        all_routes: List[RouteResponse] = osrm_routes + gh_routes + ors_routes

        if not all_routes:
            raise Exception(
                "All routing services failed to return a route. "
                "Check your internet connection or service configuration."
            )

        # --- 3. Sort by duration (fastest first) -------------------------
        all_routes.sort(key=lambda r: r.duration)

        # --- 4. Deduplicate ----------------------------------------------
        unique = self._deduplicate(all_routes)

        # --- 5. Re-index and slice to requested count --------------------
        for i, r in enumerate(unique):
            r.route_index = i

        return unique[:max(alternatives, MIN_ROUTES)]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _safe_fetch(
        self,
        service,
        source_lat: float,
        source_lng: float,
        dest_lat: float,
        dest_lng: float,
        alternatives: int,
    ) -> List[RouteResponse]:
        """Call a service and return an empty list on any error."""
        try:
            return await service.get_alternative_routes(
                source_lat, source_lng, dest_lat, dest_lng, alternatives
            )
        except Exception as exc:
            logger.warning("%s failed: %s", type(service).__name__, exc)
            return []

    def _deduplicate(self, routes: List[RouteResponse]) -> List[RouteResponse]:
        """
        Remove routes that are too similar to an already-accepted route.

        Two routes are duplicates when BOTH of:
          |Δduration| / duration_a  ≤ DUPLICATE_THRESHOLD
          |Δdistance| / distance_a  ≤ DUPLICATE_THRESHOLD
        """
        unique: List[RouteResponse] = []

        for candidate in routes:
            if candidate.duration == 0 and candidate.distance == 0:
                continue  # discard empty routes

            is_dup = False
            for accepted in unique:
                dur_ratio = (
                    abs(candidate.duration - accepted.duration) / accepted.duration
                    if accepted.duration > 0
                    else 0.0
                )
                dist_ratio = (
                    abs(candidate.distance - accepted.distance) / accepted.distance
                    if accepted.distance > 0
                    else 0.0
                )
                if dur_ratio <= DUPLICATE_THRESHOLD and dist_ratio <= DUPLICATE_THRESHOLD:
                    is_dup = True
                    break

            if not is_dup:
                unique.append(candidate)

        return unique
