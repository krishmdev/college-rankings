from __future__ import annotations

import polars as pl

from .config import UniverseRule


def _num(col: str) -> pl.Expr:
    return pl.col(col).cast(pl.Float64, strict=False)


def apply(df: pl.DataFrame, rule: UniverseRule = UniverseRule()) -> pl.DataFrame:
    cond = (
        (_num("CURROPER") == rule.curroper)
        & (_num("PREDDEG") == rule.preddeg)
        & _num("CONTROL").is_in(list(rule.controls))
        & (_num("ICLEVEL") == rule.iclevel)
        & (_num("UGDS") >= rule.min_ugds)
    )
    if rule.exclude_distance_only:
        cond = cond & ((_num("DISTANCEONLY") != 1) | _num("DISTANCEONLY").is_null())
    return df.filter(cond).sort(_num("UNITID"))
