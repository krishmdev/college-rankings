import httpx
import respx

from college_etl.sources import engage


class FakeClock:
    def __init__(self):
        self.t = 0.0
        self.sleeps = []

    def clock(self):
        return self.t

    def sleep(self, d):
        self.sleeps.append(d)
        self.t += d


def test_candidates_use_first_domain_label_and_group_shared_domains():
    c = engage.candidates([(1, "bu.edu"), (2, "umich.edu"), (3, "pitt.edu"), (4, "pitt.edu"), (5, None)])
    assert [(x.subdomain, x.unitids) for x in c] == [("bu", [1]), ("pitt", [3, 4]), ("umich", [2])]


def test_rate_limiter_spaces_requests():
    fc = FakeClock()
    rl = engage.RateLimiter(2.0, clock=fc.clock, sleep=fc.sleep)
    for _ in range(3):
        rl.wait()
    assert fc.sleeps == [0.5, 0.5]


@respx.mock
def test_discover_is_resumable_and_records_status(tmp_path):
    respx.get(url__regex=r"https://bu\.campuslabs\.com/engage/api/.*").mock(
        return_value=httpx.Response(200, json={"@odata.count": 432, "value": []})
    )
    respx.get("https://bu.campuslabs.com/engage/").mock(
        return_value=httpx.Response(200, text="<title> - Terrier Central</title>")
    )
    nf = respx.get(url__regex=r"https://nope\.campuslabs\.com/.*").mock(return_value=httpx.Response(404))
    csv_path = tmp_path / "engage.csv"
    fc = FakeClock()
    rl = engage.RateLimiter(2.0, clock=fc.clock, sleep=fc.sleep)
    cands = [engage.Candidate("bu", [164988]), engage.Candidate("nope", [1])]
    with httpx.Client() as c:
        rows = engage.discover(csv_path, cands, http=c, limiter=rl)
        assert rows["bu"]["status"] == "found" and rows["bu"]["count"] == "432"
        assert rows["bu"]["site_title"] == "Terrier Central"
        assert rows["nope"]["status"] == "not_found"
        calls = nf.call_count
        engage.discover(csv_path, cands, http=c, limiter=rl)
        assert nf.call_count == calls  # already checked, not probed again


def test_usable_rules_and_manual_override(tmp_path):
    csv_path = tmp_path / "engage.csv"
    engage.save(
        csv_path,
        {
            "bu": {
                "subdomain": "bu",
                "unitids": "164988",
                "status": "found",
                "count": "432",
                "reviewed": "ok",
            },
            "gatech": {"subdomain": "gatech", "unitids": "139755", "status": "found", "count": "765"},
            "uc": {"subdomain": "uc", "unitids": "201885", "status": "found", "count": "600"},
            "tiny": {"subdomain": "tiny", "unitids": "5", "status": "found", "count": "3"},
            "pitt": {"subdomain": "pitt", "unitids": "3;4", "status": "found", "count": "700"},
        },
    )
    manual = tmp_path / "manual.csv"
    manual.write_text("unitid,count,source_url,retrieved\n139755,800,https://example.edu/clubs,2025-12-23\n")
    counts = engage.club_counts(csv_path, manual)
    assert counts[164988].count == 432 and counts[164988].source == "engage"
    assert counts[139755].count == 800 and counts[139755].source == "manual"
    assert 201885 not in counts  # 2-letter subdomain without review
    assert 5 not in counts  # implausibly few
    assert 3 not in counts and 4 not in counts  # shared subdomain is ambiguous
