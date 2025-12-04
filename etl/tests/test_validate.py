from college_etl.config import ValidationRules
from college_etl.sources.herd import HerdJoin, Member
from college_etl.transform import SchoolRow
from college_etl.validate import validate


def row(id, opeid, faculty=10, flag=None, research=0.0):
    s = SchoolRow(
        id=id,
        name=f"S{id}",
        aliases=[],
        city="X",
        state="MA",
        control="public",
        locale="city",
        lat=None,
        lon=None,
        domain=None,
        ug_size=1000,
        grads=0,
        endowment=None,
        opeid6=opeid,
    )
    s.values.update(faculty_count=faculty, research_total=research)
    if flag:
        s.flags["research_total"] = flag
    return s


def failures(schools, usd, **kw):
    herd = HerdJoin(usd=usd, system_level=set(), unresolved=[], matched_rows=len(usd), excluded_rows=0)
    rules = ValidationRules(min_rows=0, coverage_floors={})
    rep = validate(schools, herd, ["research_total"], rules, clubs_enabled=False, **kw)
    return [f for f in rep.failures if not f.startswith("spot check")]


def test_zero_for_a_campus_of_a_herd_reporter_fails():
    schools = [row(1, "001234", research=5e8), row(2, "001234", flag="imputed_zero")]
    assert any("shares OPEID6" in f for f in failures(schools, {1: 5e8}))


def test_zero_with_large_faculty_fails_unless_reviewed():
    schools = [row(3, "009999", faculty=400, flag="imputed_zero")]
    assert any("400 faculty" in f for f in failures(schools, {}))
    assert failures(schools, {}, reviewed_absent={3}) == []


def test_member_needs_a_parent_with_a_herd_figure():
    schools = [row(1, "a"), row(2, "b", flag="reported_with_parent", research=None)]
    members = {2: Member(2, "S2", 1, "")}
    assert any("has no HERD figure" in f for f in failures(schools, {}, members=members))
    assert failures(schools, {1: 1e7}, members=members) == []
