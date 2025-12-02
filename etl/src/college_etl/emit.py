from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from pathlib import Path
from typing import Any

from .transform import SchoolRow

SCHEMA_VERSION = 1


def sig6(x: float) -> float | int:
    """6 significant figures; integral results become ints so the JSON stays small and stable."""
    if x == 0 or not math.isfinite(x):
        return 0
    r = float(f"{x:.6g}")
    return int(r) if r.is_integer() and abs(r) < 1e15 else r


def school_json(s: SchoolRow, metric_keys: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": s.id,
        "name": s.name,
        "city": s.city,
        "state": s.state,
        "control": s.control,
        "locale": s.locale,
        "domain": s.domain,
        "ugSize": s.ug_size,
        "values": {k: (sig6(s.values[k]) if s.values.get(k) is not None else None) for k in metric_keys},
    }
    if s.aliases:
        out["aliases"] = s.aliases
    if s.lat is not None and s.lon is not None:
        out["lat"] = round(s.lat, 4)
        out["lon"] = round(s.lon, 4)
    flags = {k: v for k, v in sorted(s.flags.items()) if k in metric_keys}
    if flags:
        out["flags"] = flags
    return out


def dumps_snapshot(doc: dict[str, Any]) -> str:
    """Sorted keys everywhere, one school per line so diffs between snapshots stay readable."""
    body = {k: v for k, v in doc.items() if k != "schools"}
    head = json.dumps(body, sort_keys=True, ensure_ascii=False, indent=1)
    schools = ",\n".join(
        json.dumps(s, sort_keys=True, ensure_ascii=False, separators=(",", ":")) for s in doc["schools"]
    )
    return head[:-2] + ',\n "schools": [\n' + schools + "\n ]\n}\n"


def content_hash(doc: dict[str, Any]) -> str:
    stable = {k: v for k, v in doc.items() if k not in {"generatedAt", "contentHash"}}
    return hashlib.sha256(json.dumps(stable, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def build_document(
    *,
    snapshot_id: str,
    generated_at: str,
    universe_rule: str,
    schools: list[SchoolRow],
    metric_keys: list[str],
    metrics_meta: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "snapshotId": snapshot_id,
        "generatedAt": generated_at,
        "universe": {"rule": universe_rule, "count": len(schools)},
        "sources": sources,
        "metrics": metrics_meta,
        "schools": [school_json(s, metric_keys) for s in sorted(schools, key=lambda s: s.id)],
    }
    doc["contentHash"] = content_hash(doc)
    return doc


def write_sqlite(path: Path, doc: dict[str, Any]) -> None:
    path.unlink(missing_ok=True)
    con = sqlite3.connect(path)
    with con:
        con.execute(
            "create table schools (id integer primary key, name text, city text, state text, control text,"
            " locale text, domain text, ug_size integer)"
        )
        con.execute(
            "create table metric_values (school_id integer, metric text, value real, flag text,"
            " primary key (school_id, metric))"
        )
        for s in doc["schools"]:
            con.execute(
                "insert into schools values (?,?,?,?,?,?,?,?)",
                (
                    s["id"],
                    s["name"],
                    s["city"],
                    s["state"],
                    s["control"],
                    s["locale"],
                    s["domain"],
                    s["ugSize"],
                ),
            )
            flags = s.get("flags", {})
            con.executemany(
                "insert into metric_values values (?,?,?,?)",
                [(s["id"], k, v, flags.get(k)) for k, v in s["values"].items()],
            )
    con.close()


def coverage_markdown(doc: dict[str, Any], herd_stats: dict[str, int]) -> str:
    lines = [
        f"# Coverage for snapshot {doc['snapshotId']}",
        "",
        f"Universe: {doc['universe']['count']} schools ({doc['universe']['rule']}).",
        "",
        "| Metric | Source | Coverage |",
        "|---|---|---|",
    ]
    for m in doc["metrics"]:
        lines.append(f"| `{m['key']}` | {m['source']} | {m['coverage'] * 100:.1f}% |")
    lines += [
        "",
        "HERD join: " + ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in herd_stats.items()) + ".",
        "",
    ]
    return "\n".join(lines)
