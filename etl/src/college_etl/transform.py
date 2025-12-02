from __future__ import annotations

import re
from dataclasses import dataclass, field

import polars as pl

from .sentinels import scorecard_value

LOCALE_GROUPS = {1: "city", 2: "suburb", 3: "town", 4: "rural"}

# metric key -> Scorecard column(s). Tuples are tried in order (first non-null wins).
SCORECARD_METRICS: dict[str, tuple[str, ...]] = {
    "grad_rate": ("C150_4", "C150_4_POOLED"),
    "retention_rate": ("RET_FT4",),
    "median_earnings_10y": ("MD_EARN_WNE_P10",),
    "pell_grad_rate": ("C150_4_PELL",),
    "median_debt": ("GRAD_DEBT_MDN",),
    "student_faculty_ratio": ("STUFACR",),
    "ft_faculty_share": ("PFTFAC",),
    "instructional_spend_per_fte": ("INEXPFTE",),
    "faculty_salary": ("AVGFACSAL",),
    "admit_rate": ("ADM_RATE",),
    "sat_avg": ("SAT_AVG",),
    "undergrad_size": ("UGDS",),
}


@dataclass
class SchoolRow:
    id: int
    name: str
    aliases: list[str]
    city: str
    state: str
    control: str
    locale: str | None
    lat: float | None
    lon: float | None
    domain: str | None
    ug_size: int
    grads: int
    endowment: float | None
    values: dict[str, float | None] = field(default_factory=dict)
    flags: dict[str, str] = field(default_factory=dict)


def domain_from_url(url: str | None) -> str | None:
    """INSTURL is free text like 'www.bu.edu/' or 'https://www.tamu.edu/'. Keep just the host, minus www."""
    if not url:
        return None
    s = url.strip().lower()
    s = re.sub(r"^[a-z]+://", "", s)
    s = s.split("/")[0].split("?")[0].split(":")[0]
    s = re.sub(r"^www\d*\.", "", s)
    return s or None


def locale_group(raw: str | None) -> str | None:
    v, _ = scorecard_value(raw)
    if v is None:
        return None
    return LOCALE_GROUPS.get(int(v) // 10)


def split_aliases(raw: str | None) -> list[str]:
    if not raw or raw.strip() in {"NULL", "NA"}:
        return []
    parts = re.split(r"\s*[|;]\s*|,\s+(?=[A-Z])", raw.strip())
    return sorted({p.strip() for p in parts if p.strip()})


def _pick(row: dict, cols: tuple[str, ...]) -> tuple[float | None, bool]:
    suppressed = False
    for c in cols:
        v, sup = scorecard_value(row.get(c))
        if v is not None:
            return v, False
        suppressed = suppressed or sup
    return None, suppressed


def scorecard_rows(df: pl.DataFrame) -> list[SchoolRow]:
    out: list[SchoolRow] = []
    for row in df.iter_rows(named=True):
        control_code = int(float(row["CONTROL"]))
        school = SchoolRow(
            id=int(row["UNITID"]),
            name=row["INSTNM"].strip(),
            aliases=split_aliases(row.get("ALIAS")),
            city=(row.get("CITY") or "").strip(),
            state=row["STABBR"].strip(),
            control="public" if control_code == 1 else "private_nonprofit",
            locale=locale_group(row.get("LOCALE")),
            lat=scorecard_value(row.get("LATITUDE"))[0],
            lon=scorecard_value(row.get("LONGITUDE"))[0],
            domain=domain_from_url(row.get("INSTURL")),
            ug_size=int(float(row["UGDS"])),
            grads=int(scorecard_value(row.get("GRADS"))[0] or 0),
            endowment=scorecard_value(row.get("ENDOWEND"))[0],
        )
        for key, cols in SCORECARD_METRICS.items():
            v, suppressed = _pick(row, cols)
            school.values[key] = v
            if suppressed:
                school.flags[key] = "suppressed"
        # Net price is reported in separate public/private columns.
        suffix = "PUB" if school.control == "public" else "PRIV"
        for key, col in (("net_price", f"NPT4_{suffix}"), ("net_price_low_income", f"NPT41_{suffix}")):
            v, suppressed = scorecard_value(row.get(col))
            school.values[key] = v
            if suppressed:
                school.flags[key] = "suppressed"
        out.append(school)
    return out
