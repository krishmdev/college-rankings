from __future__ import annotations

import json
import shutil
import time

import typer
from rich.console import Console

from . import universe as universe_mod
from .config import (
    CACHE_DIR,
    CROSSWALKS,
    DATASET_PKG,
    HERD_SHORT_URL,
    HERD_URL,
    SCORECARD_URL,
    SNAPSHOTS_DIR,
    URBAN_STAFF_URL,
    UniverseRule,
    ValidationRules,
)
from .derive import derive
from .emit import build_document, coverage_markdown, dumps_snapshot, write_sqlite
from .http import adopt, fetch
from .provenance import DERIVED, ENGAGE, HERD, MANUAL, METRIC_SOURCES, SCORECARD, SOURCE_INFO, URBAN
from .schema import Snapshot
from .sources import engage, herd, scorecard, urban
from .transform import SchoolRow, scorecard_rows
from .validate import validate

app = typer.Typer(no_args_is_help=True, add_completion=False)
console = Console()

METRIC_KEYS = list(METRIC_SOURCES)
ENGAGE_CSV = CROSSWALKS / "engage_subdomains.csv"
CLUBS_MANUAL = CROSSWALKS / "clubs_manual.csv"


def _fetch_all(refresh: bool) -> dict[str, dict]:
    metas = {
        "scorecard": fetch(SCORECARD_URL, "scorecard.zip", refresh=refresh),
        "herd": fetch(HERD_URL, "herd_2024.zip", refresh=refresh),
        "herd_short": fetch(HERD_SHORT_URL, "herd_2024_short.zip", refresh=refresh),
    }
    staff = CACHE_DIR / "urban_staff_2024.json"
    meta_path = CACHE_DIR / "urban_staff_2024.json.meta.json"
    if refresh or not staff.exists():
        urban.fetch_all(URBAN_STAFF_URL, staff)
        adopt(staff, URBAN_STAFF_URL)
    elif not meta_path.exists():
        adopt(staff, URBAN_STAFF_URL)
    metas["urban"] = json.loads(meta_path.read_text())
    return metas


@app.command("fetch")
def fetch_cmd(refresh: bool = typer.Option(False, help="Re-download even if cached.")) -> None:
    """Download raw source files into etl/.cache with sha256 sidecars."""
    for name, meta in _fetch_all(refresh).items():
        console.print(f"{name}: {meta['file']} {meta['bytes']:,} bytes sha256={meta['sha256'][:12]}")


def _load_universe(rule: UniverseRule) -> list[SchoolRow]:
    csv_path = scorecard.extract_csv(CACHE_DIR / "scorecard.zip", CACHE_DIR)
    return scorecard_rows(universe_mod.apply(scorecard.read(csv_path), rule))


@app.command("engage-discover")
def engage_discover(
    limit: int = typer.Option(None, help="Stop after this many new probes."),
    retry_errors: bool = typer.Option(False, help="Probe again where the last attempt errored."),
    per_second: float = typer.Option(2.0, max=2.0, help="Request rate cap."),
) -> None:
    """Probe <sub>.campuslabs.com for each school (resumable; writes crosswalks/engage_subdomains.csv)."""
    schools = _load_universe(UniverseRule())
    cands = engage.candidates((s.id, s.domain) for s in schools)
    console.print(f"{len(cands)} candidate subdomains for {len(schools)} schools")

    def progress(sub: str, row: dict) -> None:
        console.print(f"{sub:>20} {row['status']:<10} {row['count']:>6} {row['site_title'][:50]}")

    rows = engage.discover(
        ENGAGE_CSV, cands, per_second=per_second, retry_errors=retry_errors, limit=limit, on_progress=progress
    )
    found = sum(1 for r in rows.values() if r["status"] == "found")
    console.print(f"checked {len(rows)}, found {found}")


