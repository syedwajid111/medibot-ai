"""Assemble public/*.html from tools/pages/*.html fragments + the shared <head>.
Each fragment starts with <!--title:...|js:name|css:leaflet|noconsent-->. Run: python tools/build_pages.py"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def v(path: str) -> str:
    """Content hash for cache busting, so the service worker never serves an old asset with a new page."""
    return path + "?v=" + hashlib.sha1((ROOT / "public" / path.lstrip("/")).read_bytes()).hexdigest()[:8]


HEAD = (ROOT / "tools" / "head.html").read_text(encoding="utf-8").replace("/assets/css/app.css", v("/assets/css/app.css"))
LEAFLET_CSS = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">'
LEAFLET_JS = '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" defer></script>'

for src in sorted((ROOT / "tools" / "pages").glob("*.html")):
    text = src.read_text(encoding="utf-8")
    meta, body = re.match(r"<!--(.*?)-->\n?(.*)", text, re.S).groups()
    opts = dict(p.split(":", 1) if ":" in p else (p, "1") for p in meta.split("|"))
    title, js = opts.get("title", "MediBot"), opts.get("js", "")
    head = HEAD + (LEAFLET_CSS + "\n" if opts.get("css") == "leaflet" else "")
    scripts = [f'<script src="{v("/assets/js/core.js")}" defer></script>']
    if opts.get("css") == "leaflet":
        scripts.append(LEAFLET_JS)
    if js:
        scripts.append(f'<script src="{v(f"/assets/js/{js}.js")}" defer></script>')
    body_attr = ' data-no-consent="1"' if "noconsent" in opts else ""
    html = (f'<!doctype html>\n<html lang="en" dir="ltr">\n<head>\n<title>{title}</title>\n{head}</head>\n<body{body_attr}>\n'
            f'<div id="site-header"></div>\n<main id="main">\n{body.strip()}\n</main>\n<div id="site-footer"></div>\n' + "\n".join(scripts) + "\n</body>\n</html>\n")
    (ROOT / "public" / src.name).write_text(html, encoding="utf-8")
    print("built", src.name)
