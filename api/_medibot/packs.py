"""Knowledge packs (v3).

Loads the additional knowledge-base files into the retrieval engine at import
time, rebuilds the search index, registers which new topics need a doctor, and
switches off the engine's legacy one-shot rephrasing (generation now lives in
llm.py, after the safety rules have run).
"""
from __future__ import annotations

import json

from . import engine

PACKS = ("kb_conditions_v3.json", "kb_medicines_v3.json")
DOCTOR_TOPICS = {"hepatitis", "tuberculosis", "thyroid", "kidney_stones", "pneumonia"}


def _load() -> None:
    known = {d["id"] for d in engine.DOCS}
    for name in PACKS:
        for d in json.loads((engine.HERE / name).read_text(encoding="utf-8")):
            if d["id"] not in known:
                engine.DOCS.append(d)
                engine.BY_ID[d["id"]] = d
                known.add(d["id"])
    engine.INDEX = engine.BM25([engine._doc_text(d) for d in engine.DOCS])
    engine.KW = [[engine.normalise(k) for k in d["kw"]] for d in engine.DOCS]
    engine.URGENT_TYPES |= DOCTOR_TOPICS
    engine.polish = lambda out, question: out


_load()
