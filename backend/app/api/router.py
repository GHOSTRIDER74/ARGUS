"""Aggregated API router (versioned under /api/v1)."""
from fastapi import APIRouter

from app.api.routes import datasets, digital_twin, drift, health, impact, simulation

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(datasets.router)
api_router.include_router(simulation.router)
api_router.include_router(drift.router)
api_router.include_router(digital_twin.router)
api_router.include_router(impact.router)
