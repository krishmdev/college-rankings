from college_etl import universe
from college_etl.config import UniverseRule
from college_etl.transform import domain_from_url, locale_group, scorecard_rows, split_aliases


def test_universe_filter(frame):
    df = frame(
        [
            {"UNITID": "1", "INSTNM": "Keep Public"},
            {"UNITID": "2", "INSTNM": "Keep Private", "CONTROL": "2"},
            {"UNITID": "3", "INSTNM": "For Profit", "CONTROL": "3"},
            {"UNITID": "4", "INSTNM": "Closed", "CURROPER": "0"},
            {"UNITID": "5", "INSTNM": "Two Year", "PREDDEG": "2"},
            {"UNITID": "6", "INSTNM": "Online", "DISTANCEONLY": "1"},
            {"UNITID": "7", "INSTNM": "Tiny", "UGDS": "299"},
            {"UNITID": "8", "INSTNM": "Distance unknown", "DISTANCEONLY": "NULL"},
            {"UNITID": "9", "INSTNM": "Not four-year", "ICLEVEL": "2"},
        ]
    )
    kept = universe.apply(df)["INSTNM"].to_list()
    assert kept == ["Keep Public", "Keep Private", "Distance unknown"]
    assert universe.apply(df, UniverseRule(min_ugds=0))["UNITID"].to_list() == ["1", "2", "7", "8"]


def test_domain_parsing():
    assert domain_from_url("www.bu.edu/") == "bu.edu"
    assert domain_from_url("https://www.tamu.edu/") == "tamu.edu"
    assert domain_from_url("HTTP://WWW2.Example.EDU/admissions?x=1") == "example.edu"
    assert domain_from_url("worldwide.erau.edu/") == "worldwide.erau.edu"
    assert domain_from_url("") is None
    assert domain_from_url(None) is None


def test_locale_and_aliases():
    assert locale_group("11") == "city"
    assert locale_group("23") == "suburb"
    assert locale_group("32") == "town"
    assert locale_group("43") == "rural"
    assert locale_group("NULL") is None
    assert split_aliases("BU, Boston U") == ["BU", "Boston U"]
    assert split_aliases("NULL") == []


def test_net_price_follows_control_and_suppression_is_flagged(frame):
    df = frame(
        [
            {
                "UNITID": "1",
                "INSTNM": "Pub",
                "NPT4_PUB": "12000",
                "NPT4_PRIV": "99999",
                "C150_4": "PrivacySuppressed",
                "C150_4_POOLED": "NULL",
            },
            {
                "UNITID": "2",
                "INSTNM": "Priv",
                "CONTROL": "2",
                "NPT4_PUB": "1",
                "NPT4_PRIV": "30000",
                "C150_4": "NULL",
                "C150_4_POOLED": "0.7",
            },
        ]
    )
    pub, priv = scorecard_rows(df)
    assert pub.values["net_price"] == 12000
    assert priv.values["net_price"] == 30000
    assert pub.values["grad_rate"] is None and pub.flags["grad_rate"] == "suppressed"
    assert priv.values["grad_rate"] == 0.7 and "grad_rate" not in priv.flags
    assert pub.control == "public" and priv.control == "private_nonprofit"
