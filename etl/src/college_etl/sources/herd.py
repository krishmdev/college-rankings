"""NSF Higher Education R&D survey (HERD), FY2024.

The files are long-format: one row per institution x question x row x column. Total R&D is
questionnaire_no '01.g', row 'Total', in thousands of dollars. The join key is ipeds_unitid, which
is blank for 32 standard-form institutions, including Johns Hopkins (the largest R&D spender) and
Ohio State. A naive join would silently give them $0, so they're resolved through a hand-reviewed
crosswalk, and a validation gate refuses to build if any large HERD row is left unaccounted for.
"""

from __future__ import annotations

import csv
import zipfile
from dataclasses import dataclass
from pathlib import Path

import polars as pl

TOTAL_QUESTION = "01.g"


@dataclass(frozen=True)
class HerdRow:
    inst_id: str
    unitid: int | None
    name: str
    state: str
    usd: float
    form: str  # 'standard' or 'short'


@dataclass(frozen=True)
class Override:
    inst_id: str
    unitid: int
    name: str
    system_level: bool
    note: str


@dataclass(frozen=True)
class Exclusion:
    inst_id: str
    name: str
    reason: str


def read_zip(zip_path: Path, form: str) -> list[HerdRow]:
    with zipfile.ZipFile(zip_path) as z:
        member = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        with z.open(member) as fh:
            df = pl.read_csv(fh.read(), infer_schema=False, encoding="utf8-lossy")
    return read_frame(df, form)


def read_frame(df: pl.DataFrame, form: str) -> list[HerdRow]:
    totals = df.filter((pl.col("questionnaire_no") == TOTAL_QUESTION) & (pl.col("row") == "Total"))
    out: list[HerdRow] = []
    for r in totals.iter_rows(named=True):
        unitid = r.get("ipeds_unitid")
        out.append(
            HerdRow(
                inst_id=r["inst_id"],
                unitid=int(unitid) if unitid not in (None, "") else None,
                name=r["inst_name_long"],
                state=r["inst_state_code"],
                usd=float(r["data"]) * 1000.0,
                form=form,
            )
        )
    return out


def load_overrides(path: Path) -> dict[str, Override]:
    with path.open(newline="") as fh:
        return {
            r["herd_inst_id"]: Override(
                inst_id=r["herd_inst_id"],
                unitid=int(r["ipeds_unitid"]),
                name=r["herd_name"],
                system_level=r["system_level"].strip().lower() == "true",
                note=r.get("note", ""),
            )
            for r in csv.DictReader(fh)
        }


def load_exclusions(path: Path) -> dict[str, Exclusion]:
    with path.open(newline="") as fh:
        return {
            r["herd_inst_id"]: Exclusion(inst_id=r["herd_inst_id"], name=r["herd_name"], reason=r["reason"])
            for r in csv.DictReader(fh)
        }


@dataclass
class HerdJoin:
    usd: dict[int, float]
    system_level: set[int]
    unresolved: list[HerdRow]
    """HERD rows at or above the gate that map to no universe school and aren't explicitly excluded."""
    matched_rows: int
    excluded_rows: int


def join(
    rows: list[HerdRow],
    universe_ids: set[int],
    overrides: dict[str, Override],
    exclusions: dict[str, Exclusion],
    gate_usd: float,
) -> HerdJoin:
    usd: dict[int, float] = {}
    system_level: set[int] = set()
    unresolved: list[HerdRow] = []
    matched = excluded = 0
    for r in rows:
        if r.inst_id in exclusions:
            excluded += 1
            continue
        ov = overrides.get(r.inst_id)
        unitid = ov.unitid if ov else r.unitid
        if unitid is None or unitid not in universe_ids:
            if r.usd >= gate_usd:
                unresolved.append(r)
            continue
        # Several HERD units can roll up into one IPEDS campus (CU Denver + Anschutz), so sum.
        usd[unitid] = usd.get(unitid, 0.0) + r.usd
        if ov and ov.system_level:
            system_level.add(unitid)
        matched += 1
    unresolved.sort(key=lambda r: -r.usd)
    return HerdJoin(
        usd=usd,
        system_level=system_level,
        unresolved=unresolved,
        matched_rows=matched,
        excluded_rows=excluded,
    )
