import json

from college_etl.derive import derive
from college_etl.emit import build_document, content_hash, dumps_snapshot, sig6
from college_etl.transform import SchoolRow


def school(**kw):
    base = dict(
        id=1,
        name="A",
        aliases=[],
        city="X",
        state="MA",
        control="public",
        locale="city",
        lat=None,
        lon=None,
        domain="a.edu",
        ug_size=1000,
        grads=250,
        endowment=5e6,
    )
    base.update(kw)
    return SchoolRow(**base)


def test_derived_metrics():
    s = school()
    s.values.update(research_total=2.5e6, clubs_count=40, net_price=10000, median_earnings_10y=60000)
    s.flags["research_total"] = "imputed_zero"
    derive(s)
    assert s.values["research_per_student"] == 2000
    assert s.values["endowment_per_student"] == 4000
    assert s.values["clubs_per_1k_ug"] == 40
    assert s.values["earnings_to_price"] == 1.5
    assert s.flags["research_per_student"] == "imputed_zero"


def test_joint_herd_figure_is_spread_over_member_campuses():
    parent = school(member_enrollment=750)
    parent.values.update(research_total=4e6)
    derive(parent)
    assert parent.values["research_per_student"] == 2000  # 4e6 / (1000 + 250 + 750)

    member = school(id=2)
    member.values["research_total"] = None
    member.flags["research_total"] = "reported_with_parent"
    member.reported_with["research_total"] = 1
    derive(member)
    assert member.values["research_per_student"] is None
    assert member.flags["research_per_student"] == "reported_with_parent"
    assert member.reported_with["research_per_student"] == 1


def test_derived_metrics_propagate_missing():
    s = school(endowment=None)
    s.values.update(research_total=None, clubs_count=None, net_price=None, median_earnings_10y=50000)
    derive(s)
    assert s.values["research_per_student"] is None
    assert s.values["clubs_per_1k_ug"] is None
    assert s.values["earnings_to_price"] is None
    assert s.values["endowment_per_student"] is None


def test_sig6():
    assert sig6(784355000.0) == 784355000
    assert sig6(0.852777777) == 0.852778
    assert sig6(21096.2345) == 21096.2
    assert isinstance(sig6(10.0), int)


def _doc(schools, generated_at="2026-01-01T00:00:00"):
    return build_document(
        snapshot_id="t",
        generated_at=generated_at,
        universe_rule="r",
        schools=schools,
        metric_keys=["grad_rate"],
        metrics_meta=[{"key": "grad_rate"}],
        sources=[],
    )


def test_emit_is_deterministic_and_hash_ignores_timestamp():
    a = [school(id=2, name="B"), school(id=1, name="A")]
    for s in a:
        s.values["grad_rate"] = 0.5
    d1 = _doc(a)
    d2 = _doc(list(reversed(a)), generated_at="2027-06-01T12:00:00")
    assert [s["id"] for s in d1["schools"]] == [1, 2]
    assert d1["contentHash"] == d2["contentHash"]
    assert dumps_snapshot(d1) == dumps_snapshot({**d2, "generatedAt": d1["generatedAt"]})
    parsed = json.loads(dumps_snapshot(d1))
    assert parsed["schools"][0]["values"] == {"grad_rate": 0.5}
    assert content_hash(parsed) == d1["contentHash"]
