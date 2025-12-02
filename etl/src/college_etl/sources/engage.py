"""Student-organization counts from Campus Labs Engage.

Many schools run their club directory on Engage at `<sub>.campuslabs.com/engage`, and the site's
public search API returns an `@odata.count` of listed organizations. The subdomain usually matches
the first label of the school's web domain (bu, umich, gatech, purdue), so discovery tries that one
candidate per school. It's slow on purpose: at most 2 requests per second, results are written to a
committed CSV after every request, and a rerun skips anything already checked.

Coverage is partial. Schools that use another platform, or a different subdomain, come out as
unknown, and the app says so rather than guessing.
"""

from __future__ import annotations

import csv
import re
import time
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

import httpx

from ..config import ENGAGE_HOME, ENGAGE_URL
from ..http import client

FIELDS = ["subdomain", "unitids", "status", "count", "site_title", "checked_at", "reviewed"]
MIN_PLAUSIBLE = 10  # Portals with a handful of listings are usually a single office, not the club directory.
SHORT_SUBDOMAIN = 3


@dataclass
class Candidate:
    subdomain: str
    unitids: list[int]


def subdomain_for(domain: str | None) -> str | None:
    if not domain:
        return None
    label = domain.split(".")[0]
    return label if re.fullmatch(r"[a-z0-9-]{2,40}", label) else None


def candidates(schools: Iterable[tuple[int, str | None]]) -> list[Candidate]:
    by_sub: dict[str, list[int]] = defaultdict(list)
    for unitid, domain in schools:
        sub = subdomain_for(domain)
        if sub:
            by_sub[sub].append(unitid)
    return [Candidate(sub, sorted(ids)) for sub, ids in sorted(by_sub.items())]


def load(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(newline="") as fh:
        return {r["subdomain"]: r for r in csv.DictReader(fh)}


def save(path: Path, rows: dict[str, dict]) -> None:
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        for sub in sorted(rows):
            w.writerow({k: rows[sub].get(k, "") for k in FIELDS})
    tmp.replace(path)


class RateLimiter:
    def __init__(
        self,
        per_second: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.interval = 1.0 / per_second
        self.clock = clock
        self.sleep = sleep
        self.last = -1e9

    def wait(self) -> None:
        delay = self.last + self.interval - self.clock()
        if delay > 0:
            self.sleep(delay)
        self.last = self.clock()


def _title(html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip(" -") if m else ""


def probe(c: httpx.Client, sub: str, limiter: RateLimiter) -> dict:
    limiter.wait()
    try:
        r = c.get(ENGAGE_URL.format(sub=sub))
    except httpx.HTTPError as e:
        return {"status": "error", "count": "", "site_title": type(e).__name__}
    if r.status_code == 404:
        return {"status": "not_found", "count": "", "site_title": ""}
    if r.status_code != 200:
        return {"status": "error", "count": "", "site_title": f"HTTP {r.status_code}"}
    try:
        count = int(r.json()["@odata.count"])
    except (ValueError, KeyError, TypeError):
        return {"status": "error", "count": "", "site_title": "unexpected payload"}
    limiter.wait()
    try:
        title = _title(c.get(ENGAGE_HOME.format(sub=sub)).text)
    except httpx.HTTPError:
        title = ""
    return {"status": "found", "count": str(count), "site_title": title}


def discover(
    path: Path,
    cands: list[Candidate],
    *,
    per_second: float = 2.0,
    retry_errors: bool = False,
    limit: int | None = None,
    http: httpx.Client | None = None,
    limiter: RateLimiter | None = None,
    on_progress: Callable[[str, dict], None] | None = None,
) -> dict[str, dict]:
    rows = load(path)
    limiter = limiter or RateLimiter(per_second)
    own = http is None
    c = http or client(timeout=10)
    done = 0
    try:
        for cand in cands:
            prev = rows.get(cand.subdomain)
            if prev and (prev["status"] != "error" or not retry_errors):
                prev["unitids"] = ";".join(map(str, cand.unitids))
                continue
            if limit is not None and done >= limit:
                break
            result = probe(c, cand.subdomain, limiter)
            rows[cand.subdomain] = {
                "subdomain": cand.subdomain,
                "unitids": ";".join(map(str, cand.unitids)),
                "checked_at": time.strftime("%Y-%m-%d"),
                "reviewed": prev.get("reviewed", "") if prev else "",
                **result,
            }
            save(path, rows)
            done += 1
            if on_progress:
                on_progress(cand.subdomain, rows[cand.subdomain])
    finally:
        if own:
            c.close()
    save(path, rows)
    return rows


@dataclass(frozen=True)
class ClubCount:
    count: int
    source: str  # 'engage' or 'manual'
    url: str


def usable(row: dict) -> bool:
    """A discovered count is used only if it's unambiguous and plausible; short subdomains need review."""
    if row.get("status") != "found" or not row.get("count"):
        return False
    if ";" in row.get("unitids", ""):
        return False
    if int(row["count"]) < MIN_PLAUSIBLE:
        return False
    return not (len(row["subdomain"]) <= SHORT_SUBDOMAIN and row.get("reviewed", "").strip() != "ok")


def club_counts(engage_csv: Path, manual_csv: Path) -> dict[int, ClubCount]:
    out: dict[int, ClubCount] = {}
    for row in load(engage_csv).values():
        if usable(row) and row.get("reviewed", "").strip() != "reject":
            out[int(row["unitids"])] = ClubCount(
                int(row["count"]), "engage", f"https://{row['subdomain']}.campuslabs.com/engage/organizations"
            )
    if manual_csv.exists():
        with manual_csv.open(newline="") as fh:
            for r in csv.DictReader(fh):
                out[int(r["unitid"])] = ClubCount(int(r["count"]), "manual", r["source_url"])
    return out