def _source_entry(source_id: str, meta: dict | None, extra: dict | None = None) -> dict:
    entry = {"id": source_id, **SOURCE_INFO[source_id]}
    if meta:
        entry.update(
            {
                "url": meta["url"],
                "file": meta["file"],
                "sha256": meta["sha256"],
                "retrieved": meta["retrieved"],
            }
        )
    if extra:
        entry.update(extra)
    return entry


@app.command("build")
def build(
    snapshot_id: str = typer.Option(time.strftime("%Y-%m-%d"), help="Snapshot id (usually the build date)."),
    clubs: bool = typer.Option(True, help="Merge club counts from the Engage crawl and manual CSV."),
    publish: bool = typer.Option(True, help="Copy the snapshot into packages/dataset."),
    sqlite: bool = typer.Option(True, help="Also write snapshot.sqlite (not committed)."),
    refresh: bool = typer.Option(False, help="Re-download sources."),
) -> None:
    """Fetch, join, derive, validate and emit a snapshot."""
    metas = _fetch_all(refresh)
    rule = UniverseRule()
    schools = _load_universe(rule)
    ids = {s.id for s in schools}
    console.print(f"universe: {len(schools)} schools")

    faculty = urban.faculty_counts(CACHE_DIR / "urban_staff_2024.json")
    for s in schools:
        s.values["faculty_count"] = faculty.get(s.id)

    herd_rows = herd.read_zip(CACHE_DIR / "herd_2024.zip", "standard") + herd.read_zip(
        CACHE_DIR / "herd_2024_short.zip", "short"
    )
    rules = ValidationRules()
    joined = herd.join(
        herd_rows,
        ids,
        herd.load_overrides(CROSSWALKS / "herd_unitid_overrides.csv"),
        herd.load_exclusions(CROSSWALKS / "herd_exclusions.csv"),
        rules.herd_gate_usd,
    )
    members = herd.load_members(CROSSWALKS / "herd_members.csv")
    reviewed_absent = herd.load_reviewed_absent(CROSSWALKS / "herd_reviewed_absent.csv")
    by_id = {s.id: s for s in schools}
    for s in schools:
        if s.id in joined.usd:
            s.values["research_total"] = joined.usd[s.id]
            if s.id in joined.system_level:
                s.flags["research_total"] = "system_level"
        elif s.id in members:
            # Covered by the parent's HERD row: unknown on its own, not $0.
            m = members[s.id]
            s.values["research_total"] = None
            s.flags["research_total"] = "reported_with_parent"
            s.reported_with["research_total"] = m.parent
            if m.parent in by_id:
                by_id[m.parent].member_enrollment += s.ug_size + s.grads
        else:
            # HERD surveys institutions with at least $150K of R&D, so absence means little or none.
            s.values["research_total"] = 0.0
            s.flags["research_total"] = "imputed_zero"

    club_meta: dict | None = None
    if clubs:
        counts = engage.club_counts(ENGAGE_CSV, CLUBS_MANUAL)
        for s in schools:
            c = counts.get(s.id)
            s.values["clubs_count"] = float(c.count) if c else None
            if c and c.source == "manual":
                s.flags["clubs_count"] = "manual"
        crawl = engage.load(ENGAGE_CSV)
        dates = sorted({r["checked_at"] for r in crawl.values() if r.get("checked_at")})
        club_meta = {
            "checked_subdomains": len(crawl),
            "found": sum(1 for r in crawl.values() if r["status"] == "found"),
            "crawl_dates": f"{dates[0]}..{dates[-1]}" if dates else "",
        }
    else:
        for s in schools:
            s.values["clubs_count"] = None

    for s in schools:
        derive(s)

    report = validate(
        schools,
        joined,
        METRIC_KEYS,
        rules,
        clubs_enabled=clubs,
        members=members,
        reviewed_absent=reviewed_absent,
    )
    herd_stats = {
        "rows": len(herd_rows),
        "matched_rows": joined.matched_rows,
        "excluded_rows": joined.excluded_rows,
        "schools_with_R&D": len(joined.usd),
        "system_level": len(joined.system_level),
        "imputed_zero": sum(1 for s in schools if s.flags.get("research_total") == "imputed_zero"),
        "reported_with_parent": sum(
            1 for s in schools if s.flags.get("research_total") == "reported_with_parent"
        ),
    }
    console.print(f"herd: {herd_stats}")
    if not report.ok:
        for f in report.failures[:50]:
            console.print(f"[red]FAIL[/red] {f}")
        raise typer.Exit(1)

    metrics_meta = []
    for key in METRIC_KEYS:
        ms = METRIC_SOURCES[key]
        if key.startswith("clubs") and not clubs:
            continue
        metrics_meta.append(
            {
                "key": key,
                "source": ms.source,
                "fields": ms.fields,
                "vintage": ms.vintage,
                "note": ms.note,
                "coverage": report.coverage[key],
            }
        )
    metric_keys = [m["key"] for m in metrics_meta]
    sources = [
        _source_entry(SCORECARD, metas["scorecard"]),
        _source_entry(URBAN, metas["urban"]),
        _source_entry(HERD, metas["herd"], {"shortFormSha256": metas["herd_short"]["sha256"]}),
    ]
    if clubs:
        sources.append(_source_entry(ENGAGE, None, club_meta))
        sources.append(_source_entry(MANUAL, None))
    sources.append(
        {
            "id": DERIVED,
            "name": "Computed in etl/src/college_etl/derive.py",
            "publisher": "",
            "license": "MIT",
            "homepage": "",
        }
    )

    doc = build_document(
        snapshot_id=snapshot_id,
        generated_at=time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        universe_rule=rule.describe(),
        schools=schools,
        metric_keys=metric_keys,
        metrics_meta=metrics_meta,
        sources=sources,
    )
    Snapshot.model_validate(doc)
    out_dir = SNAPSHOTS_DIR / snapshot_id
    out_dir.mkdir(parents=True, exist_ok=True)
    text = dumps_snapshot(doc)
    (out_dir / "snapshot.json").write_text(text)
    manifest = {
        "snapshotId": snapshot_id,
        "contentHash": doc["contentHash"],
        "generatedAt": doc["generatedAt"],
        "universe": doc["universe"],
        "sources": sources,
        "coverage": {m["key"]: m["coverage"] for m in metrics_meta},
        "herd": herd_stats,
        "clubs": club_meta,
        "validation": "passed",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    (out_dir / "coverage.md").write_text(coverage_markdown(doc, herd_stats))
    if sqlite:
        write_sqlite(out_dir / "snapshot.sqlite", doc)
    console.print(f"wrote {out_dir} ({len(text):,} bytes, hash {doc['contentHash'][:12]})")

    if publish:
        DATASET_PKG.mkdir(parents=True, exist_ok=True)
        shutil.move(out_dir / "snapshot.json", DATASET_PKG / "snapshot.json")
        shutil.copy(out_dir / "manifest.json", DATASET_PKG / "manifest.json")
        console.print(f"published to {DATASET_PKG}")


@app.command("check-herd")
def check_herd() -> None:
    """List HERD rows at or above the gate that the crosswalk doesn't account for."""
    schools = _load_universe(UniverseRule())
    rows = herd.read_zip(CACHE_DIR / "herd_2024.zip", "standard") + herd.read_zip(
        CACHE_DIR / "herd_2024_short.zip", "short"
    )
    joined = herd.join(
        rows,
        {s.id for s in schools},
        herd.load_overrides(CROSSWALKS / "herd_unitid_overrides.csv"),
        herd.load_exclusions(CROSSWALKS / "herd_exclusions.csv"),
        ValidationRules().herd_gate_usd,
    )
    for r in joined.unresolved:
        console.print(f"{r.inst_id} {r.name} ({r.state}) ${r.usd / 1e6:.1f}M unitid={r.unitid}")
    console.print(f"{len(joined.unresolved)} unresolved")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
