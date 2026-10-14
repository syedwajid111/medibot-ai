"""Vercel FastAPI entrypoint: re-exports the MediBot app from api/index.py."""
from api.index import app  # noqa: F401
