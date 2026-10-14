"""Local development server: API + static site with the same clean URLs as vercel.json.
Run: python -m uvicorn dev:app --port 8090"""
import json
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import app

PUBLIC = Path(__file__).parent / "public"
for r in json.loads((Path(__file__).parent / "vercel.json").read_text())["rewrites"]:
    def page(dest=r["destination"]):
        return FileResponse(PUBLIC / dest.lstrip("/"))
    app.add_api_route(r["source"], page, methods=["GET"], include_in_schema=False)
app.mount("/", StaticFiles(directory=PUBLIC, html=True), name="site")
