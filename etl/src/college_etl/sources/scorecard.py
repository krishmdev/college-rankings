from __future__ import annotations

import zipfile
from pathlib import Path

import polars as pl

from ..config import SCORECARD_CSV

ID_COLUMNS = ["UNITID", "INSTNM", "ALIAS", "CITY", "STABBR", "INSTURL", "LATITUDE", "LONGITUDE", "LOCALE"]
FILTER_COLUMNS = ["CURROPER", "PREDDEG", "CONTROL", "ICLEVEL", "DISTANCEONLY", "UGDS"]
METRIC_COLUMNS = [
    "GRADS",
    "ADM_RATE",
    "SAT_AVG",
    "C150_4",
    "C150_4_POOLED",
    "C150_4_PELL",
    "RET_FT4",
    "MD_EARN_WNE_P10",
    "NPT4_PUB",
    "NPT4_PRIV",
    "NPT41_PUB",
    "NPT41_PRIV",
    "GRAD_DEBT_MDN",
    "STUFACR",
    "PFTFAC",
    "INEXPFTE",
    "AVGFACSAL",
    "ENDOWEND",
]
COLUMNS = ID_COLUMNS + FILTER_COLUMNS + METRIC_COLUMNS


def extract_csv(zip_path: Path, dest_dir: Path) -> Path:
    """Pull the institution CSV out of the bulk zip, ignoring the __MACOSX resource fork."""
    dest = dest_dir / SCORECARD_CSV
    if dest.exists() and dest.stat().st_mtime >= zip_path.stat().st_mtime:
        return dest
    with zipfile.ZipFile(zip_path) as z:
        member = next(n for n in z.namelist() if n.endswith(SCORECARD_CSV) and not n.startswith("__MACOSX"))
        with z.open(member) as src, dest.open("wb") as out:
            while chunk := src.read(1 << 20):
                out.write(chunk)
    return dest


def read(csv_path: Path) -> pl.DataFrame:
    """Read only the columns we use, as strings, so sentinel handling stays explicit."""
    return pl.read_csv(csv_path, columns=COLUMNS, infer_schema=False, encoding="utf8-lossy")
