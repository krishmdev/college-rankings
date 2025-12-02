from __future__ import annotations

from dataclasses import dataclass, field

from .config import ValidationRules
from .sources.herd import HerdJoin
from .transform import SchoolRow

RANGES: dict[str, tuple[float, float]] = {
    "grad_rate": (0, 1),
    "retention_rate": (0, 1),
    "pell_grad_rate": (0, 1),
    "ft_faculty_share": (0, 1),
    "admit_rate": (0, 1),
    "sat_avg": (400, 1600),
    "student_faculty_ratio": (1, 200),
    "net_price": (-20000, 150000),
    "net_price_low_income": (-20000, 150000),
    "median_debt": (0, 200000),
    "median_earnings_10y": (0, 500000),
    "faculty_count": (0, 50000),
    "research_total": (0, 1e10),
    "clubs_count": (0, 10000),
}

# (unitid, metric, expected, tolerance): values checked by hand against the source pages.
SPOT_CHECKS: list[tuple[int, str, float, float]] = [
    (164988, "student_faculty_ratio", 10, 0),  # Boston University
    (164988, "faculty_count", 1994, 0),
    (164988, "research_total", 784.4e6, 0.1e6),
    (162928, "research_total", 4129.3e6, 0.1e6),  # Johns Hopkins, only reachable via the crosswalk
    (204796, "research_total", 1581.6e6, 0.1e6),  # Ohio State, same
]
CLUB_SPOT_CHECKS: list[tuple[int, str, float]] = [(170976, "clubs_count", 1000)]  # UMich > 1,000


@dataclass
class Report:
    failures: list[str] = field(default_factory=list)
    coverage: dict[str, float] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.failures


def coverage(schools: list[SchoolRow], keys: list[str]) -> dict[str, float]:
    n = len(schools) or 1
    return {k: round(sum(1 for s in schools if s.values.get(k) is not None) / n, 4) for k in keys}


def validate(
    schools: list[SchoolRow],
    herd: HerdJoin,
    metric_keys: list[str],
    rules: ValidationRules = ValidationRules(),
    *,
    clubs_enabled: bool,
) -> Report:
    rep = Report()
    n = len(schools)
    if not rules.min_rows <= n <= rules.max_rows:
        rep.failures.append(f"row count {n} outside [{rules.min_rows}, {rules.max_rows}]")
    ids = [s.id for s in schools]
    if len(set(ids)) != len(ids):
        rep.failures.append("duplicate unitids")

    rep.coverage = coverage(schools, metric_keys)
    for key, floor in rules.coverage_floors.items():
        if key == "clubs_count" and not clubs_enabled:
            continue
        if rep.coverage.get(key, 0) < floor:
            rep.failures.append(f"coverage of {key} is {rep.coverage.get(key, 0):.3f}, below {floor}")

    for s in schools:
        for key, (lo, hi) in RANGES.items():
            v = s.values.get(key)
            if v is not None and not lo <= v <= hi:
                rep.failures.append(f"{s.id} {s.name}: {key}={v} outside [{lo}, {hi}]")

    for r in herd.unresolved:
        rep.failures.append(
            f"HERD row {r.inst_id} '{r.name}' (${r.usd / 1e6:.1f}M) maps to no universe school; "
            "add it to herd_unitid_overrides.csv or herd_exclusions.csv"
        )

    by_id = {s.id: s for s in schools}
    for unitid, key, expected, tol in SPOT_CHECKS:
        s = by_id.get(unitid)
        v = s.values.get(key) if s else None
        if v is None or abs(v - expected) > tol:
            rep.failures.append(f"spot check {unitid} {key}: expected {expected}, got {v}")
    if clubs_enabled:
        for unitid, key, minimum in CLUB_SPOT_CHECKS:
            s = by_id.get(unitid)
            v = s.values.get(key) if s else None
            if v is None or v <= minimum:
                rep.failures.append(f"spot check {unitid} {key}: expected > {minimum}, got {v}")
    return rep
