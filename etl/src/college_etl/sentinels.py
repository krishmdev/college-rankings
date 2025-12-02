from __future__ import annotations

import math

# College Scorecard writes "NULL"/"NA" for missing and "PrivacySuppressed" when a cell is too small
# to publish. Urban Institute uses negative codes.
SCORECARD_MISSING = frozenset({"", "NA", "NULL", "NaN"})
SCORECARD_SUPPRESSED = "PrivacySuppressed"
URBAN_MISSING = frozenset({-1, -2, -3})  # missing, not applicable, suppressed


def scorecard_value(raw: str | None) -> tuple[float | None, bool]:
    """Parse a Scorecard cell. Returns (value, suppressed)."""
    if raw is None:
        return None, False
    s = raw.strip()
    if s == SCORECARD_SUPPRESSED:
        return None, True
    if s in SCORECARD_MISSING:
        return None, False
    try:
        v = float(s)
    except ValueError:
        return None, False
    return (v, False) if math.isfinite(v) else (None, False)


def urban_value(raw: float | int | None) -> float | None:
    if raw is None:
        return None
    v = float(raw)
    if not math.isfinite(v) or int(v) in URBAN_MISSING and v == int(v):
        return None
    return v
