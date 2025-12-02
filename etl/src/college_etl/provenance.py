from __future__ import annotations

from dataclasses import dataclass

SCORECARD = "scorecard"
URBAN = "urban_ipeds"
HERD = "nsf_herd"
ENGAGE = "campuslabs_engage"
MANUAL = "manual_clubs"
DERIVED = "derived"


@dataclass(frozen=True)
class MetricSource:
    source: str
    fields: str
    vintage: str
    note: str = ""


SC_RELEASE = "most recent cohorts, June 2026 release"

METRIC_SOURCES: dict[str, MetricSource] = {
    "grad_rate": MetricSource(SCORECARD, "C150_4 (fallback C150_4_POOLED)", SC_RELEASE),
    "retention_rate": MetricSource(SCORECARD, "RET_FT4", SC_RELEASE),
    "median_earnings_10y": MetricSource(SCORECARD, "MD_EARN_WNE_P10", SC_RELEASE),
    "pell_grad_rate": MetricSource(SCORECARD, "C150_4_PELL", SC_RELEASE),
    "net_price": MetricSource(SCORECARD, "NPT4_PUB / NPT4_PRIV", SC_RELEASE),
    "net_price_low_income": MetricSource(SCORECARD, "NPT41_PUB / NPT41_PRIV", SC_RELEASE),
    "median_debt": MetricSource(SCORECARD, "GRAD_DEBT_MDN", SC_RELEASE),
    "earnings_to_price": MetricSource(DERIVED, "median_earnings_10y / (4 x net_price)", SC_RELEASE),
    "faculty_count": MetricSource(URBAN, "instruc_staff_count (all ranks)", "2024"),
    "student_faculty_ratio": MetricSource(SCORECARD, "STUFACR", SC_RELEASE),
    "ft_faculty_share": MetricSource(SCORECARD, "PFTFAC", SC_RELEASE),
    "instructional_spend_per_fte": MetricSource(SCORECARD, "INEXPFTE", SC_RELEASE),
    "faculty_salary": MetricSource(SCORECARD, "AVGFACSAL (monthly)", SC_RELEASE),
    "research_total": MetricSource(
        HERD,
        "questionnaire 01.g total R&D",
        "FY2024",
        "Institutions missing from HERD are treated as $0 and flagged.",
    ),
    "research_per_student": MetricSource(DERIVED, "research_total / (UGDS + GRADS)", "FY2024"),
    "clubs_count": MetricSource(
        ENGAGE,
        "@odata.count of listed organizations",
        "crawl date",
        "Partial coverage: only schools whose directory is on Engage at the guessed subdomain, "
        "plus manual entries.",
    ),
    "clubs_per_1k_ug": MetricSource(DERIVED, "clubs_count / UGDS x 1000", ""),
    "admit_rate": MetricSource(SCORECARD, "ADM_RATE", SC_RELEASE),
    "sat_avg": MetricSource(SCORECARD, "SAT_AVG", SC_RELEASE),
    "undergrad_size": MetricSource(SCORECARD, "UGDS", SC_RELEASE),
    "endowment_per_student": MetricSource(DERIVED, "ENDOWEND / (UGDS + GRADS)", SC_RELEASE),
}

SOURCE_INFO: dict[str, dict[str, str]] = {
    SCORECARD: {
        "name": "College Scorecard, Most Recent Institution-Level Data",
        "publisher": "U.S. Department of Education",
        "license": "Public domain (U.S. government work)",
        "homepage": "https://collegescorecard.ed.gov/data/",
    },
    URBAN: {
        "name": "IPEDS salaries of instructional staff, via the Education Data Portal",
        "publisher": "Urban Institute (data from NCES IPEDS)",
        "license": "Free to use with attribution: Urban Institute Education Data Portal, "
        "educationdata.urban.org",
        "homepage": "https://educationdata.urban.org/",
    },
    HERD: {
        "name": "Higher Education Research and Development Survey, FY2024",
        "publisher": "National Center for Science and Engineering Statistics (NSF)",
        "license": "Public domain (U.S. government work)",
        "homepage": "https://ncses.nsf.gov/surveys/higher-education-research-development/2024",
    },
    ENGAGE: {
        "name": "Campus Labs Engage public organization directories",
        "publisher": "Anthology / each school",
        "license": "Counts only (no organization content is stored); crawled at <= 2 requests/second",
        "homepage": "https://www.campuslabs.com/campus-engagement/",
    },
    MANUAL: {
        "name": "Hand-entered club counts",
        "publisher": "This repo (etl/crosswalks/clubs_manual.csv), each row cites its source page",
        "license": "MIT",
        "homepage": "",
    },
}
