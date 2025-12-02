from __future__ import annotations

import json
from pathlib import Path

from ..http import client
from ..sentinels import urban_value


def fetch_all(url: str, dest: Path) -> dict:
    """Follow the API's `next` links and store every result in one JSON file."""
    results: list[dict] = []
    with client(timeout=120) as c:
        next_url: str | None = url
        while next_url:
            r = c.get(next_url)
            r.raise_for_status()
            page = r.json()
            results.extend(page["results"])
            next_url = page.get("next")
    payload = {"count": len(results), "results": results}
    dest.write_text(json.dumps(payload))
    return payload


def faculty_counts(path: Path) -> dict[int, float]:
    """Full-time instructional staff by unitid (all ranks, both sexes, all contract lengths)."""
    data = json.loads(path.read_text())
    out: dict[int, float] = {}
    for row in data["results"]:
        if (row.get("academic_rank"), row.get("sex"), row.get("contract_length")) != (99, 99, 99):
            continue
        v = urban_value(row.get("instruc_staff_count"))
        if v is not None:
            out[int(row["unitid"])] = v
    return out
