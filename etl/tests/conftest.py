from __future__ import annotations

import polars as pl
import pytest

from college_etl.sources.scorecard import COLUMNS


def scorecard_frame(rows: list[dict]) -> pl.DataFrame:
    """A Scorecard-shaped frame (all strings) with defaults for every column we read."""
    base = {c: "NULL" for c in COLUMNS}
    base.update(
        {
            "CURROPER": "1",
            "PREDDEG": "3",
            "CONTROL": "1",
            "ICLEVEL": "1",
            "DISTANCEONLY": "0",
            "UGDS": "5000",
            "GRADS": "1000",
            "STABBR": "MA",
            "CITY": "Town",
            "LOCALE": "21",
            "INSTURL": "www.example.edu/",
        }
    )
    return pl.DataFrame([{**base, **r} for r in rows], schema={c: pl.String for c in COLUMNS})


@pytest.fixture
def frame():
    return scorecard_frame
