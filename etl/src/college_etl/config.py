from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

ETL_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ETL_ROOT.parent
CACHE_DIR = ETL_ROOT / ".cache"
CROSSWALKS = ETL_ROOT / "crosswalks"
SNAPSHOTS_DIR = REPO_ROOT / "data" / "snapshots"
DATASET_PKG = REPO_ROOT / "packages" / "dataset" / "data"

USER_AGENT = "college-rankings-etl/0.1 (+https://github.com/krishmdev/college-rankings)"

SCORECARD_URL = (
    "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip"
)
SCORECARD_CSV = "Most-Recent-Cohorts-Institution.csv"
URBAN_STAFF_URL = (
    "https://educationdata.urban.org/api/v1/college-university/ipeds/salaries-instructional-staff/2024/"
    "?academic_rank=99&sex=99&contract_length=99"
)
HERD_URL = "https://ncses.nsf.gov/821/assets/0/files/higher_education_r_and_d_2024.zip"
HERD_SHORT_URL = "https://ncses.nsf.gov/821/assets/0/files/higher_education_r_and_d_2024_short.zip"
ENGAGE_URL = "https://{sub}.campuslabs.com/engage/api/discovery/search/organizations?top=0"
ENGAGE_HOME = "https://{sub}.campuslabs.com/engage/"


@dataclass(frozen=True)
class UniverseRule:
    """Four-year, degree-granting, currently operating, public or private nonprofit, not online-only."""

    curroper: int = 1
    preddeg: int = 3
    controls: tuple[int, ...] = (1, 2)
    iclevel: int = 1
    exclude_distance_only: bool = True
    min_ugds: int = 300

    def describe(self) -> str:
        return (
            f"CURROPER={self.curroper}, PREDDEG={self.preddeg}, CONTROL in {list(self.controls)}, "
            f"ICLEVEL={self.iclevel}, DISTANCEONLY!=1, UGDS>={self.min_ugds}"
        )


@dataclass(frozen=True)
class ValidationRules:
    min_rows: int = 1300
    max_rows: int = 2500
    coverage_floors: dict[str, float] = field(
        default_factory=lambda: {"net_price": 0.9, "student_faculty_ratio": 0.95, "clubs_count": 0.1}
    )
    herd_gate_usd: float = 10e6
